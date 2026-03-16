#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const metricsFile = path.join(root, 'ContentPerformanceAnalysis', 'state', 'engagement-metrics.json');
const outFile = path.join(root, 'ContentPerformanceAnalysis', 'state', 'engagement-score.json');
const metrics = await readJson(metricsFile, { metrics: {} });
const m = metrics.metrics || {};
const score = Number((((m.engagement_rate || 0) * 100) + (m.comments || 0) * 0.2 + (m.saves || 0) * 0.3).toFixed(2));
await writeJson(outFile, { generatedAt: new Date().toISOString(), score, metrics: m });
console.log(JSON.stringify({ ok: true, file: outFile, score }, null, 2));

