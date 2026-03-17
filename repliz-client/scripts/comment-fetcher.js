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

const blockedRanges = [/[^\x00-\x7F]/];
const spamKeywords = ['check my bio', 'dm for signal', 'wa.me/', 'telegram.me/', 'free signal', 'promo', 'diskon'];

function containsBlockedChars(text) {
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
  if (/(dm|beli|order|tertarik|mau dong|boleh detail|info lebih lanjut|audit|calendar|system|funnel|career)/.test(lower)) return 'potential_lead';
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
  if (containsBlockedChars(text) || isSpam(text)) continue;
  const classification = classifyComment(text);
  comments.push({
    id: item._id || item.id,
    username: commentData.owner?.name || commentData.owner?.username || 'unknown',
    text,
    category: classification,
    classification,
    postId: item.content?.id || item.content?._id || item.post?.id || 'unknown',
    postContext: {
      title: item.content?.title || item.post?.title || '',
      text: item.content?.description || item.content?.text || item.post?.description || item.post?.text || '',
      url: item.content?.url || item.post?.url || '',
      topic: item.content?.title || item.post?.title || '',
    },
    threadContext: {
      existingReplyCount: Array.isArray(commentData.replies) ? commentData.replies.length : 0,
    },
    channel: 'comment',
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

const performanceFile = path.join(root, 'memory', 'content-performance.json');
const performance = await readJson(performanceFile, { metrics: {} });
performance.generatedAt = new Date().toISOString();
performance.metrics = {
  ...(performance.metrics || {}),
  comments_total: comments.length,
  inbound_interactions: comments.length,
  engagement_events: comments.length,
  engagement_rate: performance.metrics?.content_posts > 0
    ? comments.length / Math.max(performance.metrics.content_posts, 1)
    : performance.metrics?.engagement_rate || 0,
};
await writeJson(performanceFile, performance);

const postPerfFile = path.join(root, 'memory', 'repliz-social-state', 'post-performance.json');
const postPerf = await readJson(postPerfFile, { posts: [] });
for (const comment of comments) {
  const related = postPerf.posts.find((post) => post.externalPostId === comment.postId || post.id === comment.postId || post.draftId === comment.postId);
  if (!related) continue;
  related.commentIds = Array.isArray(related.commentIds) ? related.commentIds : [];
  if (!related.commentIds.includes(comment.id)) {
    related.commentIds.push(comment.id);
    related.comments = (related.comments || 0) + 1;
    related.engagementEvents = (related.engagementEvents || 0) + 1;
    related.impressionsProxy = Math.max(related.impressionsProxy || 0, related.comments * 10);
    related.engagementRate = related.impressionsProxy > 0 ? related.engagementEvents / related.impressionsProxy : 0;
  }
}
await writeJson(postPerfFile, postPerf);

await log.info('comment queue updated', { totalFetched: rawComments.length, validComments: comments.length });
console.log(JSON.stringify({ ok: true, count: comments.length }, null, 2));
