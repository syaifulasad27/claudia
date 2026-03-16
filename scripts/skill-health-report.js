#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const usageFile = path.join(root, 'memory', 'skill-usage.json');

const knownSkills = [
  'MarketingIntelligence',
  'AudienceIntelligence',
  'ContentPerformanceAnalysis',
  'ContentLearning',
  'ContentEngine',
  'SalesManager',
  'AgentPlanner',
  'ContentExperimentEngine',
  'repliz-client',
  'self-improving-agent',
  'proactive-agent',
  'skill-vetter',
  'ontology',
];

const payload = await readJson(usageFile, { events: [] });
const events = Array.isArray(payload) ? payload : payload.events || [];

const bySkill = {};
const byPhase = {};
const cycleIds = new Set();
const failureCounts = {};

for (const event of events) {
  bySkill[event.skill] = (bySkill[event.skill] || 0) + 1;
  byPhase[event.phase] = (byPhase[event.phase] || 0) + 1;
  if (event.cycle_id) cycleIds.add(event.cycle_id);
  if (event.metadata?.status === 'failed' || event.metadata?.error) {
    failureCounts[event.skill] = (failureCounts[event.skill] || 0) + 1;
  }
}

const usedSkills = Object.entries(bySkill).sort((a, b) => b[1] - a[1]);
const unusedSkills = knownSkills.filter((skill) => !bySkill[skill]);
const rarelyUsedSkills = usedSkills.filter(([, count]) => count <= 1).map(([skill]) => skill);
const phaseGaps = [
  'Situation Awareness',
  'Marketing Operations',
  'Social Interaction',
  'Sales Monitoring',
  'Learning & Reflection',
  'System Health',
].filter((phase) => !byPhase[phase]);

const lines = [];
lines.push('Skill Health Report');
lines.push('');

if (!usedSkills.length) {
  lines.push('No skill usage events recorded yet.');
} else {
  for (const [skill, count] of usedSkills) {
    lines.push(`${skill}: ${count} executions`);
  }
}

lines.push('');
lines.push(`Heartbeat Cycles Observed: ${cycleIds.size}`);
lines.push('');
lines.push(`Most Used Skills: ${usedSkills.slice(0, 3).map(([skill]) => skill).join(', ') || 'None'}`);
lines.push(`Rarely Used Skills: ${rarelyUsedSkills.join(', ') || 'None'}`);
lines.push(`Unused Skills: ${unusedSkills.join(', ') || 'None'}`);
lines.push(`Phases With No Skill Activity: ${phaseGaps.join(', ') || 'None'}`);

if (Object.keys(failureCounts).length) {
  lines.push('');
  lines.push('Skills With Repeated Failures:');
  for (const [skill, count] of Object.entries(failureCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`${skill}: ${count} failure events`);
  }
}

console.log(lines.join('\n'));
