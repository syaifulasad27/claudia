#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../../packages/core/state-manager.js';
import { GROWTH_TARGETS } from '../../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const perfFile = path.join(root, 'memory', 'content-performance.json');
const postPerfFile = path.join(root, 'memory', 'repliz-social-state', 'post-performance.json');
const leadsFile = path.join(root, 'memory', 'leads.json');
const stateFile = path.join(root, 'apps', 'digital-marketing-agent', 'state', 'growth-system-state.json');

const perf = await readJson(perfFile, { metrics: {}, targets: GROWTH_TARGETS });
const postPerf = await readJson(postPerfFile, { posts: [] });
const leads = await readJson(leadsFile, { leads: [] });
const prior = await readJson(stateFile, { consecutiveZeroPublishCycles: 0 });

const livePosts = (postPerf.posts || []).filter((post) => post.status === 'posted').length;
const comments = perf.metrics?.comments_total || 0;
const inboundInteractions = perf.metrics?.inbound_interactions || 0;
const leadCount = (leads.leads || []).length;
const queuePending = perf.metrics?.queue_pending || 0;
const failures = [];
const automaticActions = [];

const consecutiveZeroPublishCycles = livePosts === 0 && queuePending > 0
  ? (prior.consecutiveZeroPublishCycles || 0) + 1
  : 0;

if (consecutiveZeroPublishCycles >= 2) {
  failures.push('system_failure');
  automaticActions.push('stop_generating_extra_drafts');
  automaticActions.push('prioritize_publish_fix_alert');
}
if (livePosts >= 3 && comments === 0) {
  failures.push('output_failure');
  automaticActions.push('switch_to_stronger_problem_first_hooks');
}
if ((perf.metrics?.outbound_replies_today || 0) >= 10 && inboundInteractions === 0) {
  failures.push('engagement_failure');
  automaticActions.push('tighten_distribution_targeting');
}
if (comments > 0 && leadCount === 0) {
  failures.push('cta_failure');
  automaticActions.push('reduce_to_single_explicit_keyword_cta');
}
if (leadCount > 0 && (leads.leads || []).some((lead) => lead.followUpStatus === 'pending')) {
  failures.push('lead_followup_risk');
  automaticActions.push('move_pending_leads_to_top_priority');
}

await writeJson(stateFile, {
  generatedAt: new Date().toISOString(),
  targets: perf.targets || GROWTH_TARGETS,
  metrics: {
    livePosts,
    comments,
    inboundInteractions,
    leadCount,
    queuePending,
  },
  consecutiveZeroPublishCycles,
  failures,
  automaticActions,
  healthy: failures.length === 0,
});

console.log(JSON.stringify({ ok: true, failures, automaticActions }, null, 2));
