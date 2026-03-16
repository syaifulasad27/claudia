#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(root, '..');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { cwd: root, stdio: 'inherit' });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${script} failed with ${code}`)));
  });
}

await run('scripts/build-personas.js');
await run('scripts/detect-pain-points.js');
await run('scripts/detect-audience-intent.js');
await run('scripts/cluster-topics.js');

const personas = await readJson(path.join(workspace, 'memory', 'audience-personas.json'), { personas: [] });
const topicState = await readJson(path.join(workspace, 'AudienceIntelligence', 'state', 'topic-clusters.json'), { topics: {} });
const intentState = await readJson(path.join(workspace, 'AudienceIntelligence', 'state', 'intent-signals.json'), { intents: [] });
const painState = await readJson(path.join(workspace, 'AudienceIntelligence', 'state', 'pain-points.json'), { painPoints: [] });

const intentCounts = {};
for (const item of intentState.intents || []) {
  intentCounts[item.intent] = (intentCounts[item.intent] || 0) + 1;
}

await writeJson(path.join(workspace, 'memory', 'audience-signals.json'), {
  generatedAt: new Date().toISOString(),
  topicFrequencies: topicState.topics || {},
  intentCounts,
  topPersonas: (personas.personas || []).map((persona) => persona.persona),
  painPoints: painState.painPoints || [],
});

console.log(JSON.stringify({ ok: true, message: 'audience intelligence cycle complete' }, null, 2));

