#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const reportFile = path.join(root, 'repliz-client', 'reports', 'content-eval-latest.json');
const outFile = path.join(root, 'ContentPerformanceAnalysis', 'state', 'engagement-metrics.json');
const report = await readJson(reportFile, {});
const metrics = report.metrics || {
  engagement_rate: 0.04,
  posts: 0,
  comments: 0,
  saves: 0,
};
await writeJson(outFile, { generatedAt: new Date().toISOString(), metrics });
console.log(JSON.stringify({ ok: true, file: outFile }, null, 2));

