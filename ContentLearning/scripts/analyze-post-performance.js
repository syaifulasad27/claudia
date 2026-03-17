#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { GROWTH_TARGETS, classifyPostOutcome } from '../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const performanceFile = path.join(root, 'memory', 'content-performance.json');
const learningFile = path.join(root, 'memory', 'content-learning.json');
const postPerfFile = path.join(root, 'memory', 'repliz-social-state', 'post-performance.json');

const perf = await readJson(performanceFile, { metrics: {}, topHashtags: [], topFormats: [] });
const postPerf = await readJson(postPerfFile, { posts: [] });

const outcomeCounts = { keep: 0, tweak: 0, kill: 0 };
for (const post of postPerf.posts || []) {
  post.outcome = classifyPostOutcome(post, GROWTH_TARGETS);
  outcomeCounts[post.outcome] += 1;
}

const winners = (postPerf.posts || []).filter((post) => post.outcome === 'keep');
const weakPosts = (postPerf.posts || []).filter((post) => post.outcome === 'kill');
const learning = {
  generatedAt: new Date().toISOString(),
  topHooks: winners.length > 0 ? winners.map((post) => post.hookType || 'problem_first').slice(0, 3) : ['problem_first', 'question_led'],
  topCtaStyles: winners.length > 0 ? winners.map((post) => post.ctaKeyword || 'audit').slice(0, 3) : ['audit', 'calendar', 'system'],
  risingThemes: winners.length > 0 ? winners.map((post) => post.topic || 'AI automation').slice(0, 3) : ['AI automation', 'digital marketing', 'career advice'],
  topFormats: perf.topFormats?.length ? perf.topFormats : ['short_post', 'carousel'],
  recommendations: [
    weakPosts.length > 0
      ? 'Ganti hook lemah dengan hook problem-first atau question-led.'
      : 'Pertahankan hook problem-first yang sudah menghasilkan interaksi.',
    perf.metrics?.new_leads > 0
      ? 'Pertahankan CTA keyword yang menghasilkan lead dan ulangi pada topik serupa.'
      : 'Pertegas CTA keyword agar komentar tidak berhenti di engagement saja.',
  ],
  outcomes: outcomeCounts,
};

await writeJson(postPerfFile, postPerf);
await writeJson(learningFile, learning);
console.log(JSON.stringify({ ok: true, file: learningFile, outcomes: outcomeCounts }, null, 2));
