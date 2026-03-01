#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW_FILE = path.join(ROOT, 'state', 'raw-intel.json');
const BRIEF_JSON = path.join(ROOT, 'state', 'latest-briefing.json');
const BRIEF_MD = path.join(ROOT, 'state', 'latest-briefing.md');
const ALERT_TXT = path.join(ROOT, 'state', 'latest-alert.txt');
const THRESHOLDS_FILE = path.join(ROOT, 'references', 'alert-thresholds.json');

const writeMemoryIdx = process.argv.indexOf('--write-memory');
const writeMemoryPath = writeMemoryIdx > -1 ? process.argv[writeMemoryIdx + 1] : null;

const rank = { LOW: 1, MEDIUM: 2, HIGH: 3 };

const normalizeText = (s = '') => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokenize = (s = '') => new Set(normalizeText(s).split(' ').filter((w) => w.length >= 3));
function jaccard(a, b) { if (!a.size || !b.size) return 0; let i = 0; for (const w of a) if (b.has(w)) i++; const u = a.size + b.size - i; return u ? i / u : 0; }

function classifyImpact(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.impact_raw || ''}`.toLowerCase();
  if (/(nfp|cpi|fomc|rate decision|powell|ecb|boe|war|sanction|missile|default|bank run)/.test(text)) return 'HIGH';
  if (/(pmi|gdp|jobless|treasury|inflation|fed|geopolitical|opec)/.test(text)) return 'MEDIUM';
  return 'LOW';
}
function assetBias(item) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  const out = {};
  if ((item.assets_affected || []).includes('XAUUSD')) out.XAUUSD = /(risk off|war|geopolitical|recession|dovish|rate cut)/.test(text) ? 'bullish' : (/(strong dollar|hawkish|higher yields|rate hike)/.test(text) ? 'bearish' : 'neutral');
  if ((item.assets_affected || []).includes('NASDAQ')) out.NASDAQ = /(dovish|rate cut|ai boom|earnings beat|soft landing)/.test(text) ? 'bullish' : (/(hawkish|higher yields|regulation|earnings miss|risk off)/.test(text) ? 'bearish' : 'neutral');
  return out;
}

function dedup(items, simThreshold = 0.62) {
  const out = [];
  for (const item of items) {
    const t1 = tokenize(`${item.title || ''} ${item.summary || ''}`);
    if (out.some((k) => jaccard(t1, tokenize(`${k.title || ''} ${k.summary || ''}`)) >= simThreshold)) continue;
    out.push(item);
  }
  return out;
}

function addConfirmations(items, simThreshold = 0.55) {
  const groups = [];
  for (const item of items) {
    const tok = tokenize(`${item.title || ''} ${item.summary || ''}`);
    let grouped = false;
    for (const g of groups) {
      const sim = jaccard(tok, g.rep);
      if (sim >= simThreshold) { g.items.push(item); g.sources.add(item.source || 'unknown'); grouped = true; break; }
    }
    if (!grouped) groups.push({ rep: tok, items: [item], sources: new Set([item.source || 'unknown']) });
  }
  return groups.flatMap((g) => g.items.map((it) => ({ ...it, confirmations: g.sources.size })));
}

function computeHealthMarker(sources = {}) {
  const entries = Object.entries(sources).filter(([k]) => k !== 'brave'); // Brave is optional/capped.
  const vals = entries.map(([, v]) => String(v || ''));
  const oks = vals.filter((v) => v.startsWith('ok') || v === 'not-used' || v === 'not-needed-this-cycle').length;
  const total = vals.length || 1;
  if (oks === total) return 'feeds_ok';
  if (oks >= Math.ceil(total / 2)) return 'partial_degraded';
  return 'degraded';
}

function confidenceLabel(item, health) {
  if (!item) return 'LOW';
  if ((item.confirmations || 1) >= 3 && health === 'feeds_ok') return 'HIGH';
  if ((item.confirmations || 1) >= 2 && health !== 'degraded') return 'MEDIUM';
  return 'LOW';
}

function isCriticalByKeyword(item, keywords) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  return keywords.some((k) => text.includes(String(k).toLowerCase()));
}

function pickLevel2(sorted, cfg) {
  const minConfirm = cfg?.level2?.minSourceConfirmations ?? 2;
  const minImpact = cfg?.level2?.minImpact ?? 'HIGH';
  const criticalWords = cfg?.level2?.keywordsCritical ?? [];
  const minRank = rank[minImpact] ?? 3;
  return sorted.find((x) => (rank[x.impact] || 0) >= minRank && ((x.confirmations || 1) >= minConfirm || isCriticalByKeyword(x, criticalWords))) || null;
}

function renderAlert(item, cfg, health) {
  if (!item) return '';
  const tpl = cfg?.telegramTemplate?.format || ['⚠️ MARKET ALERT [LEVEL 2]', 'Event: {title}', 'Impact: {impact} | Confirm: {confirmations} sources', 'Assets: {assets} | Bias: {bias}', 'Action: {action}'];
  const bias = Object.entries(item.bias || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'n/a';
  const assets = (item.assets_affected || []).join(', ') || 'XAUUSD, NASDAQ';
  const action = item.impact === 'HIGH' ? 'caution + monitor closely' : 'monitor';
  const confidence = confidenceLabel(item, health);
  const lines = tpl.map((line) => line.replace('{title}', item.title || 'n/a').replace('{impact}', item.impact || 'n/a').replace('{confirmations}', String(item.confirmations || 1)).replace('{assets}', assets).replace('{bias}', bias).replace('{action}', action));
  lines.push(`Confidence: ${confidence} | Feed: ${health}`);
  return lines.slice(0, (cfg?.telegramTemplate?.maxLines ?? 5) + 1).join('\n');
}

function toMarkdown(brief) {
  return [
    '# Market Intelligence Briefing', '',
    `- Generated: ${brief.generated_at}`,
    `- Health: ${brief.health_marker}`,
    `- Total Items: ${brief.stats.total_items}`,
    `- High Impact: ${brief.stats.high_impact}`,
    `- Sources: ${Object.entries(brief.sources).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    '', '## Top High-Impact',
    ...(brief.top_high.length ? brief.top_high.map((i) => `- **${i.title}** (${i.source}) | Impact: ${i.impact} | Confirm: ${i.confirmations}`) : ['- No high-impact item detected.']),
    '', '## Watchlist', ...brief.watchlist.slice(0, 8).map((i) => `- [${i.impact}] ${i.title} (${i.source})`), ''
  ].join('\n');
}

