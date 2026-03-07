#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace/claudia';
const LEARN_DIR = path.join(ROOT, '.learnings');
const MAP = {
  learning: 'LEARNINGS.md',
  error: 'ERRORS.md',
  feature: 'FEATURE_REQUESTS.md'
};

function nowDate() {
  return new Date().toISOString();
}

function sanitize(v) {
  return String(v || '')
    .replace(/sk-[a-z0-9_-]{10,}/gi, '[REDACTED_KEY]')
    .replace(/(token|secret|apikey|api_key)\s*[:=]\s*[^\s]+/gi, '$1=[REDACTED]')
    .trim();
}

async function append(kind, title, body) {
  await fs.mkdir(LEARN_DIR, { recursive: true });
  const file = path.join(LEARN_DIR, MAP[kind] || MAP.learning);
  const entry = `\n## [${nowDate()}] ${sanitize(title)}\n${sanitize(body)}\n`;
  await fs.appendFile(file, entry, 'utf-8');
}

async function main() {
  const kind = process.argv[2] || 'learning';
  const title = process.argv[3] || 'Auto log';
  const body = process.argv.slice(4).join(' ') || 'No details';
  await append(kind, title, body);
  console.log(`logged:${kind}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
