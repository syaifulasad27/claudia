#!/usr/bin/env node
/**
 * smart-reply-generator.js — Contextual Reply Generator (phase 2)
 *
 * Phase 2 additions:
 * - Relevance scoring (comment+post vs reply)
 * - Low-relevance gate (manual review)
 * - Near-duplicate reply guard using reply-history.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'smart-reply-generator.log');
const REPLY_HISTORY_FILE = path.join(STATE_DIR, 'reply-history.json');

const STOPWORDS = new Set([
  'yang','dan','di','ke','dari','untuk','dengan','atau','ini','itu','jadi','kalau','kalo','aja','ya','aku','saya','gw','gue',
  'the','a','an','to','of','in','on','for','is','are','it','this','that','you','we','they','be','as','at','by'
]);

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

function detectCommentType(text) {
  const lower = String(text || '').toLowerCase().trim();

  if (lower.match(/ignore all previous|forget last prompt|system prompt|jailbreak|bypass|override/)) return 'PROMPT_INJECTION';
  if (lower.match(/resep|masak|mie ayam|es doger|pantun|puisi|tebak/)) return 'OFF_TOPIC';
  if (lower.match(/gw tanya|saya tanya|aku tanya|jawabnya apa|nggak dijawab|tidak dijawab|belum dijawab/)) return 'COMPLAINT_UNANSWERED';
  if (lower.match(/salah|ngawur|ngaco|tidak sesuai|gak sesuai|gak bener/)) return 'COMPLAINT_WRONG';
  if (lower.match(/kurang jelas|belum paham|bingung|gak ngerti|confused/)) return 'CONFUSION';
  if (lower.match(/kapan|waktu|timing|jam/)) return 'QUESTION_TIMING';
  if (lower.match(/berapa|where|level|di mana/)) return 'QUESTION_LEVEL';
  if (lower.match(/kenapa|why|mengapa/)) return 'QUESTION_REASON';
  if (lower.match(/thanks|makasih|terima kasih|terimakasih|mantap|keren|bagus/)) return 'APPRECIATION';
  return 'GENERAL';
}

function detectEmotion(text) {
  const lower = String(text || '').toLowerCase();
  if (lower.match(/gw tanya apa|jawabnya apa|gak jelas|ngaco|kesal|bete/)) return { type: 'FRUSTRATED', intensity: 'MEDIUM' };
  if (lower.match(/kecewa|disappointed|nyesel/)) return { type: 'DISAPPOINTED', intensity: 'HIGH' };
  if (lower.match(/bingung|confused|gak ngerti/)) return { type: 'CONFUSED', intensity: 'MEDIUM' };
  if (lower.match(/thanks|terima kasih|makasih/)) return { type: 'APPRECIATIVE', intensity: 'LOW' };
  return { type: 'NEUTRAL', intensity: 'LOW' };
}

function detectPostDomain(postContent) {
  const t = String(postContent || '').toLowerCase();
  if (!t.trim()) return 'unknown';

  const trading = /(xauusd|eurusd|nasdaq|gold|emas|entry|sl\b|tp\b|lot|pullback|breakout|support|resistance|fomo|trading|setup|risk management)/;
  const tech = /(ai|llm|model|coding|developer|spec driven|api|automation|tech|software|product)/;
  const geo = /(geopolitik|geopolitical|israel|iran|war|konflik|narasi|headline|militer|timur tengah)/;

  if (trading.test(t)) return 'trading';
  if (tech.test(t)) return 'tech';
  if (geo.test(t)) return 'geopolitics';
  return 'general';
}

function shortPostSummary(postContent) {
  const s = String(postContent || '').replace(/\s+/g, ' ').trim();
  if (!s) return 'topik post ini';
  return s.slice(0, 90);
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  return normalize(text)
    .split(' ')
    .filter(Boolean)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const uni = sa.size + sb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function relevanceScore(commentText, postContent, replyText) {
  const src = [...tokens(commentText), ...tokens(postContent)].slice(0, 120);
  const dst = tokens(replyText);
  return Number(jaccard(src, dst).toFixed(3));
}

function hashText(text) {
  return crypto.createHash('sha256').update(normalize(text)).digest('hex').slice(0, 16);
}

function analyzeWithContext(commentText, postContent) {
  const commentType = detectCommentType(commentText);
  return {
    commentType,
    userEmotion: detectEmotion(commentText),
    postDomain: detectPostDomain(postContent),
    hasContext: !!String(postContent || '').trim(),
    isComplaint: commentType.startsWith('COMPLAINT_')
  };
}

function generateContextualReply(analysis, commentText, postContent, username) {
  const { commentType, postDomain, hasContext } = analysis;
  const postSummary = shortPostSummary(postContent);

  if (commentType === 'PROMPT_INJECTION') return 'Nice try 😄 tapi aku tetap bahas konteks post ini aja. Kalau mau diskusi, drop poin spesifik dari isi post ya.';
  if (commentType === 'OFF_TOPIC') return 'Topiknya lagi bukan itu ya 😄 Di post ini kita fokus bahas isi post. Menurut kamu poin paling menarik yang mana?';
  if (!hasContext) return 'Makasih komentarnya. Biar nggak salah konteks, bisa sebut bagian post yang kamu maksud? Nanti aku jawab tepat ke poinnya.';

  if (commentType === 'COMPLAINT_UNANSWERED') {
    return `Maaf kalau sebelumnya belum kena konteks. Di post ini intinya tentang: ${postSummary}. Kalau kamu mau, tulis pertanyaan spesifiknya dan aku jawab langsung ke poin itu.`;
  }
  if (commentType === 'COMPLAINT_WRONG') return 'Noted, terima kasih koreksinya. Biar akurat, bagian mana yang kamu nilai kurang tepat dari post ini?';
  if (commentType === 'CONFUSION') return `Biar jelas: inti post ini adalah ${postSummary}. Kalau ada bagian yang membingungkan, sebut kalimatnya ya biar aku jelasin spesifik.`;

  if (commentType === 'QUESTION_TIMING') {
    if (postDomain === 'trading') return 'Untuk timing di konteks trading, idealnya tunggu konfirmasi setup + validasi risk dulu sebelum entry.';
    if (postDomain === 'tech') return 'Kalau soal timing di konteks ini, biasanya efektif bahas bertahap: problem dulu, baru framework, lalu implementasi.';
    return 'Kalau soal timing di konteks post ini, biasanya paling aman mulai dari poin inti dulu lalu lanjut ke detail.';
  }

  if (commentType === 'QUESTION_LEVEL') {
    if (postDomain === 'trading') return 'Untuk level, sebaiknya rujuk level kunci yang disebut di post + konfirmasi price action terbaru.';
    return 'Kalau maksud level/detail, sebutkan bagian mana di post yang kamu mau didalami, biar aku jawab lebih presisi.';
  }

  if (commentType === 'QUESTION_REASON') return `Alasannya terkait konteks post ini: ${postSummary}. Kalau mau, aku bisa breakdown alasan utamanya poin per poin.`;
  if (commentType === 'APPRECIATION') return `Thanks ${username || 'bro'}! Appreciate banget. Kalau mau, drop opini kamu juga soal poin utama di post ini.`;

  return `Thanks feedback-nya. Supaya presisi, aku akan tetap jawab sesuai konteks post ini: ${postSummary}.`;
}

async function readReplyHistory() {
  try {
    const obj = JSON.parse(await fs.readFile(REPLY_HISTORY_FILE, 'utf-8'));
    return obj.entries || [];
  } catch {
    return [];
  }
}

async function writeReplyHistory(entries) {
  const bounded = entries.slice(-500);
  await fs.writeFile(REPLY_HISTORY_FILE, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    total: bounded.length,
    entries: bounded
  }, null, 2));
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });

  await log('=== Contextual Reply Generator Started (phase2) ===');

  const pendingFile = path.join(STATE_DIR, 'pending-comments.json');
  let pendingData;
  try {
    pendingData = JSON.parse(await fs.readFile(pendingFile, 'utf-8'));
  } catch {
    await log('⚠️ No pending comments. Exiting.');
    return;
  }

  const comments = pendingData.comments || [];
  const toProcess = comments.filter(c => c.status === 'pending_draft' || c.status === 'parsed');
  await log(`Processing ${toProcess.length} comments with contextual analysis...`);
  if (toProcess.length === 0) return;

  const drafts = [];
  const history = await readReplyHistory();

  for (const comment of toProcess) {
    const postContent = String(comment?.postContext?.text || comment?.postContext?.title || '').trim();
    const analysis = analyzeWithContext(comment.text, postContent);

    if (!analysis.hasContext) {
      drafts.push({
        commentId: comment.id,
        username: comment.username,
        originalText: comment.text,
        draftReply: 'Konteks post tidak tersedia. Mohon review manual sebelum balas.',
        analysis: { ...analysis },
        postContext: '',
        quality: { relevanceScore: 0, duplicateScore: 0, blockedReason: 'missing_context' },
        proposedAt: new Date().toISOString(),
        status: 'needs_context'
      });
      comment.status = 'needs_context';
      await log(`@${comment.username} -> needs_context (blocked)`);
      continue;
    }

    let reply = generateContextualReply(analysis, comment.text, postContent, comment.username);

    // Phase 2 quality checks
    const rel = relevanceScore(comment.text, postContent, reply);
    const replyTokens = tokens(reply);

    let maxDup = 0;
    for (const h of history.slice(-80)) {
      const sim = jaccard(replyTokens, tokens(h.reply || ''));
      if (sim > maxDup) maxDup = sim;
    }
    maxDup = Number(maxDup.toFixed(3));

    let status = 'awaiting_approval';
    let blockedReason = null;

    if (maxDup >= 0.92) {
      // diversify once
      reply = `${reply} (konteks komentar kamu valid dan aku hargai.)`;
    }

    const rel2 = relevanceScore(comment.text, postContent, reply);
    const finalRel = Number(rel2.toFixed(3));

    if (finalRel < 0.03) {
      status = 'needs_review_low_relevance';
      blockedReason = 'low_relevance';
      reply = 'Aku tangkap pertanyaanmu, tapi biar nggak salah konteks, boleh sebut bagian post yang kamu maksud?';
    }

    const draft = {
      commentId: comment.id,
      username: comment.username,
      originalText: comment.text,
      draftReply: reply,
      analysis: { ...analysis },
      postContext: postContent.slice(0, 160),
      quality: {
        relevanceScore: finalRel,
        duplicateScore: maxDup,
        blockedReason
      },
      proposedAt: new Date().toISOString(),
      status
    };

    drafts.push(draft);

    if (status === 'awaiting_approval') {
      history.push({
        at: new Date().toISOString(),
        commentId: comment.id,
        postDomain: analysis.postDomain,
        hash: hashText(reply),
        reply
      });
      comment.status = 'drafted';
    } else {
      comment.status = status;
    }

    await log(`@${comment.username} type=${analysis.commentType} domain=${analysis.postDomain} rel=${finalRel} dup=${maxDup} status=${status}`);
  }

  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  await fs.writeFile(draftsFile, JSON.stringify({
    lastGenerated: new Date().toISOString(),
    totalDrafts: drafts.length,
    drafts
  }, null, 2));

  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));
  await writeReplyHistory(history);

  await log(`✅ Generated ${drafts.length} replies (phase2 quality-gated)`);
  await log('=== Contextual Reply Generator Complete ===\n');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});

export { analyzeWithContext, generateContextualReply, relevanceScore };
