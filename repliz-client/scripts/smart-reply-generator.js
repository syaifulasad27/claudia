#!/usr/bin/env node
/**
 * smart-reply-generator.js — Contextual Reply Generator (fixed)
 *
 * Key fixes:
 * - Use per-comment post context from pending-comments.json
 * - No trading fallback when context missing
 * - Topic-aware replies (trading/tech/geopolitics/general)
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

  if (commentType === 'PROMPT_INJECTION') {
    return 'Nice try 😄 tapi aku tetap bahas konteks post ini aja. Kalau mau diskusi, drop poin spesifik dari isi post ya.';
  }

  if (commentType === 'OFF_TOPIC') {
    return 'Topiknya lagi bukan itu ya 😄 Di post ini kita fokus bahas isi post. Menurut kamu poin paling menarik yang mana?';
  }

  if (!hasContext) {
    return 'Makasih komentarnya. Biar nggak salah konteks, bisa sebut bagian post yang kamu maksud? Nanti aku jawab tepat ke poinnya.';
  }

  if (commentType === 'COMPLAINT_UNANSWERED') {
    return `Maaf kalau sebelumnya belum kena konteks. Di post ini intinya tentang: ${postSummary}. Kalau kamu mau, tulis pertanyaan spesifiknya dan aku jawab langsung ke poin itu.`;
  }

  if (commentType === 'COMPLAINT_WRONG') {
    return `Noted, terima kasih koreksinya. Biar akurat, bagian mana yang kamu nilai kurang tepat dari post ini?`;
  }

  if (commentType === 'CONFUSION') {
    return `Biar jelas: inti post ini adalah ${postSummary}. Kalau ada bagian yang membingungkan, sebut kalimatnya ya biar aku jelasin spesifik.`;
  }

  if (commentType === 'QUESTION_TIMING') {
    if (postDomain === 'trading') {
      return 'Untuk timing di konteks trading, idealnya tunggu konfirmasi setup + validasi risk dulu sebelum entry.';
    }
    if (postDomain === 'tech') {
      return 'Kalau soal timing di konteks ini, biasanya efektif bahas bertahap: problem dulu, baru framework, lalu implementasi.';
    }
    return 'Kalau soal timing di konteks post ini, biasanya paling aman mulai dari poin inti dulu lalu lanjut ke detail.';
  }

  if (commentType === 'QUESTION_LEVEL') {
    if (postDomain === 'trading') return 'Untuk level, sebaiknya rujuk level kunci yang disebut di post + konfirmasi price action terbaru.';
    return 'Kalau maksud level/detail, sebutkan bagian mana di post yang kamu mau didalami, biar aku jawab lebih presisi.';
  }

  if (commentType === 'QUESTION_REASON') {
    return `Alasannya terkait konteks post ini: ${postSummary}. Kalau mau, aku bisa breakdown alasan utamanya poin per poin.`;
  }

  if (commentType === 'APPRECIATION') {
    const who = username || 'bro';
    return `Thanks ${who}! Appreciate banget. Kalau mau, drop opini kamu juga soal poin utama di post ini.`;
  }

  return `Thanks feedback-nya. Supaya presisi, aku akan tetap jawab sesuai konteks post ini: ${postSummary}.`;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });

  await log('=== Contextual Reply Generator Started ===');

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

  if (toProcess.length === 0) {
    await log('No comments to process.');
    return;
  }

  const drafts = [];

  for (const comment of toProcess) {
    const postContent = String(comment?.postContext?.text || comment?.postContext?.title || '').trim();
    const analysis = analyzeWithContext(comment.text, postContent);

    // Hard guard: if no context, do not auto-publish candidate.
    if (!analysis.hasContext) {
      drafts.push({
        commentId: comment.id,
        username: comment.username,
        originalText: comment.text,
        draftReply: 'Konteks post tidak tersedia. Mohon review manual sebelum balas.',
        analysis: {
          commentType: analysis.commentType,
          emotion: analysis.userEmotion,
          postDomain: analysis.postDomain,
          hasContext: false,
          isComplaint: analysis.isComplaint
        },
        postContext: '',
        proposedAt: new Date().toISOString(),
        status: 'needs_context'
      });
      comment.status = 'needs_context';
      await log(`@${comment.username} -> needs_context (blocked)`);
      continue;
    }

    const reply = generateContextualReply(analysis, comment.text, postContent, comment.username);

    drafts.push({
      commentId: comment.id,
      username: comment.username,
      originalText: comment.text,
      draftReply: reply,
      analysis: {
        commentType: analysis.commentType,
        emotion: analysis.userEmotion,
        postDomain: analysis.postDomain,
        hasContext: true,
        isComplaint: analysis.isComplaint
      },
      postContext: postContent.slice(0, 160),
      proposedAt: new Date().toISOString(),
      status: 'awaiting_approval'
    });

    comment.status = 'drafted';
    await log(`@${comment.username} type=${analysis.commentType} domain=${analysis.postDomain}`);
  }

  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  await fs.writeFile(draftsFile, JSON.stringify({
    lastGenerated: new Date().toISOString(),
    totalDrafts: drafts.length,
    drafts
  }, null, 2));

  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));

  await log(`✅ Generated ${drafts.length} replies (context-safe)`);
  await log('=== Contextual Reply Generator Complete ===\n');
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});

export { analyzeWithContext, generateContextualReply };
