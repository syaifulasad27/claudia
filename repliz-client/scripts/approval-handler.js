#!/usr/bin/env node
/**
 * approval-handler.js — Handle Deep Link Approvals from Telegram
 * 
 * Process /start commands with approval parameters
 * Format: /start approve_COMMENTID or /start edit_COMMENTID etc.
 * 
 * Run: Continuously or cron every 5 minutes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ReplizClient } from '../scripts/repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from root
const rootDir = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'approval-handler.log');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

async function getUpdates(offset = 0) {
  if (!BOT_TOKEN) return [];

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&limit=100`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok) {
      return data.result;
    }
    return [];
  } catch (err) {
    await log(`❌ Failed to get updates: ${err.message}`);
    return [];
  }
}

async function answerCallbackQuery(callbackQueryId, text = null) {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  
  const payload = {
    callback_query_id: callbackQueryId
  };
  
  if (text) {
    payload.text = text;
    payload.show_alert = true;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    await log(`❌ Failed to answer callback: ${err.message}`);
  }
}

async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    await log(`❌ Failed to send message: ${err.message}`);
  }
}

async function loadApprovalQueue() {
  const queueFile = path.join(STATE_DIR, 'approval-queue.json');
  
  try {
    const content = await fs.readFile(queueFile, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { pendingApprovals: [] };
  }
}

async function saveApprovalQueue(queue) {
  const queueFile = path.join(STATE_DIR, 'approval-queue.json');
  await fs.writeFile(queueFile, JSON.stringify(queue, null, 2));
}

async function updateDraftStatus(commentId, status, note = '') {
  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  
  try {
    const content = await fs.readFile(draftsFile, 'utf-8');
    const data = JSON.parse(content);
    
    const draft = data.drafts.find(d => d.commentId === commentId);
    if (draft) {
      draft.status = status;
      draft.processedAt = new Date().toISOString();
      draft.processNote = note;
    }
    
    await fs.writeFile(draftsFile, JSON.stringify(data, null, 2));
  } catch (err) {
    await log(`❌ Failed to update draft status: ${err.message}`);
  }
}

async function processApproval(action, commentId, chatId) {
  await log(`Processing ${action} for comment ${commentId}`);
  
  const client = new ReplizClient();
  await client.init();
  
  const queue = await loadApprovalQueue();
  const item = queue.pendingApprovals.find(a => a.commentId === commentId);
  
  if (!item) {
    await sendMessage(chatId, `❌ Item tidak ditemukan atau sudah diproses sebelumnya.`);
    return;
  }
  
  switch (action) {
    case 'approve':
      await log(`Publishing reply for ${commentId}...`);
      
      const result = await client.replyToComment(commentId, item.draftReply);
      
      if (result.ok) {
        await updateDraftStatus(commentId, 'approved_published', 'Published to Threads');
        await sendMessage(chatId, `✅ <b>REPLY PUBLISHED!</b>\n\nReply to @${item.username} telah terkirim ke Threads.\n\n📝 Draft:\n"${item.draftReply.substring(0, 100)}..."`);
        await log(`✅ Published reply for ${commentId}`);
      } else {
        await sendMessage(chatId, `❌ Failed to publish: ${result.error}`);
        await log(`❌ Failed to publish: ${result.error}`);
      }
      break;
      
    case 'edit':
      await updateDraftStatus(commentId, 'needs_edit', 'Waiting for Tuan edit');
      await sendMessage(chatId, `✏️ <b>EDIT REQUESTED</b>\n\nSilakan reply dengan draft baru untuk @${item.username}.\n\nOriginal draft:\n"${item.draftReply}"`);
      await log(`✏️ Edit requested for ${commentId}`);
      break;
      
    case 'reject':
      await updateDraftStatus(commentId, 'rejected', 'Rejected by Tuan');
      await sendMessage(chatId, `❌ <b>REJECTED</b>\n\nReply to @${item.username} telah di-skip.`);
      await log(`❌ Rejected ${commentId}`);
      break;
      
    default:
      await sendMessage(chatId, `❌ Unknown action: ${action}`);
  }
  
  // Remove from queue
  queue.pendingApprovals = queue.pendingApprovals.filter(a => a.commentId !== commentId);
  await saveApprovalQueue(queue);
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  
  await log('=== Approval Handler (Deep Link) Started ===');
  
  if (!BOT_TOKEN) {
    await log('⚠️ TELEGRAM_BOT_TOKEN not set. Cannot process approvals.');
    return;
  }
  
  let lastUpdateId = 0;
  let processedStartCommands = new Set(); // Track processed commands to avoid duplicates
  
  // Load last processed ID from file if exists
  const stateFile = path.join(STATE_DIR, 'approval-handler-state.json');
  try {
    const state = JSON.parse(await fs.readFile(stateFile, 'utf-8'));
    lastUpdateId = state.lastUpdateId || 0;
    processedStartCommands = new Set(state.processedCommands || []);
  } catch (err) {
    // No state file yet
  }
  
  const updates = await getUpdates(lastUpdateId + 1);
  
  for (const update of updates) {
    lastUpdateId = update.update_id;
    
    // Handle /start commands with parameters (deep links)
    if (update.message && update.message.text) {
      const text = update.message.text;
      const chatId = update.message.chat.id;
      
      // Check if it's a /start command with parameters
      if (text.startsWith('/start ')) {
        const param = text.substring(7).trim(); // Remove '/start '
        
        // Check if already processed (duplicate prevention)
        const commandKey = `${chatId}_${param}_${update.update_id}`;
        if (processedStartCommands.has(commandKey)) {
          await log(`Skipping duplicate command: ${param}`);
          continue;
        }
        processedStartCommands.add(commandKey);
        
        // Parse action and commentId from parameter
        // Format: action_commentId (e.g., "approve_123abc" or "edit_123abc")
        const match = param.match(/^(approve|edit|reject|skip)_(.+)$/);
        
        if (match) {
          const action = match[1];
          const commentId = match[2];
          
          await log(`Received deep link: ${action} for ${commentId}`);
          await processApproval(action, commentId, chatId);
        } else {
          await sendMessage(chatId, '❌ Format perintah tidak dikenal. Gunakan link dari notifikasi.');
        }
      }
    }
  }
  
  // Save state
  await fs.writeFile(stateFile, JSON.stringify({
    lastUpdateId,
    processedCommands: Array.from(processedStartCommands).slice(-100) // Keep last 100
  }, null, 2));
  
  await log('=== Approval Handler Complete ===');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
