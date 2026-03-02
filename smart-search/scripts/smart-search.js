#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { ensureQuota, canUse, useOne, saveQuota, readJson } from './quota-manager.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_DIR = path.join(ROOT, 'state');
const POLICY_FILE = path.join(ROOT, 'references', 'quota-policy.json');
const USAGE_FILE = path.join(STATE_DIR, 'usage.json');
const LOG_FILE = path.join(STATE_DIR, 'search-log.jsonl');
const LATEST_FILE = path.join(STATE_DIR, 'latest-result.json');

const args = process.argv.slice(2);
const qIdx = args.indexOf('--query');
const query = qIdx > -1 ? args[qIdx + 1] : '';
const urgent = args.includes('--urgent');
const needConfirmation = args.includes('--need-confirmation');
const pIdx = args.indexOf('--provider');
const forceProvider = pIdx > -1 ? args[pIdx + 1] : null;

async function ensureState() { await fs.mkdir(STATE_DIR, { recursive: true }); }

async function braveSearch(query) {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return { ok: false, reason: 'missing-brave-key', items: [] };
  const qs = new URLSearchParams({ q: query, count: '5', freshness: 'pd' });
  const url = `https://api.search.brave.com/res/v1/web/search?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  if (!res.ok) return { ok: false, reason: `brave-http-${res.status}`, items: [] };
  const json = await res.json();
  const items = (json?.web?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, source: 'brave' }));
  return { ok: true, reason: 'ok', items };
}

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { ok: false, reason: 'missing-tavily-key', items: [] };
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, search_depth: 'advanced', max_results: 5 })
  });
  if (!res.ok) return { ok: false, reason: `tavily-http-${res.status}`, items: [] };
  const json = await res.json();
  const items = (json?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, source: 'tavily' }));
  return { ok: true, reason: 'ok', items };
}

function pickProviders(policy, forceProvider, needConfirmation) {
  if (forceProvider) return [forceProvider];
  const order = policy.providerOrder || ['brave', 'tavily'];
  return needConfirmation ? order : [order[0]];
}

async function appendLog(record) {
  await fs.appendFile(LOG_FILE, `${JSON.stringify(record)}\n`);
}

async function main() {
  await ensureState();
  const policy = await readJson(POLICY_FILE, null);
  if (!policy) throw new Error('missing quota policy');

  if (!query) throw new Error('missing --query');
  if (policy.usageRules?.requireUrgent && !urgent) {
    const out = { ok: false, reason: 'blocked-non-urgent', query };
    await fs.writeFile(LATEST_FILE, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  let quota = await ensureQuota(USAGE_FILE);
  const providers = pickProviders(policy, forceProvider, needConfirmation);
  const results = [];
  const providerStatus = {};

  for (const provider of providers) {
    const gate = canUse(quota, policy, provider);
    if (!gate.ok) {
      providerStatus[provider] = gate.reason;
      continue;
    }

    const res = provider === 'brave' ? await braveSearch(query) : await tavilySearch(query);
    providerStatus[provider] = res.reason;

    if (res.ok) {
      quota = useOne(quota, provider);
      results.push(...res.items);
    }
  }

  await saveQuota(USAGE_FILE, quota);

  const payload = {
    ok: results.length > 0,
    query,
    urgent,
    needConfirmation,
    providerStatus,
    usage: quota,
    count: results.length,
    results,
    generatedAt: new Date().toISOString()
  };

  await fs.writeFile(LATEST_FILE, JSON.stringify(payload, null, 2));
  await appendLog({ ts: Date.now(), query, urgent, needConfirmation, providerStatus, count: results.length });
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
