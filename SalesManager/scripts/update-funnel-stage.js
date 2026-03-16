#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leads = await readJson(path.join(root, 'memory', 'leads.json'), { leads: [] });
const funnelFile = path.join(root, 'memory', 'sales-funnel.json');
const stages = { AWARENESS: [], INTEREST: [], CONSIDERATION: [], PURCHASE: [] };
for (const lead of leads.leads || []) {
  const stage = lead.stage || 'AWARENESS';
  if (!stages[stage]) stages[stage] = [];
  stages[stage].push(lead);
}
await writeJson(funnelFile, {
  generatedAt: new Date().toISOString(),
  stages,
  metrics: {
    total_leads: (leads.leads || []).length,
    conversion_rate: (stages.PURCHASE.length || 0) / Math.max((leads.leads || []).length, 1),
    follow_up_pending: (leads.leads || []).filter((lead) => lead.status !== 'closed').length,
  },
});
console.log(JSON.stringify({ ok: true, file: funnelFile }, null, 2));

