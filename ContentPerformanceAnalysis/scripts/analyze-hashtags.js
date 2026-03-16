#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outFile = path.join(root, 'ContentPerformanceAnalysis', 'state', 'hashtag-performance.json');
const hashtags = [
  { tag: '#aiautomation', score: 82 },
  { tag: '#careeradvice', score: 74 },
  { tag: '#digitalmarketing', score: 79 }
];
await writeJson(outFile, { generatedAt: new Date().toISOString(), hashtags });
console.log(JSON.stringify({ ok: true, file: outFile, count: hashtags.length }, null, 2));

