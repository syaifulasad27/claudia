#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { analyzeLead } from '../../packages/ai/lead-analyzer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pending = await readJson(path.join(root, 'repliz-client', 'state', 'pending-comments.json'), { comments: [] });
const personas = await readJson(path.join(root, 'memory', 'audience-personas.json'), { personas: [] });
const leadsFile = path.join(root, 'memory', 'leads.json');
const existing = await readJson(leadsFile, { leads: [] });
const persona = personas.personas?.[0] || { persona: 'general audience' };

for (const comment of pending.comments || []) {
  const analysis = analyzeLead({ commentText: comment.text, persona, pastInteractions: [] });
  if (analysis.leadScore >= 0.55 && !existing.leads.some((lead) => lead.sourceCommentId === comment.id)) {
    existing.leads.push({
      id: comment.id,
      sourcePlatform: 'threads',
      sourceCommentId: comment.id,
      username: comment.username,
      message: comment.text,
      classification: comment.category || comment.classification || 'potential_lead',
      stage: analysis.recommendedStage,
      followUpSuggestion: analysis.followUpSuggestion,
      status: 'open',
      persona: analysis.personaMatch,
      intent: analysis.intent,
      leadScore: analysis.leadScore,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
existing.generatedAt = new Date().toISOString();
await writeJson(leadsFile, existing);
console.log(JSON.stringify({ ok: true, file: leadsFile, total: existing.leads.length }, null, 2));

