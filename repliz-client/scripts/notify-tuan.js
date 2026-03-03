#!/usr/bin/env node
/**
 * notify-tuan.js — Phase 3: Telegram Notifier for Reply Approval
 * 
 * Send draft replies to Tuan via Telegram for approval
 * Format: Comment + Draft + Action Buttons
 * 
 * Run after reply-drafter
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from root
const rootDir = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'notify-tuan.log');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

async function sendTelegramMessage(text, buttons = null) {
  if (!BOT_TOKEN || !CHAT_ID || BOT_TOKEN === 'your_bot_token_here') {
    await log('⚠️ Telegram not configured. Skipping notification.');
    await log('   Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    return { ok: false, error: 'Not configured' };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  if (buttons) {
    payload.reply_markup = {
      inline_keyboard: [buttons]
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.ok) {
      await log('✅ Telegram notification sent');
      return { ok: true, messageId: data.result.message_id };
    } else {
      await log(`❌ Telegram error: ${data.description}`);
      return { ok: false, error: data.description };
    }
  } catch (err) {
    await log(`❌ Failed to send Telegram: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function formatNotification(draft) {
  const { username, originalText, draftReply, priority, category } = draft;
  
  const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
  const categoryLabel = category.replace('_', ' ').toUpperCase();
  
  return `${priorityEmoji} <b>Reply Approval Needed</b>

💬 <b>Comment from @${username}:</b>
"${originalText.substring(0, 200)}${originalText.length > 200 ? '...' : ''}"

✍️ <b>Claudia's Draft Reply:</b>
"${draftReply}"

<i>Category: ${categoryLabel} | Priority: ${priority.toUpperCase()}</i>`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  
  await log('=== Notify Tuan (Phase 3) Started ===');
  
  // Check if Telegram is configured
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') {
    await log('⚠️ TELEGRAM_BOT_TOKEN not set in .env');
    await log('   Please set it to enable Telegram notifications');
    
    // Still process drafts but log to file only
    console.log('\n📋 DRAFTS READY (Telegram not configured):');
    console.log('=========================================\n');
  }
  
  // Read draft replies
  const draftsFile = path.join(STATE_DIR, 'draft-replies.json');
  let draftsData;
  
  try {
    const content = await fs.readFile(draftsFile, 'utf-8');
    draftsData = JSON.parse(content);
  } catch (err) {
    await log('⚠️ No draft replies found. Run reply-drafter first.');
    return;
  }
  
  const drafts = draftsData.drafts || [];
  const pendingDrafts = drafts.filter(d => d.status === 'awaiting_approval');
  
  await log(`Found ${pendingDrafts.length} drafts awaiting approval`);
  
  if (pendingDrafts.length === 0) {
    await log('No drafts to notify. Exiting.');
    return;
  }
  
  let sentCount = 0;
  
  for (const draft of pendingDrafts) {
    const message = formatNotification(draft);
    
    // Action buttons
    const buttons = [
      { text: '✅ Approve', callback_data: `approve:${draft.commentId}` },
      { text: '✏️ Edit', callback_data: `edit:${draft.commentId}` },
      { text: '❌ Reject', callback_data: `reject:${draft.commentId}` },
      { text: '⏭️ Skip', callback_data: `skip:${draft.commentId}` }
    ];
    
    const result = await sendTelegramMessage(message, buttons);
    
    if (result.ok) {
      draft.status = 'notified';
      draft.notificationSentAt = new Date().toISOString();
      draft.telegramMessageId = result.messageId;
      sentCount++;
      
      await log(`✅ Notified Tuan about comment ${draft.commentId}`);
    } else {
      // If Telegram fails, still show in console
      console.log('\n' + message);
      console.log('Actions: [Approve] [Edit] [Reject] [Skip]');
      console.log('---');
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Update drafts file
  await fs.writeFile(draftsFile, JSON.stringify(draftsData, null, 2));
  
  await log(`✅ Sent ${sentCount} notifications`);
  await log('=== Notify Tuan Complete ===\n');
  
  // Save to approval queue for handler
  const approvalQueue = pendingDrafts.map(d => ({
    commentId: d.commentId,
    username: d.username,
    draftReply: d.draftReply,
    status: 'awaiting_approval',
    notifiedAt: d.notificationSentAt || new Date().toISOString(),
    telegramMessageId: d.telegramMessageId
  }));
  
  const queueFile = path.join(STATE_DIR, 'approval-queue.json');
  await fs.writeFile(queueFile, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    pendingApprovals: approvalQueue
  }, null, 2));
  
  await log(`✅ Saved ${approvalQueue.length} items to approval-queue.json`);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
