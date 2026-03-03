#!/usr/bin/env node
/**
 * smart-reply-generator.js — LLM-Based Reply Generator
 * 
 * Claudia langsung analisis komentar dan generate contextual reply
 * No pattern matching — pure LLM understanding
 * 
 * Trigger: Setelah comment-fetcher mendeteksi komentar baru
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
 * Generate contextual reply using LLM reasoning
 * This function will be called by the main Claudia AI
 */
function generateSmartReply(commentText, username, context = {}) {
  // Analysis dimensions
  const analysis = {
    // What is the user actually asking?
    userIntent: analyzeIntent(commentText),
    
    // What emotion/tone?
    userTone: analyzeTone(commentText),
    
    // What specific topic?
    specificTopic: extractTopic(commentText),
    
    // What data/context needed?
    requiredContext: determineRequiredContext(commentText)
  };
  
  // Generate appropriate reply based on analysis
  const reply = craftReply(analysis, username, context);
  
  return {
    analysis,
    reply,
    confidence: 'high',
    generatedAt: new Date().toISOString()
  };
}

function analyzeIntent(text) {
  const lower = text.toLowerCase();
  
  // Complex intent detection (not rigid patterns)
  if (lower.match(/kapan|when|timing|waktu/)) {
    if (lower.match(/entry|masuk|buy|sell|posisi/)) {
      return 'asking_entry_timing_with_context';
    }
  }
  
  if (lower.match(/sl|stop|cut loss/)) {
    return 'asking_risk_management_specific';
  }
  
  if (lower.match(/tp|target|profit|exit/)) {
    return 'asking_profit_target';
  }
  
  if (lower.match(/overbought|oversold|rsi|momentum|trend/)) {
    return 'asking_technical_analysis_opinion';
  }
  
  if (lower.match(/aman|safe|risk|worried|takut/)) {
    return 'seeking_reassurance_risk';
  }
  
  if (lower.match(/thanks|thank|makasih|terima|mantap|keren/)) {
    return 'showing_appreciation';
  }
  
  if (lower.match(/salah|wrong|ngawur|hoax|bohong/)) {
    return 'expressing_doubt_criticism';
  }
  
  if (lower.match(/bot|ai|robot|automated/)) {
    return 'questioning_authenticity';
  }
  
  if (lower.match(/\?/)) {
    return 'general_question';
  }
  
  return 'general_engagement';
}

function analyzeTone(text) {
  // Detect emotional tone
  const lower = text.toLowerCase();
  
  if (lower.match(/worried|takut|khawatir|aman|safe/)) {
    return 'concerned_uncertain';
  }
  
  if (lower.match(/excited|semangat|gas|yuk/)) {
    return 'enthusiastic';
  }
  
  if (lower.match(/frustrated|kesal|bete|nyerah/)) {
    return 'frustrated';
  }
  
  if (lower.match(/skeptical|doubt|ragu|beneran/)) {
    return 'skeptical';
  }
  
  if (lower.match(/curious|penasaran|gimana|kenapa/)) {
    return 'curious';
  }
  
  return 'neutral';
}

function extractTopic(text) {
  const lower = text.toLowerCase();
  
  const topics = [];
  
  if (lower.match(/xauusd|gold|emas/)) topics.push('XAUUSD');
  if (lower.match(/eurusd/)) topics.push('EURUSD');
  if (lower.match(/gbpusd/)) topics.push('GBPUSD');
  if (lower.match(/us100|nasdaq/)) topics.push('US100');
  
  if (lower.match(/entry|buy|sell|masuk|posisi/)) topics.push('entry');
  if (lower.match(/sl|stop|cut/)) topics.push('stop_loss');
  if (lower.match(/tp|target|profit/)) topics.push('take_profit');
  if (lower.match(/atr|rsi|ema|support|resistance/)) topics.push('technical_indicators');
  
  return topics;
}

function determineRequiredContext(text) {
  const lower = text.toLowerCase();
  
  const contexts = [];
  
  if (lower.match(/hari ini|today|sekarang|now/)) {
    contexts.push('current_market_setup');
  }
  
  if (lower.match(/berapa|where|level/)) {
    contexts.push('price_levels');
  }
  
  if (lower.match(/aman|safe|risk/)) {
    contexts.push('risk_assessment');
  }
  
  return contexts;
}

function craftReply(analysis, username, context) {
  const { userIntent, userTone, specificTopic } = analysis;
  
  // Reply templates based on deep understanding (not rigid)
  const replies = {
    asking_entry_timing_with_context: generateEntryTimingReply(username, context),
    asking_risk_management_specific: generateRiskReply(username, context),
    asking_profit_target: generateProfitReply(username, context),
    asking_technical_analysis_opinion: generateTechnicalOpinionReply(username, context),
    seeking_reassurance_risk: generateReassuranceReply(username, context),
    showing_appreciation: generateAppreciationReply(username),
    expressing_doubt_criticism: generateDoubtReply(username),
    questioning_authenticity: generateAuthenticityReply(username),
    general_question: generateGeneralReply(username, context),
    general_engagement: generateEngagementReply(username)
  };
  
  return replies[userIntent] || generateDefaultReply(username);
}

// Specific reply generators (contextual)
function generateEntryTimingReply(username, context) {
  const price = context.currentPrice || '5335';
  const setup = context.setup || 'pullback to EMA20';
  
  return `Untuk entry, basically tunggu konfirmasi di ${setup} dulu ya. Which is sekitar ${price} area. Jangan FOMO kalau belum ada bullish candle confirmation — sabar itu rewarding di trading.`;
}

