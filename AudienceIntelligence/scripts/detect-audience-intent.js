#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pendingFile = path.join(root, 'repliz-client', 'state', 'pending-comments.json');
const outFile = path.join(root, 'AudienceIntelligence', 'state', 'intent-signals.json');

const pending = await readJson(pendingFile, { comments: [] });
const intents = (pending.comments || []).map((comment) => {
  const text = String(comment.text || '').toLowerCase();
  let intent = 'learning_intent';
  if (/(harga|price|paket|join|daftar|beli|order|dm)/.test(text)) intent = 'purchase_intent';
  else if (/(vs|compare|banding|lebih bagus)/.test(text)) intent = 'comparison_intent';
  else if (/(yakin|worth it|scam|benarkah)/.test(text)) intent = 'skeptical_intent';
  else if (/(tolong|help|gagal|problem|error)/.test(text)) intent = 'support_intent';
  return { commentId: comment.id, intent };
});
await writeJson(outFile, { generatedAt: new Date().toISOString(), intents });
console.log(JSON.stringify({ ok: true, file: outFile, count: intents.length }, null, 2));

