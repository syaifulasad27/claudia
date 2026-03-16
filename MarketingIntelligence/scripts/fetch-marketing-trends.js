#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTrendSignals } from '../../packages/integrations/trend-sources.js';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outFile = path.join(root, 'MarketingIntelligence', 'state', 'marketing-trends.json');
const leadsFile = path.join(root, 'memory', 'leads.json');

const leads = await readJson(leadsFile, { leads: [] });
const baseTrends = await fetchTrendSignals();
const leadQuestions = leads.leads.slice(-10).map((lead) => lead.intent).filter(Boolean);
const result = {
  generatedAt: new Date().toISOString(),
  trends: baseTrends.map((trend) => ({
    ...trend,
    relatedLeadIntents: leadQuestions.filter((intent) => intent.includes('intent')).slice(0, 3),
  })),
};
await writeJson(outFile, result);
console.log(JSON.stringify({ ok: true, file: outFile, count: result.trends.length }, null, 2));

