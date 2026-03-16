#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const funnel = await readJson(path.join(root, 'memory', 'sales-funnel.json'), { metrics: {} });
const performance = await readJson(path.join(root, 'memory', 'content-performance.json'), { metrics: {} });
const outFile = path.join(root, 'SalesManager', 'state', 'sales-stats.json');
await writeJson(outFile, {
  generatedAt: new Date().toISOString(),
  metrics: {
    total_leads: funnel.metrics?.total_leads || 0,
    conversion_rate: funnel.metrics?.conversion_rate || 0,
    new_leads: funnel.metrics?.total_leads || 0,
    engagement_rate: performance.metrics?.engagement_rate || 0,
  },
});
console.log(JSON.stringify({ ok: true, file: outFile }, null, 2));

