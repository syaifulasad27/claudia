#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, ensureDir } from '../../packages/core/state-manager.js';
import { createLogger } from '../../packages/core/logger.js';
import { analyzeLead } from '../../packages/ai/lead-analyzer.js';
import { draftReply } from '../../packages/ai/comment-reply-agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const stateDir = path.join(root, 'memory', 'repliz-social-state');
const log = createLogger('smart-reply-generator');
await ensureDir(stateDir);

const pending = await readJson(path.join(stateDir, 'pending-comments.json'), { comments: [] });
const personas = await readJson(path.join(root, 'memory', 'audience-personas.json'), { personas: [] });
const funnel = await readJson(path.join(root, 'memory', 'sales-funnel.json'), { stages: {} });
const persona = personas.personas?.[0] || { persona: 'general audience', pain_points: ['need clarity'] };
const drafts = [];
const leadsMemory = await readJson(path.join(root, 'memory', 'leads.json'), { leads: [] });

for (const comment of pending.comments || []) {
  if (comment.classification === 'spam') continue;
  const pastInteractions = leadsMemory.leads.filter((lead) => lead.username === comment.username);
  const lead = analyzeLead({ commentText: comment.text, persona, pastInteractions });
  const reply = draftReply({
    comment,
    persona,
    leadAnalysis: lead,
    productContext: { name: 'digital growth support' },
    salesContext: { stage: lead.recommendedStage },
  });

  comment.intent = lead.intent;
  comment.persona = lead.personaMatch;

  drafts.push({
    commentId: comment.id,
    username: comment.username,
    originalText: comment.text,
    draftReply: reply.reply,
    classification: comment.classification,
    intent: lead.intent,
    leadScore: lead.leadScore,
    persona: lead.personaMatch,
    recommendedStage: lead.recommendedStage,
    followUpSuggestion: lead.followUpSuggestion,
    proposedAt: new Date().toISOString(),
    status: 'awaiting_approval',
  });
}

await writeJson(path.join(stateDir, 'pending-comments.json'), pending);
await writeJson(path.join(stateDir, 'smart-drafts.json'), {
  lastGenerated: new Date().toISOString(),
  totalDrafts: drafts.length,
  drafts,
});

await log.info('draft replies generated', { drafts: drafts.length });
console.log(JSON.stringify({ ok: true, drafts: drafts.length }, null, 2));