async function readJson(file, fallback = {}) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }

async function main() {
  const raw = await readJson(RAW_FILE, { items: [], sources: {} });
  const cfg = await readJson(THRESHOLDS_FILE, {});

  const enriched = addConfirmations(dedup(raw.items || []).map((x) => ({ ...x, impact: classifyImpact(x), bias: assetBias(x) })));
  const sorted = enriched.sort((a, b) => ((rank[b.impact] || 0) - (rank[a.impact] || 0)) || ((b.confirmations || 1) - (a.confirmations || 1)));
  const health = computeHealthMarker(raw.sources || {});
  const level2 = pickLevel2(sorted, cfg);

  const brief = {
    generated_at: new Date().toISOString(),
    sources: raw.sources || {},
    health_marker: health,
    stats: {
      total_items: sorted.length,
      high_impact: sorted.filter((x) => x.impact === 'HIGH').length,
      medium_impact: sorted.filter((x) => x.impact === 'MEDIUM').length,
      low_impact: sorted.filter((x) => x.impact === 'LOW').length
    },
    top_high: sorted.filter((x) => x.impact === 'HIGH').slice(0, 5),
    watchlist: sorted.slice(0, 20),
    level2Candidate: level2,
    shouldAlertNow: Boolean(level2),
    confidence: confidenceLabel(level2, health)
  };

  const md = toMarkdown(brief);
  const alert = renderAlert(level2, cfg, health);
  await fs.writeFile(BRIEF_JSON, JSON.stringify(brief, null, 2));
  await fs.writeFile(BRIEF_MD, md);
  await fs.writeFile(ALERT_TXT, alert || '');
  if (writeMemoryPath) await fs.appendFile(writeMemoryPath, `\n\n## ${new Date().toISOString()} — Automated Briefing\n\n${md}\n`);

  console.log(JSON.stringify({ ok: true, json: BRIEF_JSON, markdown: BRIEF_MD, alert: ALERT_TXT, shouldAlertNow: brief.shouldAlertNow, confidence: brief.confidence, health: brief.health_marker }, null, 2));
}

main().catch((err) => { console.error(JSON.stringify({ ok: false, error: err.message }, null, 2)); process.exit(1); });
