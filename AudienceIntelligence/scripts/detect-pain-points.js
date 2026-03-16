#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pendingFile = path.join(root, 'repliz-client', 'state', 'pending-comments.json');
const outFile = path.join(root, 'AudienceIntelligence', 'state', 'pain-points.json');

const pending = await readJson(pendingFile, { comments: [] });
const painPoints = [];
for (const comment of pending.comments || []) {
  const text = String(comment.text || '').toLowerCase();
  if (/(susah|bingung|stuck|sulit|gagal)/.test(text)) painPoints.push(comment.text);
}
await writeJson(outFile, { generatedAt: new Date().toISOString(), painPoints });
console.log(JSON.stringify({ ok: true, file: outFile, count: painPoints.length }, null, 2));

