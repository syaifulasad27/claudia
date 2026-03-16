#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { cwd: root, stdio: 'inherit' });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${script} failed with ${code}`)));
  });
}

await run('scripts/fetch-marketing-trends.js');
await run('scripts/analyze-audience-sentiment.js');
await run('scripts/generate-content-ideas.js');
console.log(JSON.stringify({ ok: true, message: 'marketing intelligence cycle complete' }, null, 2));

