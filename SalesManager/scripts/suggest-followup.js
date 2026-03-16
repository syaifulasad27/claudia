#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leadsFile = path.join(root, 'memory', 'leads.json');
const leads = await readJson(leadsFile, { leads: [] });
for (const lead of leads.leads || []) {
  if (!lead.followUpSuggestion) {
    lead.followUpSuggestion = lead.intent === 'purchase_intent'
      ? 'Kirim CTA yang konkret dan arahkan ke DM atau link offer.'
      : 'Kirim edukasi singkat lalu ajak diskusi lanjut.';
    lead.updatedAt = new Date().toISOString();
  }
}
await writeJson(leadsFile, leads);
console.log(JSON.stringify({ ok: true, file: leadsFile }, null, 2));

