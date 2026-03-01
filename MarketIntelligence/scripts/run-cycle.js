#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const writeMemoryIdx = process.argv.indexOf('--write-memory');
const writeMemoryPath = writeMemoryIdx > -1 ? process.argv[writeMemoryIdx + 1] : path.resolve(ROOT, '..', 'memory', 'macro-insights.md');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed (${code})`))));
  });
}

async function main() {
  await run('node', ['scripts/fetch-intel.js']);
  await run('node', ['scripts/analyze-intel.js', '--write-memory', writeMemoryPath]);
  console.log(JSON.stringify({ ok: true, message: 'Market intelligence cycle completed', writeMemoryPath }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
