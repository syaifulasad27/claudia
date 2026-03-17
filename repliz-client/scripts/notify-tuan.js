#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../../packages/core/config-loader.js';
import { createLogger } from '../../packages/core/logger.js';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { escapeHtml, sendTelegramMessage } from '../../packages/core/telegram-safe.js';
import { checkRateLimit } from '../../packages/core/rate-limiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const config = await getConfig(root);
const log = createLogger('notify-tuan');
const stateDir = path.join(root, 'memory', 'repliz-social-state');
const draftsData = await readJson(path.join(stateDir, 'smart-drafts.json'), { drafts: [] });
const pendingDrafts = (draftsData.drafts || []).filter((draft) => draft.status === 'awaiting_approval');
const approvalQueue = [];
let sent = 0;

for (const draft of pendingDrafts) {
  const limiter = await checkRateLimit(path.join(stateDir, 'telegram-rate-limit.json'), 'notify', 20, 60 * 60 * 1000);
  if (!limiter.allowed) break;
  const message = [
    '<b>Reply Approval Needed</b>',
    '',
    `<b>User:</b> @${escapeHtml(draft.username)}`,
    `<b>Type:</b> ${escapeHtml(draft.classification)}`,
    `<b>Intent:</b> ${escapeHtml(draft.intent)}`,
    `<b>Persona:</b> ${escapeHtml(draft.persona)}`,
    `<b>Comment:</b> ${escapeHtml(draft.originalText)}`,
    '',
    `<b>Draft:</b> ${escapeHtml(draft.draftReply)}`,
    '',
    `Approve: /approve ${escapeHtml(draft.commentId)}`,
    `Reject: /reject ${escapeHtml(draft.commentId)}`,
    `Override: /override ${escapeHtml(draft.commentId)} | teks baru`,
  ].join('\n');

  const result = await sendTelegramMessage({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
    text: message,
  });

  if (result.ok) {
    draft.status = 'notified';
    draft.notificationSentAt = new Date().toISOString();
    approvalQueue.push({
      commentId: draft.commentId,
      username: draft.username,
      draftReply: draft.draftReply,
      status: 'awaiting_approval',
      notifiedAt: draft.notificationSentAt,
    });
    sent += 1;
  }
}

const leadsFile = path.join(root, 'memory', 'leads.json');
const leadsData = await readJson(leadsFile, { leads: [] });
for (const lead of leadsData.leads || []) {
  if (!lead.notify || lead.notificationSentAt) continue;
  const limiter = await checkRateLimit(path.join(stateDir, 'telegram-rate-limit.json'), 'lead_notify', 20, 60 * 60 * 1000);
  if (!limiter.allowed) break;
  const message = [
    '<b>Lead Signal</b>',
    '',
    `<b>User:</b> @${escapeHtml(lead.username || 'unknown')}`,
    `<b>Keyword:</b> ${escapeHtml(lead.keyword || '-')}`,
    `<b>Intent:</b> ${escapeHtml(lead.intent || '-')}`,
    `<b>Stage:</b> ${escapeHtml(lead.stage || '-')}`,
    `<b>Channel:</b> ${escapeHtml(lead.channel || '-')}`,
    `<b>Message:</b> ${escapeHtml(lead.message || '-')}`,
    `<b>Follow Up:</b> ${escapeHtml(lead.followUpSuggestion || '-')}`,
  ].join('\n');

  const result = await sendTelegramMessage({
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId,
    text: message,
  });

  if (result.ok) {
    lead.notificationSentAt = new Date().toISOString();
    sent += 1;
  }
}

await writeJson(path.join(stateDir, 'smart-drafts.json'), draftsData);
await writeJson(path.join(stateDir, 'approval-queue.json'), {
  lastUpdated: new Date().toISOString(),
  pendingApprovals: approvalQueue,
});
await writeJson(leadsFile, leadsData);

await log.info('notifications sent', { sent, approvals: approvalQueue.length });
console.log(JSON.stringify({ ok: true, sent, approvals: approvalQueue.length }, null, 2));
