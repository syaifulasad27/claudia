#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

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

await writeJson(path.join(workspaceRoot, 'memory', 'content-performance.json'), {
  generatedAt: new Date().toISOString(),
  metrics: {
    engagement_rate: metrics.metrics?.engagement_rate || 0.04,
    new_leads: funnel.metrics?.total_leads || 0,
    content_posts: metrics.metrics?.posts || 0,
    conversion_rate: funnel.metrics?.conversion_rate || 0,
    engagement_score: score.score || 0,
  },
  topHashtags: hashtags.hashtags || [],
  bestPostingTimes: times.windows || [],
  topFormats: ['short_post', 'carousel'],
  lowPerformingThemes: [],
});

console.log(JSON.stringify({ ok: true, message: 'content performance cycle complete' }, null, 2));
