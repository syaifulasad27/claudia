#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKSPACE_ROOT = path.resolve(ROOT, '..');
const writeMemoryIdx = process.argv.indexOf('--write-memory');

function resolveMemoryPath(inputPath) {
  if (!inputPath) return path.resolve(WORKSPACE_ROOT, 'memory', 'macro-insights.md');
  if (path.isAbsolute(inputPath)) return inputPath;

  const normalized = inputPath.replace(/^\.\//, '');
  if (normalized.startsWith('memory/')) return path.resolve(WORKSPACE_ROOT, normalized);
  if (normalized.startsWith('../memory/')) return path.resolve(WORKSPACE_ROOT, normalized.replace(/^\.\.\//, ''));

  // Default: normalize relative paths to workspace root (not MarketIntelligence cwd).
  return path.resolve(WORKSPACE_ROOT, normalized);
}

const writeMemoryPath = resolveMemoryPath(writeMemoryIdx > -1 ? process.argv[writeMemoryIdx + 1] : null);

function run(cmd, args, soft = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    p.on('close', (code) => {
      if (code === 0) return resolve();
      if (soft) return resolve();
      return reject(new Error(`${cmd} ${args.join(' ')} failed (${code})`));
    });
  });
}

async function main() {
  await run('node', ['scripts/fetch-intel.js']);
  await run('node', ['scripts/analyze-intel.js', '--write-memory', writeMemoryPath]);
  await run('node', ['scripts/escalation-check.js']);
  // Phase 6 integration hook (non-fatal): trigger smart-search confirmation when MI alert is low/medium confidence.
  await run('node', ['../smart-search/scripts/integration-hook.js'], true);
  console.log(JSON.stringify({ ok: true, message: 'Market intelligence cycle completed', writeMemoryPath }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
