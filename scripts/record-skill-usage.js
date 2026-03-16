#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usageFile = path.join(root, 'memory', 'skill-usage.json');

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

function parseMetadata(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function buildCycleId() {
  return new Date().toISOString().slice(0, 16);
}

const entry = {
  cycle_id: readArg('cycle-id', buildCycleId()),
  phase: readArg('phase', 'unknown'),
  skill: readArg('skill', 'unknown'),
  action: readArg('action', 'unspecified'),
  timestamp: new Date().toISOString(),
  context: readArg('context', 'general'),
  metadata: parseMetadata(readArg('metadata', '')),
};

const current = await readJson(usageFile, { events: [] });
const events = Array.isArray(current) ? current : current.events || [];
events.push(entry);

await writeJson(usageFile, {
  generatedAt: new Date().toISOString(),
  events,
});

console.log(JSON.stringify({ ok: true, file: usageFile, entry }, null, 2));
