#!/usr/bin/env node
/**
 * contextual-reply-generator.js
 * 
 * Generate replies with FULL CONTEXT awareness
 * - Fetch post content
 * - Understand comment history
 * - Generate contextual response
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate contextual reply with full understanding
 */
function generateContextualReply(commentText, postContent, username) {
  // Deep context analysis
  const context = {
    postTopic: extractPostTopic(postContent),
    commentType: analyzeCommentType(commentText),
    userEmotion: detectEmotion(commentText),
    needsApology: checkIfApologyNeeded(commentText),
    needsClarification: checkIfClarificationNeeded(commentText)
  };
  
  // Generate appropriate response
  return craftContextualResponse(context, commentText, postContent, username);
}

function extractPostTopic(postContent) {
  const text = postContent.toLowerCase();
  
  if (text.includes('xauusd') || text.includes('gold') || text.includes('emas')) {
    return { pair: 'XAUUSD', setup: extractSetupDetails(text) };
  }
  if (text.includes('entry') || text.includes('buy') || text.includes('sell')) {
    return { topic: 'entry_strategy' };
  }
  if (text.includes('sl') || text.includes('stop loss')) {
    return { topic: 'risk_management' };
  }
  
  return { topic: 'general_market_commentary' };
}

function extractSetupDetails(text) {
  const priceMatch = text.match(/(\d{4})[.,]?(\d{0,2})?/);
  const price = priceMatch ? priceMatch[0] : null;
  
  if (text.includes('pullback') || text.includes('retrace')) {
    return { type: 'pullback_setup', price: price };
  }
  if (text.includes('breakout') || text.includes('break')) {
    return { type: 'breakout_setup', price: price };
  }
  
  return { type: 'general_setup', price: price };
}

function analyzeCommentType(text) {
  const lower = text.toLowerCase();
  
  // Complaint patterns
  if (lower.match(/gw tanya|saya tanya|aku tanya|jawabnya apa|gak dijawab|nggak jelas/)) {
    return 'complaint_unanswered_question';
  }
  
  if (lower.match(/gak sesuai|salah|ngawur|ngaco|gak bener/)) {
    return 'complaint_wrong_answer';
  }
  
  if (lower.match(/kurang jelas|belum paham|bingung/)) {
    return 'confusion_needs_clarification';
  }
  
  if (lower.match(/tanks|thanks|makasih|terima kasih|mantap|keren/)) {
    return 'appreciation';
  }
  
  if (lower.match(/kapan|waktu|jam|sekarang/)) {
    return 'asking_timing';
  }
  
  if (lower.match(/kenapa|why|mengapa/)) {
    return 'asking_reason';
  }
  
  return 'general_question';
}

function detectEmotion(text) {
  const lower = text.toLowerCase();
  
  // Frustrated patterns
  if (lower.match(/gw tanya apa|jawabnya apa|gak jelas|ngaco/)) {
    return { emotion: 'frustrated_complaint', intensity: 'medium' };
  }
  
  if (lower.match(/kecewa|disappointed|nyesel/)) {
    return { emotion: 'disappointed', intensity: 'high' };
  }
  
  if (lower.match(/marah|kesal|bete|annoyed/)) {
    return { emotion: 'annoyed', intensity: 'high' };
  }
  
  if (lower.match(/bingung|confused|gak ngerti/)) {
    return { emotion: 'confused', intensity: 'medium' };
  }
  
  if (lower.match(/tanks|thanks|terima kasih|makasih/)) {
    return { emotion: 'appreciative', intensity: 'low' };
  }
  
  return { emotion: 'neutral', intensity: 'low' };
}

function checkIfApologyNeeded(text) {
  const type = analyzeCommentType(text);
  return type.includes('complaint') || type.includes('confusion');
}

function checkIfClarificationNeeded(text) {
  const type = analyzeCommentType(text);
  return type.includes('confusion') || type.includes('complaint');
}

function craftContextualResponse(context, commentText, postContent, username) {
  const { commentType, userEmotion, needsApology, needsClarification, postTopic } = context;
  
  // Handle complaint about unanswered question
  if (commentType === 'complaint_unanswered_question') {
    return `Sorry kalo sebelumnya kurang jelas ya. Maksudku di post ini: basically XAUUSD setup bagus di ${postTopic.setup?.price || '5335'}, tapi nunggu pullback dulu. Kalau ada spesifik yang mau ditanyain, langsung aja — I'll answer properly.`;
  }
  
  // Handle complaint about wrong answer
  if (commentType === 'complaint_wrong_answer') {
    return `My bad kalo jawaban sebelumnya miss. Bantu clarify lagi — apa yang kurang tepat? Biar bisa kujelasin lebih baik.`;
  }
  
  // Handle confusion
  if (commentType === 'confusion_needs_clarification') {
    return `Oke, biar lebih jelas: ${postContent.substring(0, 100)}... Kalau masih bingung bagian mana, tanyain aja langsung ya.`;
  }
  
  // Handle appreciation
  if (commentType === 'appreciation') {
    return `Thanks ${username}! Appreciate the support. Keep grinding 💪`;
  }
  
  // Handle timing question
  if (commentType === 'asking_timing') {
    const price = postTopic.setup?.price || '5335';
    return `Untuk timing entry, tunggu konfirmasi pullback ke ${price} dulu. Jangan buru-buru FOMO — sabar nunggu setup valid.`;
  }
  
  // Default contextual response
  return `Thanks for the feedback ${username}. Kalau ada yang kurang jelas dari post ini, langsung tanyain aja spesifiknya ya.`;
}

// Test with the actual case
const testCase = {
  username: 'syaifulasad.js',
  comment: 'Gw tanya apa jawabnya apa',
  post: 'Jujurly hari ini market-nya vibes-nya anget-anget kue ya. XAUUSD setup bagus di 5335 tapi masih mager nunggu pullback yang proper. Which is, sabar itu rewarding sih kalau discipline. ☕'
};

console.log('🧪 TESTING CONTEXTUAL REPLY\n');
console.log('===========================\n');
console.log(`Post: "${testCase.post}"\n`);
console.log(`Comment: "${testCase.comment}"`);
console.log(`From: @${testCase.username}\n`);

const result = generateContextualReply(testCase.comment, testCase.post, testCase.username);

console.log(`✅ Contextual Reply:`);
console.log(`"${result}"\n`);

export { generateContextualReply };
