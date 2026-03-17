#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { analyzeLead } from '../../packages/ai/lead-analyzer.js';
import { buildLeadFromSignal, inferCtaKeyword, mapIntentToStage } from '../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pending = await readJson(path.join(root, 'memory', 'repliz-social-state', 'pending-comments.json'), { comments: [] });
const personas = await readJson(path.join(root, 'memory', 'audience-personas.json'), { personas: [] });
const leadsFile = path.join(root, 'memory', 'leads.json');
const performanceFile = path.join(root, 'memory', 'content-performance.json');
const postPerfFile = path.join(root, 'memory', 'repliz-social-state', 'post-performance.json');
const existing = await readJson(leadsFile, { leads: [] });
const performance = await readJson(performanceFile, { metrics: {} });
const postPerf = await readJson(postPerfFile, { posts: [] });
const persona = personas.personas?.[0] || { persona: 'general audience' };

let created = 0;
for (const comment of pending.comments || []) {
  const keyword = inferCtaKeyword(comment.text || '');
  const currentLead = existing.leads.find((lead) => lead.sourceCommentId === comment.id || (lead.username === comment.username && lead.keyword === keyword));

  if (keyword) {
    const keywordLead = buildLeadFromSignal({
      comment: { ...comment, persona: persona.persona || 'general audience' },
      keyword,
      existingLead: currentLead,
      detectedAt: new Date().toISOString(),
    });

    if (currentLead) {
      Object.assign(currentLead, keywordLead);
    } else {
      existing.leads.push(keywordLead);
      created += 1;
    }

    const relatedPost = postPerf.posts.find((post) => post.externalPostId === comment.postId || post.id === comment.postId || post.draftId === comment.postId);
    if (relatedPost) {
      relatedPost.leadsCreated = (relatedPost.leadsCreated || 0) + (currentLead ? 0 : 1);
    }
    continue;
  }

  const analysis = analyzeLead({ commentText: comment.text, persona, pastInteractions: [] });
  if (analysis.leadScore >= 0.55 && !currentLead) {
    existing.leads.push({
      id: comment.id,
      sourcePlatform: 'threads',
      sourceCommentId: comment.id,
      username: comment.username,
      message: comment.text,
      classification: comment.category || comment.classification || 'potential_lead',
      stage: analysis.recommendedStage || mapIntentToStage('medium'),
      followUpSuggestion: analysis.followUpSuggestion,
      status: 'open',
      persona: analysis.personaMatch,
      intent: analysis.intent,
      leadScore: analysis.leadScore,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      channel: comment.channel || 'comment',
      sourcePostId: comment.postId || null,
      lastActionAt: new Date().toISOString(),
      notify: analysis.leadScore >= 0.8,
      followUpStatus: 'pending',
    });
    created += 1;
  }
}

existing.generatedAt = new Date().toISOString();
performance.generatedAt = new Date().toISOString();
performance.metrics = {
  ...(performance.metrics || {}),
  new_leads: existing.leads.length,
};

await writeJson(leadsFile, existing);
await writeJson(performanceFile, performance);
await writeJson(postPerfFile, postPerf);
console.log(JSON.stringify({ ok: true, file: leadsFile, total: existing.leads.length, created }, null, 2));
