#!/usr/bin/env node
/**
 * reply-drafter.js — Phase 2: Generate Draft Replies
 * 
 * Read pending comments, generate draft replies
 * Style: Natural Indonesian with minimal Jaksel touch
 * 
 * Run after comment-fetcher
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'reply-drafter.log');

// Jaksel vocabulary (use sparingly)
const jakselTerms = [
  'basically', 'which is', 'jujurly', 'literally', 'make sense'
];

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Use Jaksel term occasionally (not every sentence)
function jakselPrefix() {
  const chance = Math.random();
  if (chance < 0.3) return pickOne(jakselTerms) + ', ';
  return '';
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

function generateReply(comment) {
  const { text, category, username } = comment;
  const lowerText = text.toLowerCase();
  
  switch (category) {
    case 'ai_accusation':
      return generateAIAccusationReply(username);
    
    case 'question':
      if (lowerText.includes('atr') || lowerText.includes('sl') || lowerText.includes('stop loss')) {
        return generateTechnicalReply('risk_management', username);
      }
      if (lowerText.includes('entry') || lowerText.includes('buy') || lowerText.includes('sell')) {
        return generateTechnicalReply('entry', username);
      }
      return generateGeneralQuestionReply(username);
    
    case 'appreciation':
      return generateAppreciationReply(username);
    
    case 'criticism':
      return generateCriticismReply(username);
    
    default:
      return generateGeneralReply(username);
  }
}

function generateAIAccusationReply(username) {
  const replies = [
    `Haha, kalau aku beneran AI kenapa masih sering loss juga? Yang namanya trading itu human judgment tetap nomor satu kok.`,
    `Mungkin karena kebanyakan cut loss on time ya, makanya dibilang kayak robot. Tapi jujurly, loss-ku juga banyak kok ☕`,
    `Robot mana yang bisa ngopi sambil mikir strategy? Di balik akun ini ada real trader dengan real experience.`,
    `Spasibo za kompliment! Tapi seriously, aku masih belajar tiap hari dari market.`
  ];
  return pickOne(replies);
}

function generateTechnicalReply(type, username) {
  if (type === 'risk_management') {
    return `${jakselPrefix()}SL itu bukan sekedar angka sembarangan. Basically harus sesuai volatilitas market — kalau ATR tinggi, SL juga perlu dilebarin. Which is kenapa aku pakai ATR-based SL sekarang. Make sense kan?`;
  }
  if (type === 'entry') {
    return `${jakselPrefix()}Entry yang bagus itu nunggu pullback ke area support/EMA, bukan FOMO kejar harga. Jujurly, sabar itu sulit tapi worth it. Better miss trade than wrong entry.`;
  }
  return `${jakselPrefix()}Pertanyaan bagus! Aku bahas lebih detail di thread sebelumnya tentang ini. Silakan scroll up atau tanya spesifik aja biar bisa ku jelasin lebih detail.`;
}

function generateGeneralQuestionReply(username) {
  return `${jakselPrefix()}Thanks for asking! Basically trading itu simple tapi nggak gampang — perlu disiplin sama sistem yang konsisten. Kalau ada spesifik topik yang mau dibahas, bilang aja ya.`;
}

function generateAppreciationReply(username) {
  const replies = [
    `Thanks ${username}! Senang kalau share-ku bisa bermanfaat. Keep learning ya! 🙏`,
    `Appreciate it! Basically kita sama-sama belajar dari market ini.`,
    `Makasih ${username}! Jujurly, komentar positif kayak gini yang bikin semangat nge-share.`
  ];
  return pickOne(replies);
}

function generateCriticismReply(username) {
  return `${jakselPrefix()}Fair point. Aku respect kritik yang konstruktif — itu yang bikin strategy makin improve. Which is kenapa aku selalu backtest dan adjust. Thanks for the input!`;
}

function generateGeneralReply(username) {
  return `${jakselPrefix()}Thanks for dropping by! Basically trading itu journey, bukan destination. Keep grinding and stay safe with your risk management.`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  
  await log('=== Reply Drafter Started ===');
  
  // Read pending comments
  const pendingFile = path.join(STATE_DIR, 'pending-comments.json');
  let pendingData;
  
  try {
    const content = await fs.readFile(pendingFile, 'utf-8');
    pendingData = JSON.parse(content);
  } catch (err) {
    await log('⚠️ No pending comments file found. Run comment-fetcher first.');
    return;
  }
  
  const comments = pendingData.comments || [];
  await log(`Found ${comments.length} pending comments`);
  
  if (comments.length === 0) {
    await log('No comments to draft. Exiting.');
    return;
  }
  
  const drafts = [];
  
  for (const comment of comments) {
    if (comment.status !== 'pending_draft') {
      await log(`Skipping comment ${comment.id} — status: ${comment.status}`);
      continue;
    }
    
    const draftReply = generateReply(comment);
    
    drafts.push({
      commentId: comment.id,
      username: comment.username,
      originalText: comment.text,
      draftReply: draftReply,
      category: comment.category,
      priority: comment.priority,
      proposedAt: new Date().toISOString(),
      status: 'awaiting_approval'
    });
    
    await log(`[${comment.priority.toUpperCase()}] Draft for @${comment.username}: "${draftReply.substring(0, 60)}..."`);
    
    // Update comment status
    comment.status = 'drafted';
  }
  
  // Save drafts
  const draftsFile = path.join(STATE_DIR, 'draft-replies.json');
  await fs.writeFile(draftsFile, JSON.stringify({
    lastGenerated: new Date().toISOString(),
    totalDrafts: drafts.length,
    drafts: drafts
  }, null, 2));
  
  // Update pending comments (mark as drafted)
  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));
  
  await log(`✅ Generated ${drafts.length} draft replies`);
  await log(`✅ Saved to draft-replies.json`);
  await log('=== Reply Drafter Complete ===\n');
  
  // Summary for Tuan
  if (drafts.length > 0) {
    console.log('\n📋 DRAFTS READY FOR APPROVAL:');
    console.log('============================');
    for (const d of drafts) {
      console.log(`\n💬 @${d.username}: "${d.originalText.substring(0, 40)}..."`);
      console.log(`✍️  Draft: "${d.draftReply}"`);
      console.log(`[${d.priority.toUpperCase()}] ${d.category}`);
      console.log('---');
    }
    console.log('\n⚠️  Phase 3 (Notifier) belum aktif.');
    console.log('   Untuk approve, tunggu Phase 3 atau approve manual.');
  }
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
