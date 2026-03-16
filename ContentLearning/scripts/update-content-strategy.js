#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const strategyFile = path.join(root, 'memory', 'content-strategy.json');
const learningFile = path.join(root, 'memory', 'content-learning.json');
const strategy = await readJson(strategyFile, {});
const learning = await readJson(learningFile, {});
const next = {
  ...strategy,
  core_topics: Array.from(new Set([...(strategy.core_topics || []), ...(learning.risingThemes || [])])).slice(0, 5),
  preferred_format: learning.topFormats?.length ? learning.topFormats : strategy.preferred_format,
  cta_priority: learning.topCtaStyles?.length ? learning.topCtaStyles : strategy.cta_priority,
  lastUpdated: new Date().toISOString(),
};
await writeJson(strategyFile, next);
console.log(JSON.stringify({ ok: true, file: strategyFile }, null, 2));

