#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const base = '/root/.openclaw/workspace/claudia/repliz-client';
const pendingPath = `${base}/state/pending-comments.json`;

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (e) {
    if (allowFail) return e.stdout || e.message || '';
    throw e;
  }
}

(async () => {
  // 1) Fetch only (non-LLM)
  run('cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/comment-fetcher.js');

  // 2) Read fetched results
  let pending = { comments: [] };
  try {
    pending = JSON.parse(await fs.readFile(pendingPath, 'utf-8'));
  } catch {}

  const comments = pending.comments || [];
  const valid = comments.filter(c => c.status === 'pending_draft').length;

  // 3) Only when needed -> generate contextual draft + notify Tuan (manual approval)
  let notified = 'na';
  if (valid > 0) {
    run('cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/smart-reply-generator.js');
    const out = run('cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/notify-tuan.js', true);
    notified = /Telegram notification sent|Saved .*approval-queue/.test(out) ? 'true' : 'false';
  }

  const line = `${new Date().toISOString()} monitor-only fetched=${comments.length} valid=${valid} notified=${notified} mode=manual_approval\n`;
  await fs.appendFile(`${base}/logs/monitor-only.log`, line);
  process.stdout.write(line);
})();