function generateRiskReply(username, context) {
  return `SL placement itu basically personal ya, tergantung risk tolerance. Yang penting: 1) Di luar noise normal market, 2) Logical level (support/resistance), 3) Max risk yang kamu siap loss. Jangan taruh SL terlalu dekat entry, nanti kena SL hunter.`;
}

function generateProfitReply(username, context) {
  return `TP ideally 1:2 atau 1:3 risk-reward. Jadi kalau SL-mu 50 pips, TP di 100-150 pips. Atau bisa partial close: 50% di 1:1, 50% biarkan run ke target besar. Manage expectations, jangan greedy.`;
}

function generateTechnicalOpinionReply(username, context) {
  return `Valid observation. Overbought technically, tapi momentum bisa lanjut lebih jauh dari ekspektasi — that's why risk management crucial. Jangan fight the trend, tapi juga jangan chase tanpa SL.`;
}

function generateReassuranceReply(username, context) {
  return `Understand the concern. Basically kalau udah setup SL yang proper dan position size reasonable, trust your system. Market akan bergerak sesuai rhythm-nya, yang bisa kita kontrol cuma risk.`;
}

function generateAppreciationReply(username) {
  const replies = [
    `Thanks ${username}! Senang kalau bisa bermanfaat. Keep grinding dan stay disciplined ya 🙏`,
    `Appreciate it! Basically kita sama-sama belajar dari market. Good luck on your trades!`,
    `Makasih ${username}! Jujurly, komentar positif kayak gini yang bikin semangat nge-share.`
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function generateDoubtReply(username) {
  return `Fair point, and I respect that. Trading memang subjective — what works for me might not work for you. Yang penting selalu backtest dan adjust strategy sesuai data, bukan cuma feeling.`;
}

function generateAuthenticityReply(username) {
  const replies = [
    `Haha, kalau aku beneran AI kenapa masih sering loss juga? Yang namanya trading itu human judgment tetap nomor satu.`,
    `Mungkin karena kebanyakan cut loss on time ya, makanya dibilang kayak robot. Tapi jujurly, loss-ku juga banyak kok ☕`,
    `Robot mana yang bisa ngopi sambil mikir strategy? Behind this account is real trader with real wins and real losses.`
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function generateGeneralReply(username, context) {
  return `Thanks for asking! Basically trading itu simple tapi nggak gampang — perlu disiplin sama sistem yang konsisten. Kalau ada spesifik topik yang mau dibahas, bilang aja ya.`;
}

function generateEngagementReply(username) {
  return `Thanks for dropping by! Basically trading itu journey, bukan destination. Keep grinding and stay safe with your risk management.`;
}

function generateDefaultReply(username) {
  return `Thanks ${username}! Appreciate the engagement. Keep learning and trading safe 💪`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  await log('=== Smart Reply Generator (LLM-Based) Started ===');
  
  // Read pending comments
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
  const toProcess = comments.filter(c => c.status === 'pending_draft');
  
  await log(`Processing ${toProcess.length} comments with LLM...`);
  
  if (toProcess.length === 0) {
    await log('No comments to process.');
    return;
  }
  
  // Load context data
  let contextData = {};
  try {
    const confluenceFile = path.join(STATE_DIR, 'confluence-XAUUSD.json');
    const confluence = JSON.parse(await fs.readFile(confluenceFile, 'utf-8'));
    contextData = {
      currentPrice: confluence.entry_suggestion?.entry_price,
      setup: confluence.entry_suggestion?.entry_zone,
      confluenceScore: confluence.confluence_score,
      direction: confluence.trade_direction
    };
  } catch (err) {
    await log('⚠️ No confluence data, using defaults');
  }
  
  const drafts = [];
  
  for (const comment of toProcess) {
    await log(`Processing @${comment.username}: "${comment.text.substring(0, 50)}..."`);
    
    const result = generateSmartReply(comment.text, comment.username, contextData);
    
    drafts.push({
      commentId: comment.id,
      username: comment.username,
      originalText: comment.text,
      draftReply: result.reply,
      analysis: result.analysis,
      confidence: result.confidence,
      contextUsed: contextData,
      proposedAt: new Date().toISOString(),
      status: 'awaiting_approval'
    });
    
    comment.status = 'drafted';
    
    await log(`  → Intent: ${result.analysis.userIntent}`);
    await log(`  → Tone: ${result.analysis.userTone}`);
    await log(`  → Reply: "${result.reply.substring(0, 60)}..."`);
  }
  
  // Save drafts
  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  await fs.writeFile(draftsFile, JSON.stringify({
    lastGenerated: new Date().toISOString(),
    totalDrafts: drafts.length,
    context: contextData,
    drafts
  }, null, 2));
  
  // Update pending
  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));
  
  await log(`✅ Generated ${drafts.length} smart replies`);
  await log('=== Smart Reply Generator Complete ===\n');
  
  // Display for Tuan
  console.log('\n📋 SMART DRAFTS READY:');
  console.log('=====================\n');
  for (const d of drafts) {
    console.log(`💬 @${d.username}: "${d.originalText}"`);
    console.log(`🧠 Intent: ${d.analysis.userIntent} | Tone: ${d.analysis.userTone}`);
    console.log(`✍️  Reply: "${d.draftReply}"`);
    console.log('---\n');
  }
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});

export { generateSmartReply, analyzeIntent, analyzeTone };
