#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const experimentsFile = path.join(root, 'memory', 'content-experiments.json');
const existing = await readJson(experimentsFile, { experiments: [] });
existing.experiments.push({
  id: `time-${Date.now()}`,
  type: 'posting_time_test',
  winner: '19:00 WIB',
  compared: ['08:00 WIB', '12:30 WIB', '19:00 WIB'],
  observedLift: 0.09,
  createdAt: new Date().toISOString(),
});
existing.generatedAt = new Date().toISOString();
await writeJson(experimentsFile, existing);
console.log(JSON.stringify({ ok: true, file: experimentsFile }, null, 2));

