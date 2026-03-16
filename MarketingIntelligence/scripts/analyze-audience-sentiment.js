#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pendingFile = path.join(root, 'repliz-client', 'state', 'pending-comments.json');
const outFile = path.join(root, 'MarketingIntelligence', 'state', 'audience-sentiment.json');

const pending = await readJson(pendingFile, { comments: [] });
const comments = pending.comments || [];
const sentiment = comments.reduce((acc, comment) => {
  const text = String(comment.text || '').toLowerCase();
  if (/(bingung|susah|problem|gagal|capek|stuck)/.test(text)) acc.pain += 1;
  else if (/(thanks|makasih|mantap|bagus|helpful)/.test(text)) acc.positive += 1;
  else acc.neutral += 1;
  return acc;
}, { positive: 0, neutral: 0, pain: 0 });

await writeJson(outFile, { generatedAt: new Date().toISOString(), sentiment, commentsAnalyzed: comments.length });
console.log(JSON.stringify({ ok: true, file: outFile, sentiment }, null, 2));

