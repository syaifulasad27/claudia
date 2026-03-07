#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '..');
const stateDir = path.join(base, 'state');
const outDir = path.join(base, 'reports');

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

async function readJsonSafe(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { return fallback; }
}

async function tailLine(p) {
  try {
    const t = await fs.readFile(p, 'utf-8');
    const lines = t.trim().split('\n');
    return lines[lines.length - 1] || '';
  } catch { return ''; }
}

async function main() {
  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) throw new Error(`init failed: ${init.error || 'unknown'}`);

  const since48 = isoHoursAgo(48);
  const scheduleRes = await client.request('GET', `/schedule?page=1&limit=100&accountIds[]=${client.accountId}`);
  const queueRes = await client.request('GET', `/queue?page=1&limit=100&accountIds[]=${client.accountId}`);

  const posts = (scheduleRes.ok ? (scheduleRes.data.docs || []) : []).filter(p => (p.createdAt || '') >= since48);
  const comments = queueRes.ok ? (queueRes.data.docs || []) : [];

  const smartDrafts = await readJsonSafe(path.join(stateDir, 'smart-drafts.json'), { drafts: [] });
  const approvalQueue = await readJsonSafe(path.join(stateDir, 'approval-queue.json'), { pendingApprovals: [] });
  const pendingComments = await readJsonSafe(path.join(stateDir, 'pending-comments.json'), { comments: [] });

  const summary = {
    generatedAt: new Date().toISOString(),
    accountId: client.accountId,
    windowHours: 48,
    posts48h: posts.length,
    postsByStatus48h: posts.reduce((a, p) => { a[p.status || 'unknown'] = (a[p.status || 'unknown'] || 0) + 1; return a; }, {}),
    queueNow: {
      total: comments.length,
      pending: comments.filter(c => c.status === 'pending').length,
      resolved: comments.filter(c => c.status === 'resolved').length
    },
    pipeline: {
      pendingComments: (pendingComments.comments || []).length,
      draftsTotal: (smartDrafts.drafts || []).length,
      draftsAwaitingApproval: (smartDrafts.drafts || []).filter(d => ['awaiting_approval', 'drafted', 'needs_review', 'needs_review_low_relevance'].includes(d.status)).length,
      approvalQueueItems: (approvalQueue.pendingApprovals || []).length
    },
    lastRuns: {
      monitorOnly: await tailLine(path.join(base, 'logs', 'monitor-only.log')),
      notifyTuan: await tailLine(path.join(base, 'logs', 'notify-tuan.log')),
      approvalHandler: await tailLine(path.join(base, 'logs', 'approval-handler.log'))
    }
  };

  await fs.mkdir(outDir, { recursive: true });
  const outJson = path.join(outDir, 'dashboard-latest.json');
  await fs.writeFile(outJson, JSON.stringify(summary, null, 2));

  const md = `# Threads Mini Dashboard\n\nGenerated: ${summary.generatedAt}\n\n- Posts 48h: **${summary.posts48h}**\n- Queue now: total **${summary.queueNow.total}**, pending **${summary.queueNow.pending}**, resolved **${summary.queueNow.resolved}**\n- Drafts awaiting approval: **${summary.pipeline.draftsAwaitingApproval}**\n- Approval queue items: **${summary.pipeline.approvalQueueItems}**\n\n## Last Runs\n- monitor-only: ${summary.lastRuns.monitorOnly || '-'}\n- notify-tuan: ${summary.lastRuns.notifyTuan || '-'}\n- approval-handler: ${summary.lastRuns.approvalHandler || '-'}\n`;
  await fs.writeFile(path.join(outDir, 'dashboard-latest.md'), md);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
