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
const content = writeContent({ strategy, persona, opportunity: { theme: 'conversion copy' }, learning });
const draft = {
  id: crypto.randomUUID(),
  type: 'sales_copy',
  channel: 'threads',
  theme: content.salesCopy.headline,
  body: content.salesCopy.bullets.join(' | '),
  cta: content.salesCopy.cta,
  status: 'draft',
  createdAt: new Date().toISOString(),
  sourceInsightIds: ['sales_copy'],
};
await writeJson(path.join(root, 'memory', 'content-drafts', `${draft.id}.json`), draft);
console.log(JSON.stringify({ ok: true, draftId: draft.id }, null, 2));

