#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { ensureQuota, canUse, useOne, saveQuota, readJson } from './quota-manager.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_DIR = path.join(ROOT, 'state');
const POLICY_FILE = path.join(ROOT, 'references', 'quota-policy.json');
const URGENCY_FILE = path.join(ROOT, 'references', 'urgency-rules.json');
const USAGE_FILE = path.join(STATE_DIR, 'usage.json');
const LOG_FILE = path.join(STATE_DIR, 'search-log.jsonl');
const LATEST_FILE = path.join(STATE_DIR, 'latest-result.json');

const args = process.argv.slice(2);
const qIdx = args.indexOf('--query');
const query = qIdx > -1 ? args[qIdx + 1] : '';
const urgentFlag = args.includes('--urgent');
const needConfirmation = args.includes('--need-confirmation');
const pIdx = args.indexOf('--provider');
const forceProvider = pIdx > -1 ? args[pIdx + 1] : null;

async function ensureState() { await fs.mkdir(STATE_DIR, { recursive: true }); }

function scoreUrgency(query, rules) {
  const q = String(query || '').toLowerCase();
  let score = 0;
  const hits = [];

  for (const kw of (rules.urgentKeywords || [])) {
    if (q.includes(String(kw).toLowerCase())) { score += 1; hits.push(kw); }
  }
  for (const asset of (rules.marketCriticalAssets || [])) {
    if (q.includes(String(asset).toLowerCase())) { score += 1; hits.push(asset); }
  }
  return { score, hits, urgentAuto: score >= (rules.minUrgencyScore ?? 2) };
}

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
    method: 'POST', headers: { 'Content-Type': 'application/json' },
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

function domainFromUrl(u = '') {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function domainQuality(domain = '') {
  const high = ['reuters.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'cnbc.com', 'federalreserve.gov', 'ecb.europa.eu', 'imf.org'];
  const mid = ['investing.com', 'fxstreet.com', 'marketwatch.com', 'yahoo.com'];
  if (high.some((d) => domain.endsWith(d))) return 3;
  if (mid.some((d) => domain.endsWith(d))) return 2;
  return 1;
}

function confidenceScore(items) {
  if (!items.length) return { score: 0, label: 'LOW', reasons: ['no-results'] };

  const providers = new Set(items.map((i) => i.source));
  const domains = items.map((i) => domainFromUrl(i.url)).filter(Boolean);
  const uniqueDomains = new Set(domains);
  const maxDomainQuality = Math.max(...domains.map(domainQuality), 1);

  let score = 0;
  const reasons = [];

  if (providers.size >= 2) { score += 2; reasons.push('multi-provider'); }
  else { score += 1; reasons.push('single-provider'); }

  if (uniqueDomains.size >= 4) { score += 2; reasons.push('broad-domain-coverage'); }
  else if (uniqueDomains.size >= 2) { score += 1; reasons.push('limited-domain-coverage'); }

  score += maxDomainQuality;
  reasons.push(`domain-quality-${maxDomainQuality}`);

  const label = score >= 6 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
  return { score, label, reasons };
}

function mergeAndRank(items) {
  const seen = new Set();
  const merged = [];
  for (const it of items) {
    const key = `${(it.title || '').toLowerCase().trim()}|${domainFromUrl(it.url)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }
  return merged.slice(0, 10);
}

async function appendLog(record) { await fs.appendFile(LOG_FILE, `${JSON.stringify(record)}\n`); }

async function main() {
  await ensureState();
  const policy = await readJson(POLICY_FILE, null);
  const urgencyRules = await readJson(URGENCY_FILE, { minUrgencyScore: 2, urgentKeywords: [], marketCriticalAssets: [] });
  if (!policy) throw new Error('missing quota policy');
  if (!query) throw new Error('missing --query');

  const urgency = scoreUrgency(query, urgencyRules);
  const urgent = urgentFlag || urgency.urgentAuto;

  if (policy.usageRules?.requireUrgent && !urgent) {
    const out = { ok: false, reason: 'blocked-non-urgent', query, urgency };
    await fs.writeFile(LATEST_FILE, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  let quota = await ensureQuota(USAGE_FILE);
  const providers = pickProviders(policy, forceProvider, needConfirmation);
  const fetched = [];
  const providerStatus = {};

  for (const provider of providers) {
    const gate = canUse(quota, policy, provider);
    if (!gate.ok) { providerStatus[provider] = gate.reason; continue; }

    const res = provider === 'brave' ? await braveSearch(query) : await tavilySearch(query);
    providerStatus[provider] = res.reason;

    if (res.ok) {
      quota = useOne(quota, provider);
      fetched.push(...res.items);
    }
  }

  const merged = mergeAndRank(fetched);
  const confidence = confidenceScore(merged);

  await saveQuota(USAGE_FILE, quota);

  const payload = {
    ok: merged.length > 0,
    query,
    urgent,
    urgency,
    needConfirmation,
    providerStatus,
    usage: quota,
    count: merged.length,
    confidence,
    results: merged,
    generatedAt: new Date().toISOString()
  };

  await fs.writeFile(LATEST_FILE, JSON.stringify(payload, null, 2));
  await appendLog({ ts: Date.now(), query, urgent, urgency, needConfirmation, providerStatus, confidence: confidence.label, count: merged.length });
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
