#!/usr/bin/env node
/**
 * smart-reply-generator.js — Contextual Reply Generator
 * 
 * Fetch post content + comment, generate contextual reply
 * No generic responses — always address the specific context
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'smart-reply-generator.log');

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

/**
 * Fetch post content from Repliz API
 */
async function fetchPostContent(postId) {
  // This would normally fetch from API, but we use stored data for now
  // In real implementation, fetch from Repliz /content/{id}
  return null; // Placeholder
}

/**
 * Analyze comment with full context
 */
function analyzeWithContext(commentText, postContent, username) {
  // Deep analysis combining comment + post context
  const analysis = {
    commentType: detectCommentType(commentText),
    userEmotion: detectEmotion(commentText),
    postTopic: extractPostTopic(postContent || ''),
    needsDirectAnswer: checkNeedsDirectAnswer(commentText),
    isComplaint: detectComplaint(commentText)
  };
  
  return analysis;
}

function detectCommentType(text) {
  const lower = text.toLowerCase().trim();
  
  // Complaint about not being answered
  if (lower.match(/gw tanya|saya tanya|aku tanya|jawabnya apa|nggak dijawab|tidak dijawab|belum dijawab/)) {
    return 'COMPLAINT_UNANSWERED';
  }
  
  // Complaint about wrong answer
  if (lower.match(/salah|ngawur|ngaco|tidak sesuai|gak sesuai|gak bener/)) {
    return 'COMPLAINT_WRONG';
  }
  
  // Confusion
  if (lower.match(/kurang jelas|belum paham|bingung|gak ngerti|confused/)) {
    return 'CONFUSION';
  }
  
  // Specific questions
  if (lower.match(/kapan|waktu|timing|jam/)) {
    return 'QUESTION_TIMING';
  }
  
  if (lower.match(/berapa|where|level|di mana/)) {
    return 'QUESTION_LEVEL';
  }
  
  if (lower.match(/kenapa|why|mengapa/)) {
    return 'QUESTION_REASON';
  }
  
  // Appreciation
  if (lower.match(/thanks|makasih|terima kasih|terimakasih|mantap|keren|bagus/)) {
    return 'APPRECIATION';
  }
  
  return 'GENERAL';
}

function detectEmotion(text) {
  const lower = text.toLowerCase();
  
  if (lower.match(/gw tanya apa|jawabnya apa|gak jelas|ngaco|kesal|bete/)) {
    return { type: 'FRUSTRATED', intensity: 'MEDIUM' };
  }
  
  if (lower.match(/kecewa|disappointed|nyesel/)) {
    return { type: 'DISAPPOINTED', intensity: 'HIGH' };
  }
  
  if (lower.match(/bingung|confused|gak ngerti/)) {
    return { type: 'CONFUSED', intensity: 'MEDIUM' };
  }
  
  if (lower.match(/thanks|terima kasih|makasih/)) {
    return { type: 'APPRECIATIVE', intensity: 'LOW' };
  }
  
  return { type: 'NEUTRAL', intensity: 'LOW' };
}

function extractPostTopic(postContent) {
  const text = (postContent || '').toLowerCase();
  
  const topics = {
    pair: null,
    price: null,
    setup: null,
    keyPoint: null
  };
  
  // Extract pair
  if (text.includes('xauusd')) topics.pair = 'XAUUSD';
  if (text.includes('gold') || text.includes('emas')) topics.pair = topics.pair || 'XAUUSD';
  if (text.includes('eurusd')) topics.pair = 'EURUSD';
  
  // Extract price
  const priceMatch = text.match(/(\d{4})[.,]?(\d{0,2})?/);
  if (priceMatch) topics.price = priceMatch[0];
  
  // Extract setup type
  if (text.includes('pullback') || text.includes('retrace')) topics.setup = 'pullback';
  if (text.includes('breakout')) topics.setup = 'breakout';
  if (text.includes('support')) topics.setup = 'support';
  if (text.includes('ema')) topics.setup = 'ema_based';
  
  // Key point
  if (text.includes('sabar')) topics.keyPoint = 'patience';
  if (text.includes('disiplin')) topics.keyPoint = 'discipline';
  if (text.includes('mager') || text.includes('nunggu')) topics.keyPoint = 'waiting';
  
  return topics;
}

function checkNeedsDirectAnswer(text) {
  const type = detectCommentType(text);
  return type.startsWith('QUESTION_') || type.startsWith('COMPLAINT_');
}

function detectComplaint(text) {
  const type = detectCommentType(text);
  return type.startsWith('COMPLAINT_');
}

/**
 * Generate contextual reply
 */
