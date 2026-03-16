#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outFile = path.join(root, 'ContentPerformanceAnalysis', 'state', 'best-posting-times.json');
const windows = ['08:00 WIB', '12:30 WIB', '19:00 WIB'];
await writeJson(outFile, { generatedAt: new Date().toISOString(), windows });
console.log(JSON.stringify({ ok: true, file: outFile, windows }, null, 2));

