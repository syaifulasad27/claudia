#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const performanceFile = path.join(root, 'memory', 'content-performance.json');
const learningFile = path.join(root, 'memory', 'content-learning.json');
const perf = await readJson(performanceFile, { metrics: {}, topHashtags: [], topFormats: [] });

const learning = {
  generatedAt: new Date().toISOString(),
  topHooks: ['Kenapa X penting sekarang?', '3 langkah praktis yang langsung bisa dicoba'],
  topCtaStyles: perf.metrics?.new_leads > 0 ? ['DM invitation', 'comment prompt'] : ['comment prompt', 'save this post'],
  risingThemes: ['AI automation', 'career advice'],
  topFormats: perf.topFormats?.length ? perf.topFormats : ['short_post', 'carousel'],
  recommendations: [
    'Perbanyak konten edukatif dengan hook problem-first.',
    'Gunakan CTA komentar untuk awareness dan CTA DM untuk lead intent tinggi.',
  ],
};
await writeJson(learningFile, learning);
console.log(JSON.stringify({ ok: true, file: learningFile }, null, 2));

