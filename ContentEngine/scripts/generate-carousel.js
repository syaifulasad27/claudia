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
const persona = personas.personas?.[0] || { persona: 'general audience' };
const content = writeContent({ strategy, persona, opportunity: { theme: strategy.core_topics?.[0] || 'digital marketing' }, learning });
const draft = {
  id: crypto.randomUUID(),
  type: 'carousel',
  channel: 'threads',
  theme: content.carousel.title,
  body: content.carousel.slides,
  cta: content.salesCopy.cta,
  status: 'draft',
  createdAt: new Date().toISOString(),
  sourceInsightIds: [content.carousel.title],
};
await writeJson(path.join(root, 'memory', 'content-drafts', `${draft.id}.json`), draft);
console.log(JSON.stringify({ ok: true, draftId: draft.id }, null, 2));

