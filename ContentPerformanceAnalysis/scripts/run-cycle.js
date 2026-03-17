#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { GROWTH_TARGETS } from '../../packages/core/growth-recovery.js';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(moduleRoot, '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { cwd: moduleRoot, stdio: 'inherit' });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${script} failed with ${code}`)));
  });
}

await run('scripts/fetch-engagement-metrics.js');
await run('scripts/compute-engagement-score.js');
await run('scripts/analyze-hashtags.js');
await run('scripts/detect-best-posting-times.js');

const metrics = await readJson(path.join(workspaceRoot, 'ContentPerformanceAnalysis', 'state', 'engagement-metrics.json'), { metrics: {} });
const score = await readJson(path.join(workspaceRoot, 'ContentPerformanceAnalysis', 'state', 'engagement-score.json'), { score: 0 });
const hashtags = await readJson(path.join(workspaceRoot, 'ContentPerformanceAnalysis', 'state', 'hashtag-performance.json'), { hashtags: [] });
const times = await readJson(path.join(workspaceRoot, 'ContentPerformanceAnalysis', 'state', 'best-posting-times.json'), { windows: [] });
const funnel = await readJson(path.join(workspaceRoot, 'memory', 'sales-funnel.json'), { metrics: {} });
const current = await readJson(path.join(workspaceRoot, 'memory', 'content-performance.json'), { metrics: {}, targets: GROWTH_TARGETS });
const postPerf = await readJson(path.join(workspaceRoot, 'memory', 'repliz-social-state', 'post-performance.json'), { posts: [] });

const publishedPosts = (postPerf.posts || []).filter((post) => post.status === 'posted').length;
const totalComments = (postPerf.posts || []).reduce((sum, post) => sum + (post.comments || 0), 0);
const impressionsProxyTotal = (postPerf.posts || []).reduce((sum, post) => sum + (post.impressionsProxy || 0), 0);
const engagementEvents = (postPerf.posts || []).reduce((sum, post) => sum + (post.engagementEvents || 0), 0);

await writeJson(path.join(workspaceRoot, 'memory', 'content-performance.json'), {
  ...current,
  generatedAt: new Date().toISOString(),
  targets: current.targets || GROWTH_TARGETS,
  metrics: {
    ...(current.metrics || {}),
    engagement_rate: impressionsProxyTotal > 0 ? engagementEvents / impressionsProxyTotal : (metrics.metrics?.engagement_rate || current.metrics?.engagement_rate || 0.04),
    new_leads: funnel.metrics?.total_leads || current.metrics?.new_leads || 0,
    content_posts: publishedPosts,
    conversion_rate: funnel.metrics?.conversion_rate || current.metrics?.conversion_rate || 0,
    engagement_score: score.score || current.metrics?.engagement_score || 0,
    comments_total: totalComments,
    inbound_interactions: totalComments,
    impressions_proxy_total: impressionsProxyTotal,
    publish_success_rate: current.metrics?.publish_success_rate || 0,
    publish_attempts: current.metrics?.publish_attempts || 0,
    queue_pending: current.metrics?.queue_pending || 0,
    cta_response_rate: totalComments > 0 ? (funnel.metrics?.total_leads || 0) / totalComments : 0,
  },
  topHashtags: hashtags.hashtags || current.topHashtags || [],
  bestPostingTimes: times.windows?.length ? times.windows : (current.bestPostingTimes || []),
  topFormats: current.topFormats?.length ? current.topFormats : ['short_post', 'carousel'],
  lowPerformingThemes: current.lowPerformingThemes || [],
});

console.log(JSON.stringify({ ok: true, message: 'content performance cycle complete' }, null, 2));
