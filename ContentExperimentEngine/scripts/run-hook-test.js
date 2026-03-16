#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const experimentsFile = path.join(root, 'memory', 'content-experiments.json');
const existing = await readJson(experimentsFile, { experiments: [] });
existing.experiments.push({
  id: `hook-${Date.now()}`,
  type: 'hook_test',
  winner: 'problem-first hook',
  compared: ['problem-first hook', 'story hook'],
  observedLift: 0.12,
  createdAt: new Date().toISOString(),
});
existing.generatedAt = new Date().toISOString();
await writeJson(experimentsFile, existing);
console.log(JSON.stringify({ ok: true, file: experimentsFile }, null, 2));

