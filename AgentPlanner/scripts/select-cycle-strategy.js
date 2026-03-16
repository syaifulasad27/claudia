#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { adviseStrategy } from '../../packages/ai/strategy-advisor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const goals = await readJson(path.join(root, 'memory', 'agent-goals.json'), {});
const performance = await readJson(path.join(root, 'memory', 'content-performance.json'), { metrics: {} });
const funnel = await readJson(path.join(root, 'memory', 'sales-funnel.json'), { metrics: {} });
const learning = await readJson(path.join(root, 'memory', 'content-learning.json'), {});
const audience = await readJson(path.join(root, 'memory', 'audience-signals.json'), {});
const plan = adviseStrategy({
  goals,
  metrics: {
    engagement_rate: performance.metrics?.engagement_rate || 0,
    new_leads: funnel.metrics?.total_leads || 0,
    content_posts: performance.metrics?.content_posts || 0,
    conversion_rate: funnel.metrics?.conversion_rate || 0,
  },
  learning,
  audienceSignals: audience,
});
const outFile = path.join(root, 'apps', 'digital-marketing-agent', 'state', 'current-plan.json');
await writeJson(outFile, { generatedAt: new Date().toISOString(), ...plan });
console.log(JSON.stringify({ ok: true, file: outFile }, null, 2));

