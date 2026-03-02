#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORKSPACE = path.resolve(ROOT, '..');
const MI_BRIEF = path.join(WORKSPACE, 'MarketIntelligence', 'state', 'latest-briefing.json');
const RULES_FILE = path.join(ROOT, 'references', 'integration-rules.json');
const OUT_FILE = path.join(ROOT, 'state', 'integration-result.json');

async function readJson(file, fallback = {}) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }

function wibHour() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  return h;
}

function buildQuery(template, event) {
  return String(template || 'urgent confirmation for {event} impact on XAUUSD').replace('{event}', event || 'high impact macro event');
}

function runSmartSearch(query) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', ['scripts/smart-search.js', '--query', query, '--need-confirmation'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `smart-search failed ${code}`));
      try { resolve(JSON.parse(out)); } catch { resolve({ ok: false, raw: out }); }
    });
  });
}

async function main() {
  const rules = await readJson(RULES_FILE, {});
  const brief = await readJson(MI_BRIEF, {});
  const start = rules?.triggerWindowsWIB?.startHour ?? 19;
  const end = rules?.triggerWindowsWIB?.endHour ?? 23;
  const hour = wibHour();
  const inWindow = hour >= start && hour <= end;

  const shouldAlert = Boolean(brief?.shouldAlertNow);
  const conf = String(brief?.confidence || 'LOW').toUpperCase();
  const allowedConf = new Set((rules?.triggerWhen?.marketIntelligence?.confidenceIn || ['LOW', 'MEDIUM']).map((x) => String(x).toUpperCase()));

  if (!inWindow || !shouldAlert || !allowedConf.has(conf)) {
    const result = { ok: true, triggered: false, reason: { inWindow, shouldAlert, confidence: conf }, ts: new Date().toISOString() };
    await fs.writeFile(OUT_FILE, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const event = brief?.level2Candidate?.title || brief?.top_high?.[0]?.title || 'high impact event';
  const query = buildQuery(rules?.queryTemplate, event);
  const search = await runSmartSearch(query);

  const result = { ok: true, triggered: true, query, event, searchSummary: { ok: search.ok, count: search.count, confidence: search.confidence, providerStatus: search.providerStatus }, ts: new Date().toISOString() };
  await fs.writeFile(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (err) => {
  const fail = { ok: false, error: err.message, ts: new Date().toISOString() };
  await fs.writeFile(OUT_FILE, JSON.stringify(fail, null, 2));
  console.error(JSON.stringify(fail, null, 2));
  process.exit(1);
});
