#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pendingFile = path.join(root, 'repliz-client', 'state', 'pending-comments.json');
const leadsFile = path.join(root, 'memory', 'leads.json');
const outFile = path.join(root, 'memory', 'audience-personas.json');

const pending = await readJson(pendingFile, { comments: [] });
const leads = await readJson(leadsFile, { leads: [] });
const texts = [...(pending.comments || []).map((c) => c.text), ...(leads.leads || []).map((l) => l.message)];
const personas = [];
if (texts.some((text) => /job|portfolio|developer|career/i.test(String(text)))) {
  personas.push({
    persona: 'junior developer',
    pain_points: ['difficult to find first job', 'lack of portfolio'],
    content_preferences: ['tutorial', 'career advice'],
    common_questions: [],
    updatedAt: new Date().toISOString(),
  });
}
if (texts.some((text) => /jualan|leads|ads|marketing|content/i.test(String(text)))) {
  personas.push({
    persona: 'marketing beginner',
    pain_points: ['unclear content strategy', 'low conversion from content'],
    content_preferences: ['checklist', 'framework'],
    common_questions: [],
    updatedAt: new Date().toISOString(),
  });
}
await writeJson(outFile, { generatedAt: new Date().toISOString(), personas });
console.log(JSON.stringify({ ok: true, file: outFile, count: personas.length }, null, 2));

