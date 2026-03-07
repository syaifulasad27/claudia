#!/usr/bin/env node
/**
 * comment-fetcher.js — Phase 1: Fetch & Filter Comments
 * 
 * Fetch comments from Repliz API, filter spam/foreign chars,
 * save to pending-comments.json for review.
 * 
 * Cron: Every 30 minutes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from '../scripts/repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'comment-fetcher.log');

// Foreign character detection (same as repliz-client)
const blockedRanges = [
  /[\u4E00-\u9FFF]/, // Chinese
  /[\u3040-\u309F]/, // Hiragana
  /[\u30A0-\u30FF]/, // Katakana
  /[\uAC00-\uD7AF]/, // Korean
  /[\u0600-\u06FF]/, // Arabic
  /[\u0590-\u05FF]/, // Hebrew
  /[\u0E00-\u0E7F]/, // Thai
  /[\u0900-\u097F]/, // Hindi
];

const spamKeywords = [
  'check my bio',
  'dm for signal',
  'join grup',
  'wa.me/',
  'telegram.me/',
  'free signal',
  'copy trade',
  'jual beli',
  'promo',
  'diskon'
];

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

function containsForeignChars(text) {
  for (const range of blockedRanges) {
    if (range.test(text)) return true;
  }
  return false;
}

function containsSpam(text) {
  const lower = text.toLowerCase();
  return spamKeywords.some(keyword => lower.includes(keyword));
}

function hasExcessiveEmoji(text) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]/gu;
  const emojis = text.match(emojiRegex);
  return emojis && emojis.length > 5;
}

function categorizeComment(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('bot') || lower.includes('ai') || lower.includes('robot')) {
    return 'ai_accusation';
  }
  if (lower.includes('?') || lower.includes('bagaimana') || lower.includes('gimana') || lower.includes('cara')) {
    return 'question';
  }
  if (lower.includes('terima kasih') || lower.includes('thanks') || lower.includes('makasih') || lower.includes('mantap')) {
    return 'appreciation';
  }
  if (lower.includes('salah') || lower.includes('tidak benar') || lower.includes('hoax')) {
    return 'criticism';
  }
  return 'general';
}

function getPriority(category) {
  switch (category) {
    case 'ai_accusation': return 'high';
    case 'question': return 'high';
    case 'criticism': return 'high';
    case 'appreciation': return 'medium';
    default: return 'low';
  }
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  await log('=== Comment Fetcher Started ===');
  
  const client = new ReplizClient();
  const initRes = await client.init();
  
  if (!initRes.ok) {
    await log(`❌ Failed to init Repliz client: ${initRes.error}`);
    return;
  }
  
  // Fetch queue from Repliz
  await log('Fetching comment queue...');
  const queueRes = await client.getQueue({ page: 1, limit: 50, status: 'pending' });
  
  if (!queueRes.ok) {
    await log(`❌ Failed to fetch queue: ${queueRes.error}`);
    return;
  }
  
  const rawComments = queueRes.data?.docs || queueRes.data || [];
  await log(`Fetched ${rawComments.length} raw comments`);
  
  const processedComments = [];
  const skippedComments = [];
  
  for (const item of rawComments) {
    // Handle nested structure from Repliz API
    const commentData = item.comment || item;
    const text = commentData.text || commentData.description || '';
    const id = item._id || item.id;
    const username = commentData.owner?.name || commentData.owner?.username || commentData.username || 'unknown';
    const postId = item.content?.id || item.content?._id || item.postId || 'unknown';
    const postText = item.content?.description || item.content?.text || item.post?.description || item.post?.text || '';
    const postTitle = item.content?.title || item.post?.title || '';
    
    // Filter checks
    if (containsForeignChars(text)) {
      skippedComments.push({ id, reason: 'foreign_chars', preview: text.substring(0, 30) });
      continue;
    }
    
    if (containsSpam(text)) {
      skippedComments.push({ id, reason: 'spam', preview: text.substring(0, 30) });
      continue;
    }
    
    if (hasExcessiveEmoji(text)) {
      skippedComments.push({ id, reason: 'excessive_emoji', preview: text.substring(0, 30) });
      continue;
    }
    
    // Process valid comment
    const category = categorizeComment(text);
    const priority = getPriority(category);
    
    processedComments.push({
      id,
      username,
      text,
      postId,
      postContext: {
        title: postTitle,
        text: postText,
        preview: String(postText || postTitle || '').slice(0, 180)
      },
      timestamp: commentData.createdAt || item.createdAt || new Date().toISOString(),
      category,
      priority,
      status: 'pending_draft',
      fetchedAt: new Date().toISOString()
    });
  }
  
  // Save processed comments
  const pendingFile = path.join(STATE_DIR, 'pending-comments.json');
  await fs.writeFile(pendingFile, JSON.stringify({
    lastFetch: new Date().toISOString(),
    totalFetched: rawComments.length,
    validComments: processedComments.length,
    skippedComments: skippedComments.length,
    comments: processedComments
  }, null, 2));
  
  await log(`✅ Saved ${processedComments.length} valid comments`);
  await log(`⚠️ Skipped ${skippedComments.length} comments`);
  
  // Log details
  for (const c of processedComments) {
    await log(`  [${c.priority.toUpperCase()}] @${c.username}: "${c.text.substring(0, 50)}..." [${c.category}]`);
  }
  
  await log('=== Comment Fetcher Complete ===\n');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
