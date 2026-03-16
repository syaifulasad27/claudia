#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const goals = await readJson(path.join(root, 'memory', 'agent-goals.json'), { monthly_goals: {} });
const performance = await readJson(path.join(root, 'memory', 'content-performance.json'), { metrics: {} });
const funnel = await readJson(path.join(root, 'memory', 'sales-funnel.json'), { metrics: {} });
const current = {
  new_leads: funnel.metrics?.total_leads || 0,
  engagement_rate: performance.metrics?.engagement_rate || 0,
  content_posts: performance.metrics?.content_posts || 0,
  conversion_rate: funnel.metrics?.conversion_rate || 0,
};
const gaps = {
  new_leads: (goals.monthly_goals?.new_leads || 0) - current.new_leads,
  engagement_rate: (goals.monthly_goals?.engagement_rate || 0) - current.engagement_rate,
  content_posts: (goals.monthly_goals?.content_posts || 0) - current.content_posts,
};
const outFile = path.join(root, 'AgentPlanner', 'state', 'goal-evaluation.json');
await writeJson(outFile, { generatedAt: new Date().toISOString(), current, goals: goals.monthly_goals, gaps });
console.log(JSON.stringify({ ok: true, file: outFile }, null, 2));

