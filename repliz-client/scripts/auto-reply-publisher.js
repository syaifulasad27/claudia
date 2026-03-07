#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'auto-reply-publisher.log');

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });

  const enabled = String(process.env.AUTO_PUBLISH_REPLIES || '').toLowerCase() === 'true';
  if (!enabled) {
    await log('Auto-publish disabled (AUTO_PUBLISH_REPLIES != true). Exiting safely.');
    return;
  }

  const draftsFile = path.join(STATE_DIR, 'smart-drafts.json');
  let data;
  try {
    data = JSON.parse(await fs.readFile(draftsFile, 'utf-8'));
  } catch {
    await log('No smart-drafts.json found.');
    return;
  }

  const drafts = data.drafts || [];
  const ready = drafts.filter(d => d.status === 'awaiting_approval' || d.status === 'drafted');

  if (ready.length === 0) {
    await log('No drafts to auto-publish.');
    return;
  }

  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) {
    await log(`Init failed: ${init.error || 'unknown'}`);
    return;
  }

  let okCount = 0;
  for (const d of ready) {
    const reply = String(d.draftReply || '').trim();
    if (!reply) {
      d.status = 'auto_publish_failed';
      d.processNote = 'Empty draft reply';
      continue;
    }

    const res = await client.replyToComment(d.commentId, reply);
    if (res.ok) {
      d.status = 'auto_published';
      d.processedAt = new Date().toISOString();
      d.processNote = 'Auto-published without approval';
      okCount++;
      await log(`Published commentId=${d.commentId} @${d.username || 'unknown'}`);
    } else {
      d.status = 'auto_publish_failed';
      d.processedAt = new Date().toISOString();
      d.processNote = `Publish failed: ${res.error || res.reason || 'unknown'}`;
      await log(`Failed commentId=${d.commentId}: ${res.error || res.reason || 'unknown'}`);
    }
  }

  await fs.writeFile(draftsFile, JSON.stringify(data, null, 2));

  // Keep queue in sync: remove auto-published ids from approval queue
  const queueFile = path.join(STATE_DIR, 'approval-queue.json');
  try {
    const q = JSON.parse(await fs.readFile(queueFile, 'utf-8'));
    const done = new Set(ready.filter(d => d.status === 'auto_published').map(d => d.commentId));
    q.pendingApprovals = (q.pendingApprovals || []).filter(x => !done.has(x.commentId));
    q.lastUpdated = new Date().toISOString();
    await fs.writeFile(queueFile, JSON.stringify(q, null, 2));
  } catch {}

  await log(`Auto-publish complete ok=${okCount}/${ready.length}`);
}

main().catch(async (e) => {
  await log(`FATAL: ${e.message}`);
  process.exit(1);
});
