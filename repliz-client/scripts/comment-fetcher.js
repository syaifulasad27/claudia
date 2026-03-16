#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';
import { readJson, writeJson, ensureDir } from '../../packages/core/state-manager.js';
import { createLogger } from '../../packages/core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const stateDir = path.join(root, 'memory', 'repliz-social-state');
const log = createLogger('comment-fetcher');

const blockedRanges = [/[\u4E00-\u9FFF]/, /[\u3040-\u309F]/, /[\u30A0-\u30FF]/, /[\uAC00-\uD7AF]/, /[\u0600-\u06FF]/, /[\u0590-\u05FF]/, /[\u0E00-\u0E7F]/, /[\u0900-\u097F]/];
const spamKeywords = ['check my bio', 'dm for signal', 'wa.me/', 'telegram.me/', 'free signal', 'promo', 'diskon'];

function containsForeignChars(text) {
  return blockedRanges.some((range) => range.test(String(text || '')));
}

function isSpam(text) {
  const lower = String(text || '').toLowerCase();
  return spamKeywords.some((keyword) => lower.includes(keyword));
}

function classifyComment(text) {
  const lower = String(text || '').toLowerCase();
  if (isSpam(lower)) return 'spam';
  if (/(harga|price|paket|join|daftar|service|jasa|demo|consult|konsultasi)/.test(lower)) return 'product_question';
  if (/(dm|beli|order|tertarik|mau dong|boleh detail|info lebih lanjut)/.test(lower)) return 'potential_lead';
  if (/(salah|gagal|buruk|jelek|kecewa|complain|komplain)/.test(lower)) return 'complaint';
  return 'normal_comment';
}

await ensureDir(stateDir);
const client = new ReplizClient();
const init = await client.init();
if (!init.ok) {
  await log.warn('repliz init failed', init);
  process.exit(0);
}

const queueRes = await client.getQueue({ page: 1, limit: 50, status: 'pending' });
if (!queueRes.ok) {
  await log.warn('queue fetch failed', queueRes);
  process.exit(0);
}

const rawComments = queueRes.data?.docs || queueRes.data || [];
const comments = [];
for (const item of rawComments) {
  const commentData = item.comment || item;
  const text = commentData.text || commentData.description || '';
  if (containsForeignChars(text) || isSpam(text)) continue;
  const classification = classifyComment(text);
  comments.push({
    id: item._id || item.id,
    username: commentData.owner?.name || commentData.owner?.username || 'unknown',
    text,
    category: classification,
    classification,
    postId: item.content?.id || item.content?._id || 'unknown',
    postContext: {
      title: item.content?.title || item.post?.title || '',
      text: item.content?.description || item.content?.text || item.post?.description || item.post?.text || '',
      url: item.content?.url || item.post?.url || '',
    },
    threadContext: {
      existingReplyCount: Array.isArray(commentData.replies) ? commentData.replies.length : 0,
    },
    status: 'pending_draft',
    fetchedAt: new Date().toISOString(),
  });
}

await writeJson(path.join(stateDir, 'pending-comments.json'), {
  lastFetch: new Date().toISOString(),
  totalFetched: rawComments.length,
  validComments: comments.length,
  comments,
});

const performance = await readJson(path.join(root, 'memory', 'content-performance.json'), { metrics: {} });
performance.metrics = {
  ...(performance.metrics || {}),
  engagement_rate: performance.metrics?.engagement_rate || 0.04,
  new_leads: performance.metrics?.new_leads || 0,
  content_posts: performance.metrics?.content_posts || 0,
};
await writeJson(path.join(root, 'memory', 'content-performance.json'), performance);

await log.info('comment queue updated', { totalFetched: rawComments.length, validComments: comments.length });
console.log(JSON.stringify({ ok: true, count: comments.length }, null, 2));



