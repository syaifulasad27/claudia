#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const planFile = path.join(root, 'apps', 'digital-marketing-agent', 'state', 'current-plan.json');
const plan = await readJson(planFile, {});
plan.actions = [
  `Prioritaskan objective: ${plan.primaryObjective || 'awareness'}`,
  `Secondary objective: ${plan.secondaryObjective || 'lead_generation'}`,
  `CTA emphasis: ${plan.strategyAdjustments?.ctaEmphasis || 'balanced'}`,
  `Content frequency: ${plan.strategyAdjustments?.contentFrequency || 'steady'}`,
];
await writeJson(planFile, plan);
console.log(JSON.stringify({ ok: true, file: planFile }, null, 2));

