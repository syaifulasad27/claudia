#!/usr/bin/env node
/**
 * notify-tuan.js — Phase 3: Telegram Notifier with Deep Link Approval
 * 
 * Send draft replies to Tuan via Telegram with deep link approval
 * Format: Comment + Draft + Deep Links (replacement for inline buttons)
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
const BOT_USERNAME = 'Notifthreadsbot'; // Bot username for deep links

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

async function sendTelegramMessage(text) {
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

function formatNotificationWithDeepLinks(draft) {
  const {
    username = 'unknown',
    originalText = '',
    draftReply = '',
    priority = 'medium',
    category = 'general',
    commentId = 'unknown',
    quality = {}
  } = draft || {};

  const safeOriginal = String(originalText || '');
  const safeReply = String(draftReply || '(draft kosong)');
  const safePriority = String(priority || 'medium').toLowerCase();
  const safeCategory = String(category || 'general');

  const priorityEmoji = safePriority === 'high' ? '🔴' : safePriority === 'medium' ? '🟡' : '🟢';
  const categoryLabel = safeCategory.replace(/_/g, ' ').toUpperCase();
  
  // Deep link format: https://t.me/BOT_USERNAME?start=ACTION_COMMENTID
  const approveLink = `https://t.me/${BOT_USERNAME}?start=approve_${commentId}`;
  const editLink = `https://t.me/${BOT_USERNAME}?start=edit_${commentId}`;
  const rejectLink = `https://t.me/${BOT_USERNAME}?start=reject_${commentId}`;
  
  const rel = typeof quality?.relevanceScore === 'number' ? quality.relevanceScore : 'n/a';
  const dup = typeof quality?.duplicateScore === 'number' ? quality.duplicateScore : 'n/a';
  const risk = quality?.blockedReason ? ` | Risk: ${quality.blockedReason}` : '';

  return `${priorityEmoji} <b>Reply Approval Needed</b>

💬 <b>Comment from @${username}:</b>
"${safeOriginal.substring(0, 200)}${safeOriginal.length > 200 ? '...' : ''}"

✍️ <b>Claudia's Draft Reply:</b>
"${safeReply}"

<i>Category: ${categoryLabel} | Priority: ${safePriority.toUpperCase()} | Relevance: ${rel} | DupScore: ${dup}${risk}</i>

━━━━━━━━━━━━━━━━━━━━━
<b>👉 Pilih Aksi:</b>

✅ <a href="${approveLink}">APPROVE</a> — Publish reply
✏️ <a href="${editLink}">EDIT</a> — Request changes  
❌ <a href="${rejectLink}">REJECT</a> — Skip this comment

<i>Klik link di atas untuk approve/reject. Jika tidak ada aksi dalam 10 menit, saya akan follow up.</i>`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  
  await log('=== Notify Tuan (Phase 3 - Deep Link) Started ===');
  
  // Check if Telegram is configured
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') {
    await log('⚠️ TELEGRAM_BOT_TOKEN not set in .env');
    await log('   Please set it to enable Telegram notifications');
    
    console.log('\n📋 DRAFTS READY (Telegram not configured):');
    console.log('=========================================\n');
  }
  
  // Read draft replies
  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  let draftsData;
  
  try {
    const content = await fs.readFile(draftsFile, 'utf-8');
    draftsData = JSON.parse(content);
  } catch (err) {
    await log('⚠️ No draft replies found. Exiting.');
    return;
  }
  
  const drafts = draftsData.drafts || [];
  const pendingDrafts = drafts.filter(d =>
    d.status === 'awaiting_approval' ||
    d.status === 'drafted' ||
    d.status === 'needs_review_low_relevance' ||
    d.status === 'needs_review'
  );
  
  await log(`Found ${pendingDrafts.length} drafts awaiting approval`);
  
  if (pendingDrafts.length === 0) {
    await log('No drafts to notify. Exiting.');
    return;
  }
  
  let sentCount = 0;
  
  for (const draft of pendingDrafts) {
    const message = formatNotificationWithDeepLinks(draft);
    
    const result = await sendTelegramMessage(message);
    
    if (result.ok) {
      draft.status = 'notified';
      draft.notificationSentAt = new Date().toISOString();
      draft.telegramMessageId = result.messageId;
      sentCount++;
      
      await log(`✅ Notified Tuan about comment ${draft.commentId}`);
    } else {
      // If Telegram fails, still show in console
      console.log('\n' + message);
      console.log('---');
    }
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Update drafts file
  await fs.writeFile(draftsFile, JSON.stringify(draftsData, null, 2));
  
  await log(`✅ Sent ${sentCount} notifications with deep links`);
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
