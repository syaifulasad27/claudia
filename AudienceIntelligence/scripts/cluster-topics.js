#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pendingFile = path.join(root, 'repliz-client', 'state', 'pending-comments.json');
const outFile = path.join(root, 'AudienceIntelligence', 'state', 'topic-clusters.json');

const pending = await readJson(pendingFile, { comments: [] });
const topics = {};
for (const comment of pending.comments || []) {
  const text = String(comment.text || '').toLowerCase();
  for (const topic of ['portfolio', 'career', 'automation', 'content', 'leads', 'marketing']) {
    if (text.includes(topic)) topics[topic] = (topics[topic] || 0) + 1;
  }
}
await writeJson(outFile, { generatedAt: new Date().toISOString(), topics });
console.log(JSON.stringify({ ok: true, file: outFile, topics }, null, 2));

