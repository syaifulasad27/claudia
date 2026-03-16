#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../../packages/core/config-loader.js';
import { createLogger } from '../../packages/core/logger.js';
import { requestJson } from '../../packages/core/http-client.js';
import { isAuthorizedChat, sendTelegramMessage } from '../../packages/core/telegram-safe.js';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const config = await getConfig(root);
const stateDir = path.join(root, 'memory', 'repliz-social-state');
const log = createLogger('approval-handler');

async function fetchUpdates(offset = 0) {
  if (!config.telegramBotToken) return [];
  const res = await requestJson(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${offset}&limit=100`, {
    timeoutMs: 10000,
    retries: 1,
  });
  return res.ok ? (res.data.result || []) : [];
}

const stateFile = path.join(stateDir, 'approval-handler-state.json');
const state = await readJson(stateFile, { lastUpdateId: 0 });
const updates = await fetchUpdates(state.lastUpdateId + 1);
const queueState = await readJson(path.join(stateDir, 'approval-queue.json'), { pendingApprovals: [] });
const client = new ReplizClient();
await client.init();

for (const update of updates) {
  state.lastUpdateId = update.update_id;
  const message = update.message;
  if (!message?.text) continue;
  if (!isAuthorizedChat(message.chat.id, config.telegramChatId)) {
    await log.warn('unauthorized telegram sender blocked', { chatId: message.chat.id });
    continue;
  }

  const text = message.text.trim();
  if (text.startsWith('/approve ')) {
    const commentId = text.slice('/approve '.length).trim();
    const item = queueState.pendingApprovals.find((entry) => entry.commentId === commentId);
    if (!item) continue;
    const result = await client.replyToComment(commentId, item.draftReply);
    if (result.ok) {
      queueState.pendingApprovals = queueState.pendingApprovals.filter((entry) => entry.commentId !== commentId);
      await sendTelegramMessage({ botToken: config.telegramBotToken, chatId: config.telegramChatId, text: `Approved and published ${commentId}` });
    }
  } else if (text.startsWith('/reject ')) {
    const commentId = text.slice('/reject '.length).trim();
    queueState.pendingApprovals = queueState.pendingApprovals.filter((entry) => entry.commentId !== commentId);
  } else if (text.startsWith('/override ')) {
    const body = text.slice('/override '.length);
    const idx = body.indexOf('|');
    if (idx > -1) {
      const commentId = body.slice(0, idx).trim();
      const replyText = body.slice(idx + 1).trim();
      const result = await client.replyToComment(commentId, replyText);
      if (result.ok) {
        queueState.pendingApprovals = queueState.pendingApprovals.filter((entry) => entry.commentId !== commentId);
      }
    }
  }
}

await writeJson(path.join(stateDir, 'approval-queue.json'), queueState);
await writeJson(stateFile, state);
await log.info('approval handler complete', { pending: queueState.pendingApprovals.length });
console.log(JSON.stringify({ ok: true, pending: queueState.pendingApprovals.length }, null, 2));



