#!/usr/bin/env node
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { writeContent } from '../../packages/ai/content-writer.js';
import { FIRST_48H_POSTS } from '../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const strategy = await readJson(path.join(root, 'memory', 'content-strategy.json'), {});
const personas = await readJson(path.join(root, 'memory', 'audience-personas.json'), { personas: [] });
const learning = await readJson(path.join(root, 'memory', 'content-learning.json'), {});
const insights = await readJson(path.join(root, 'memory', 'marketing-insights.json'), { insights: [] });
const seedStateFile = path.join(root, 'memory', 'repliz-social-state', 'content-seed-state.json');
const seedState = await readJson(seedStateFile, { nextIndex: 0 });
const persona = personas.personas?.[0] || { persona: 'general audience', pain_points: ['need clarity'] };
const opportunity = insights.insights?.[0] || { theme: strategy.core_topics?.[0] || 'digital marketing' };

let draft;
if ((seedState.nextIndex || 0) < FIRST_48H_POSTS.length) {
  const seeded = FIRST_48H_POSTS[seedState.nextIndex];
  draft = {
    id: crypto.randomUUID(),
    type: 'short_post',
    channel: 'threads',
    theme: seeded.theme,
    hookType: seeded.hookType,
    ctaKeyword: seeded.ctaKeyword,
    hook: seeded.hook,
    body: seeded.body,
    cta: seeded.cta,
    status: 'draft',
    createdAt: new Date().toISOString(),
    sourceInsightIds: [seeded.theme],
    persona: persona.persona || 'general audience',
  };
  seedState.nextIndex += 1;
  seedState.lastGeneratedAt = new Date().toISOString();
  await writeJson(seedStateFile, seedState);
} else {
  const content = writeContent({ strategy, persona, opportunity, learning });
  draft = {
    id: crypto.randomUUID(),
    type: content.posts[0].type,
    channel: 'threads',
    theme: content.posts[0].theme,
    hookType: 'problem_first',
    ctaKeyword: /dm/i.test(content.posts[0].cta || '') ? 'system' : 'audit',
    hook: content.posts[0].hook,
    body: content.posts[0].body,
    cta: content.posts[0].cta,
    status: 'draft',
    createdAt: new Date().toISOString(),
    sourceInsightIds: [opportunity.theme],
    persona: persona.persona || 'general audience',
  };
}

await writeJson(path.join(root, 'memory', 'content-drafts', `${draft.id}.json`), draft);
console.log(JSON.stringify({ ok: true, draftId: draft.id, ctaKeyword: draft.ctaKeyword }, null, 2));
