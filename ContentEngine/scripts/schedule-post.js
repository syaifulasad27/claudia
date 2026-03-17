#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { buildContentText, normalizeScheduledPost, pickNextScheduleTime } from '../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const queueFile = path.join(root, 'repliz-client', 'content', 'scheduled', 'queue.json');
const draftDir = path.join(root, 'memory', 'content-drafts');
const performance = await readJson(path.join(root, 'memory', 'content-performance.json'), {});
const queueData = await readJson(queueFile, { queue: [], lastUpdated: null });
const queue = (queueData.queue || []).map(normalizeScheduledPost);
const files = (await fs.readdir(draftDir)).filter((file) => file.endsWith('.json')).sort().reverse();
const postPerformance = await readJson(path.join(root, 'memory', 'repliz-social-state', 'post-performance.json'), { posts: [] });
const alreadyHandled = new Set([
  ...queue.map((item) => item.draftId || item.id),
  ...(postPerformance.posts || []).map((item) => item.draftId || item.id),
]);

let scheduled = false;
let scheduledPost = null;
for (const file of files) {
  const draft = await readJson(path.join(draftDir, file), null);
  if (!draft || alreadyHandled.has(draft.id)) continue;

  scheduledPost = normalizeScheduledPost({
    id: draft.id,
    draftId: draft.id,
    type: 'text',
    content: buildContentText(draft),
    scheduledFor: pickNextScheduleTime(queue, performance, new Date()),
    status: 'pending',
    metadata: {
      topic: draft.theme,
      hookType: draft.hookType || 'problem_first',
      ctaKeyword: draft.ctaKeyword || null,
      persona: draft.persona || 'general audience',
      sourceDraftCreatedAt: draft.createdAt,
    },
  });
  queue.push(scheduledPost);
  scheduled = true;
  break;
}

await writeJson(queueFile, {
  queue,
  lastUpdated: new Date().toISOString(),
});

console.log(JSON.stringify({
  ok: true,
  scheduled,
  queueSize: queue.length,
  scheduledFor: scheduledPost?.scheduledFor || null,
  postId: scheduledPost?.id || null,
}, null, 2));
