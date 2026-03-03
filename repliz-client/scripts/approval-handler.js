#!/usr/bin/env node
/**
 * approval-handler.js — Phase 3: Handle Tuan's Approval Actions
 * 
 * Listen for Telegram callback queries (button clicks)
 * Process: Approve, Edit, Reject
 * Publish reply if approved
 * 
 * Run: Continuously or cron every 5 minutes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from '../scripts/repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') {
    return [];
  }

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

async function editMessage(chatId, messageId, newText) {
  if (!BOT_TOKEN) return;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    parse_mode: 'HTML'
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    await log(`❌ Failed to edit message: ${err.message}`);
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
  const draftsFile = path.join(STATE_DIR, 'draft-replies.json');
  
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

async function processApproval(action, commentId, chatId, messageId, callbackQueryId) {
  await log(`Processing ${action} for comment ${commentId}`);
  
  const client = new ReplizClient();
  await client.init();
  
  const queue = await loadApprovalQueue();
  const item = queue.pendingApprovals.find(a => a.commentId === commentId);
  
  if (!item) {
    await answerCallbackQuery(callbackQueryId, 'Item not found in queue');
    return;
  }
  
  switch (action) {
    case 'approve':
      // Publish reply to Threads
      await log(`Publishing reply for ${commentId}...`);
      
      const result = await client.replyToComment(commentId, item.draftReply);
      
      if (result.ok) {
        await updateDraftStatus(commentId, 'approved_published', 'Published to Threads');
        await editMessage(chatId, messageId, 
          `✅ <b>APPROVED & PUBLISHED</b>\n\nReply to @${item.username} has been posted.`
        );
        await answerCallbackQuery(callbackQueryId, 'Reply published successfully!');
        await log(`✅ Published reply for ${commentId}`);
      } else {
        await answerCallbackQuery(callbackQueryId, `Failed to publish: ${result.error}`);
        await log(`❌ Failed to publish: ${result.error}`);
      }
      break;
      
    case 'edit':
      // Mark as needs edit - Tuan will send new text
      await updateDraftStatus(commentId, 'needs_edit', 'Waiting for Tuan edit');
      await editMessage(chatId, messageId,
        `✏️ <b>EDIT REQUESTED</b>\n\nPlease reply with the new text for @${item.username}.\n\nOriginal draft:\n"${item.draftReply}"`
      );
      await answerCallbackQuery(callbackQueryId, 'Please send the edited reply text');
      await log(`✏️ Edit requested for ${commentId}`);
      break;
      
    case 'reject':
      // Skip this comment
      await updateDraftStatus(commentId, 'rejected', 'Rejected by Tuan');
      await editMessage(chatId, messageId,
        `❌ <b>REJECTED</b>\n\nReply to @${item.username} has been skipped.`
      );
      await answerCallbackQuery(callbackQueryId, 'Reply rejected');
      await log(`❌ Rejected ${commentId}`);
      break;
      
    case 'skip':
      // Defer to later
      await updateDraftStatus(commentId, 'deferred', 'Skipped for now');
      await answerCallbackQuery(callbackQueryId, 'Skipped. Will check again later.');
      await log(`⏭️ Skipped ${commentId}`);
      break;
      
    default:
      await answerCallbackQuery(callbackQueryId, 'Unknown action');
  }
  
  // Remove from queue
  queue.pendingApprovals = queue.pendingApprovals.filter(a => a.commentId !== commentId);
  await saveApprovalQueue(queue);
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  
  await log('=== Approval Handler (Phase 3) Started ===');
  
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') {
    await log('⚠️ TELEGRAM_BOT_TOKEN not set. Running in simulation mode.');
    await log('   Set bot token to enable approval handling.');
  }
  
  let lastUpdateId = 0;
  
  // For cron mode: just check once
  // For daemon mode: loop continuously
  const isDaemon = process.argv.includes('--daemon');
  
  do {
    const updates = await getUpdates(lastUpdateId + 1);
    
    for (const update of updates) {
      lastUpdateId = update.update_id;
      
      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const callback = update.callback_query;
        const data = callback.data;
        const chatId = callback.message?.chat?.id;
        const messageId = callback.message?.message_id;
        const callbackQueryId = callback.id;
        
        // Parse action:commentId
        const [action, commentId] = data.split(':');
        
        if (action && commentId) {
          await processApproval(action, commentId, chatId, messageId, callbackQueryId);
        } else {
          await answerCallbackQuery(callbackQueryId, 'Invalid action');
        }
      }
      
      // Handle edited replies (if Tuan sends new text after clicking Edit)
      if (update.message && update.message.reply_to_message) {
        // Check if this is a reply to an edit request
        const text = update.message.text;
        const chatId = update.message.chat.id;
        
        await log(`Received potential edit from Tuan: ${text.substring(0, 50)}...`);
        // TODO: Implement edit workflow - save new text and ask for confirmation
      }
    }
    
    if (isDaemon) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second polling
    }
    
  } while (isDaemon);
  
  await log('=== Approval Handler Complete ===');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
