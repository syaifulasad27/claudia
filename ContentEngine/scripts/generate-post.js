#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { writeContent } from '../../packages/ai/content-writer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const strategy = await readJson(path.join(root, 'memory', 'content-strategy.json'), {});
const personas = await readJson(path.join(root, 'memory', 'audience-personas.json'), { personas: [] });
const learning = await readJson(path.join(root, 'memory', 'content-learning.json'), {});
const insights = await readJson(path.join(root, 'memory', 'marketing-insights.json'), { insights: [] });
const persona = personas.personas?.[0] || { persona: 'general audience', pain_points: ['need clarity'] };
const opportunity = insights.insights?.[0] || { theme: strategy.core_topics?.[0] || 'digital marketing' };
const content = writeContent({ strategy, persona, opportunity, learning });
const draft = {
  id: crypto.randomUUID(),
  type: content.posts[0].type,
  channel: 'threads',
  theme: content.posts[0].theme,
  hook: content.posts[0].hook,
  body: content.posts[0].body,
  cta: content.posts[0].cta,
  status: 'draft',
  createdAt: new Date().toISOString(),
  sourceInsightIds: [opportunity.theme],
};
await writeJson(path.join(root, 'memory', 'content-drafts', `${draft.id}.json`), draft);
console.log(JSON.stringify({ ok: true, draftId: draft.id }, null, 2));

