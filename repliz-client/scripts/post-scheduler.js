#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { GROWTH_TARGETS, normalizeScheduledPost } from '../../packages/core/growth-recovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const QUEUE_FILE = path.join(__dirname, '..', 'content', 'scheduled', 'queue.json');
const POSTED_DIR = path.join(__dirname, '..', 'content', 'posted');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'scheduler.log');
const POST_PERF_FILE = path.join(root, 'memory', 'repliz-social-state', 'post-performance.json');
const CONTENT_PERF_FILE = path.join(root, 'memory', 'content-performance.json');

async function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  await fs.appendFile(LOG_FILE, logLine).catch(() => {});
}

async function archivePost(post) {
  await fs.mkdir(POSTED_DIR, { recursive: true });
  const archiveFile = path.join(POSTED_DIR, `${post.id}_${Date.now()}.json`);
  await fs.writeFile(archiveFile, JSON.stringify(post, null, 2));
}

function upsertPostMetric(posts, payload) {
  const index = posts.findIndex((item) => item.id === payload.id);
  if (index === -1) {
    posts.push(payload);
    return;
  }
  posts[index] = { ...posts[index], ...payload };
}

async function main() {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await log('Scheduler started');

  const queueData = await readJson(QUEUE_FILE, { queue: [], lastUpdated: null });
  const queue = (queueData.queue || []).map(normalizeScheduledPost);
  const now = new Date();
  const client = new ReplizClient();
  const init = await client.init();
  const postPerf = await readJson(POST_PERF_FILE, { generatedAt: null, posts: [] });
  const perf = await readJson(CONTENT_PERF_FILE, { generatedAt: null, targets: GROWTH_TARGETS, metrics: {} });

  let published = 0;
  let failed = 0;
  let duePending = 0;

  for (const post of queue) {
    const scheduledTime = post.scheduledFor ? new Date(post.scheduledFor) : now;
    const isDue = Number.isNaN(scheduledTime.getTime()) || scheduledTime.getTime() <= now.getTime();
    if (post.status === 'posted') continue;
    if (!isDue) continue;
    duePending += 1;

    if (!init.ok) {
      post.status = 'publish_failed';
      post.lastError = init.error || 'Repliz client init failed';
      failed += 1;
      continue;
    }

    try {
      const result = await client.createPost(post.content, { scheduleAt: now.toISOString() });
      if (result.ok) {
        post.status = 'posted';
        post.postedAt = new Date().toISOString();
        post.postId = result.data?._id || result.postId || result.data?.id || null;
        post.url = result.data?.url || result.url || null;
        published += 1;
        await archivePost(post);
        upsertPostMetric(postPerf.posts, {
          id: post.id,
          draftId: post.draftId || post.id,
          externalPostId: post.postId,
          url: post.url,
          topic: post.metadata?.topic || null,
          hookType: post.metadata?.hookType || 'problem_first',
          ctaKeyword: post.metadata?.ctaKeyword || null,
          scheduledFor: post.scheduledFor,
          publishedAt: post.postedAt,
          status: 'posted',
          impressions: 0,
          impressionsProxy: 0,
          likes: 0,
          comments: 0,
          dmSignals: 0,
          engagementEvents: 0,
          leadsCreated: 0,
          engagementRate: 0,
          outcome: 'tweak',
        });
        await log(`Published ${post.id}`);
      } else {
        post.status = 'publish_failed';
        post.lastError = result.error || result.reason || 'Unknown publish error';
        failed += 1;
        await log(`Failed ${post.id}: ${post.lastError}`);
      }
    } catch (error) {
      post.status = 'publish_failed';
      post.lastError = error.message;
      failed += 1;
      await log(`Error ${post.id}: ${error.message}`);
    }
  }

  const postedCount = queue.filter((item) => item.status === 'posted').length;
  const pendingCount = queue.filter((item) => item.status === 'pending').length;
  const publishAttempts = postedCount + failed;
  perf.generatedAt = new Date().toISOString();
  perf.targets = perf.targets || GROWTH_TARGETS;
  perf.metrics = {
    ...(perf.metrics || {}),
    content_posts: postedCount,
    published_posts_48h: postedCount,
    publish_attempts: publishAttempts,
    publish_success_rate: publishAttempts > 0 ? postedCount / publishAttempts : 0,
    queue_pending: pendingCount,
    due_queue_items: duePending,
    comments_total: perf.metrics?.comments_total || 0,
    inbound_interactions: perf.metrics?.inbound_interactions || 0,
    new_leads: perf.metrics?.new_leads || 0,
    impressions_proxy_total: perf.metrics?.impressions_proxy_total || 0,
    engagement_rate: perf.metrics?.engagement_rate || 0,
  };
  perf.publishHealth = {
    lastRunAt: new Date().toISOString(),
    published,
    failed,
    queuePending: pendingCount,
  };

  postPerf.generatedAt = new Date().toISOString();
  await writeJson(POST_PERF_FILE, postPerf);
  await writeJson(CONTENT_PERF_FILE, perf);
  await writeJson(QUEUE_FILE, { queue, lastUpdated: new Date().toISOString() });
  await log(`Scheduler complete: ${published} published, ${failed} failed`);
}

main().catch((err) => {
  console.error('Scheduler error:', err);
  process.exit(1);
});