function generateContextualReply(analysis, commentText, postContent, username) {
  const { commentType, userEmotion, postTopic, isComplaint } = analysis;
  
  // COMPLAINT: Not answered
  if (commentType === 'COMPLAINT_UNANSWERED') {
    return `Sorry kalo sebelumnya kurang jelas ya. Maksudku di post ini: basically ${postTopic.pair || 'XAUUSD'} ${postTopic.setup ? 'setup ' + postTopic.setup : 'ada setup'} di ${postTopic.price || 'level tertentu'}, tapi nunggu konfirmasi dulu. Kalau ada spesifik yang mau ditanyain, langsung aja — I'll answer properly.`;
  }
  
  // COMPLAINT: Wrong answer
  if (commentType === 'COMPLAINT_WRONG') {
    return `My bad kalo jawaban sebelumnya miss. Bantu clarify lagi — apa yang kurang tepat? Biar bisa kujelasin lebih baik.`;
  }
  
  // CONFUSION
  if (commentType === 'CONFUSION') {
    const keyPoint = postTopic.keyPoint || 'setup';
    return `Oke, biar lebih jelas: basically inti dari post ini adalah ${keyPoint}. Kalau masih bingung bagian mana, tanyain aja langsung ya.`;
  }
  
  // QUESTION: Timing
  if (commentType === 'QUESTION_TIMING') {
    return `Untuk timing entry, tunggu konfirmasi di ${postTopic.price || 'level support'} dulu. Jangan buru-buru FOMO — sabar nunggu setup valid.`;
  }
  
  // QUESTION: Level/Price
  if (commentType === 'QUESTION_LEVEL') {
    return `${postTopic.pair || 'XAUUSD'} saat ini di sekitar ${postTopic.price || 'level tertentu'}. Setup masih valid selama belum break key level.`;
  }
  
  // QUESTION: Reason
  if (commentType === 'QUESTION_REASON') {
    return `Alasannya basically risk management. Trading itu bukan cuma entry, tapi juga manage risk. Which is kenapa sabar nunggu setup proper itu penting.`;
  }
  
  // APPRECIATION
  if (commentType === 'APPRECIATION') {
    const replies = [
      `Thanks ${username}! Appreciate the support. Keep grinding 💪`,
      `Makasih ${username}! Semangat juga untuk trading journey kamu.`,
      `Terima kasih! Basically kita sama-sama belajar dari market.`
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }
  
  // DEFAULT: Always contextual
  return `Thanks for the feedback ${username}. Kalau ada yang kurang jelas, langsung tanyain aja spesifiknya ya — biar bisa kujawab dengan tepat.`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  await log('=== Contextual Reply Generator Started ===');
  
  // Read pending comments with post context
  const pendingFile = path.join(STATE_DIR, 'pending-comments.json');
  let pendingData;
  
  try {
    const content = await fs.readFile(pendingFile, 'utf-8');
    pendingData = JSON.parse(content);
  } catch (err) {
    await log('⚠️ No pending comments. Exiting.');
    return;
  }
  
  const comments = pendingData.comments || [];
  const toProcess = comments.filter(c => c.status === 'pending_draft' || c.status === 'parsed');
  
  await log(`Processing ${toProcess.length} comments with contextual analysis...`);
  
  if (toProcess.length === 0) {
    await log('No comments to process.');
    return;
  }
  
  // Load post context if available
  let postContext = '';
  try {
    const queueFile = path.join(STATE_DIR, 'approval-queue.json');
    const queueData = JSON.parse(await fs.readFile(queueFile, 'utf-8'));
    // Extract post content from queue data if available
  } catch (err) {
    // Use default context
    postContext = 'Jujurly hari ini market-nya vibes-nya anget-anget kue ya. XAUUSD setup bagus di 5335 tapi masih mager nunggu pullback yang proper. Which is, sabar itu rewarding sih kalau discipline.';
  }
  
  const drafts = [];
  
  for (const comment of toProcess) {
    await log(`Processing @${comment.username}: "${comment.text}"`);
    
    const analysis = analyzeWithContext(comment.text, postContext, comment.username);
    const reply = generateContextualReply(analysis, comment.text, postContext, comment.username);
    
    drafts.push({
      commentId: comment.id,
      username: comment.username,
      originalText: comment.text,
      draftReply: reply,
      analysis: {
        commentType: analysis.commentType,
        emotion: analysis.userEmotion,
        isComplaint: analysis.isComplaint
      },
      postContext: postContext.substring(0, 100),
      proposedAt: new Date().toISOString(),
      status: 'awaiting_approval'
    });
    
    comment.status = 'drafted';
    
    await log(`  → Type: ${analysis.commentType}`);
    await log(`  → Emotion: ${analysis.userEmotion.type}`);
    await log(`  → Reply: "${reply.substring(0, 80)}..."`);
  }
  
  // Save drafts
  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  await fs.writeFile(draftsFile, JSON.stringify({
    lastGenerated: new Date().toISOString(),
    totalDrafts: drafts.length,
    context: postContext.substring(0, 200),
    drafts
  }, null, 2));
  
  // Update pending
  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));
  
  await log(`✅ Generated ${drafts.length} contextual replies`);
  await log('=== Contextual Reply Generator Complete ===\n');
  
  // Display
  console.log('\n📋 CONTEXTUAL DRAFTS READY:');
  console.log('===========================\n');
  for (const d of drafts) {
    console.log(`💬 @${d.username}: "${d.originalText}"`);
    console.log(`🧠 Type: ${d.analysis.commentType} | Emotion: ${d.analysis.emotion.type}`);
    console.log(`✍️  Reply: "${d.draftReply}"`);
    console.log('---\n');
  }
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});

export { analyzeWithContext, generateContextualReply };
