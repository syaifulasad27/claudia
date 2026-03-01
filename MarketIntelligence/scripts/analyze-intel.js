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

function classifyImpact(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.impact_raw || ''}`.toLowerCase();
  if (/(nfp|cpi|fomc|rate decision|powell|ecb|boe|war|sanction|missile|default|bank run)/.test(text)) return 'HIGH';
  if (/(pmi|gdp|jobless|treasury|inflation|fed|geopolitical|opec)/.test(text)) return 'MEDIUM';
  return 'LOW';
}

function assetBias(item) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  const out = {};
  if ((item.assets_affected || []).includes('XAUUSD')) {
    if (/(risk off|war|geopolitical|recession|dovish|rate cut)/.test(text)) out.XAUUSD = 'bullish';
    else if (/(strong dollar|hawkish|higher yields|rate hike)/.test(text)) out.XAUUSD = 'bearish';
    else out.XAUUSD = 'neutral';
  }
  if ((item.assets_affected || []).includes('NASDAQ')) {
    if (/(dovish|rate cut|ai boom|earnings beat|soft landing)/.test(text)) out.NASDAQ = 'bullish';
    else if (/(hawkish|higher yields|regulation|earnings miss|risk off)/.test(text)) out.NASDAQ = 'bearish';
    else out.NASDAQ = 'neutral';
  }
  return out;
}

function dedup(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = (item.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function addConfirmations(items) {
  const titleMap = new Map();
  for (const it of items) {
    const key = (it.title || '').trim().toLowerCase();
    if (!titleMap.has(key)) titleMap.set(key, new Set());
    titleMap.get(key).add(it.source || 'unknown');
  }
  return items.map((it) => {
    const key = (it.title || '').trim().toLowerCase();
    const confirmations = titleMap.get(key)?.size || 1;
    return { ...it, confirmations };
  });
}

function isCriticalByKeyword(item, keywords) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  return keywords.some((k) => text.includes(String(k).toLowerCase()));
}

function topLevel2(sorted, cfg) {
  const minConfirm = cfg?.level2?.minSourceConfirmations ?? 2;
  const minImpact = cfg?.level2?.minImpact ?? 'HIGH';
  const criticalWords = cfg?.level2?.keywordsCritical ?? [];
  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const minRank = rank[minImpact] ?? 3;

  return sorted.find((x) => {
    const impactOk = (rank[x.impact] || 0) >= minRank;
    const confirmOk = (x.confirmations || 1) >= minConfirm;
    const keywordCritical = isCriticalByKeyword(x, criticalWords);
    return impactOk && (confirmOk || keywordCritical);
  }) || null;
}

function renderAlert(item, cfg) {
  if (!item) return '';
  const template = cfg?.telegramTemplate?.format || [
    '⚠️ MARKET ALERT [LEVEL 2]',
    'Event: {title}',
    'Impact: {impact} | Confirm: {confirmations} sources',
    'Assets: {assets} | Bias: {bias}',
    'Action: {action}'
  ];

  const bias = Object.entries(item.bias || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'n/a';
  const assets = (item.assets_affected || []).join(', ') || 'XAUUSD, NASDAQ';
  const action = item.impact === 'HIGH' ? 'caution + monitor closely' : 'monitor';

  const rendered = template.map((line) => line
    .replace('{title}', item.title || 'n/a')
    .replace('{impact}', item.impact || 'n/a')
    .replace('{confirmations}', String(item.confirmations || 1))
    .replace('{assets}', assets)
    .replace('{bias}', bias)
    .replace('{action}', action)
  );

  const maxLines = cfg?.telegramTemplate?.maxLines ?? 5;
  return rendered.slice(0, maxLines).join('\n');
}

function toMarkdown(brief) {
  const lines = [];
  lines.push(`# Market Intelligence Briefing`);
  lines.push(``);
  lines.push(`- Generated: ${brief.generated_at}`);
  lines.push(`- Total Items: ${brief.stats.total_items}`);
  lines.push(`- High Impact: ${brief.stats.high_impact}`);
  lines.push(`- Sources: ${Object.entries(brief.sources).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(``);
  lines.push(`## Top High-Impact`);
  if (!brief.top_high.length) {
    lines.push(`- No high-impact item detected.`);
  } else {
    for (const item of brief.top_high) {
      const bias = Object.entries(item.bias || {}).map(([k, v]) => `${k}:${v}`).join(', ') || 'n/a';
      lines.push(`- **${item.title}** (${item.source}) | Impact: ${item.impact} | Confirm: ${item.confirmations} | Bias: ${bias}`);
    }
  }
  lines.push(``);
  lines.push(`## Watchlist`);
  for (const item of brief.watchlist.slice(0, 8)) {
    lines.push(`- [${item.impact}] ${item.title} (${item.source})`);
  }
  lines.push(``);
  if (brief.level2Candidate) {
    lines.push(`## Level2 Candidate`);
    lines.push(`- ${brief.level2Candidate.title}`);
    lines.push(`- Impact: ${brief.level2Candidate.impact}, Confirmations: ${brief.level2Candidate.confirmations}`);
    lines.push(``);
  }
  return lines.join('\n');
}

async function readJson(file, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const raw = await readJson(RAW_FILE, { items: [], sources: {} });
  const cfg = await readJson(THRESHOLDS_FILE, {});

  const clean = addConfirmations(dedup(raw.items || []).map((item) => {
    const impact = classifyImpact(item);
    const bias = assetBias(item);
    return { ...item, impact, bias };
  }));

  const sorted = clean.sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if ((rank[b.impact] || 0) !== (rank[a.impact] || 0)) {
      return (rank[b.impact] || 0) - (rank[a.impact] || 0);
    }
    return (b.confirmations || 1) - (a.confirmations || 1);
  });

  const level2 = topLevel2(sorted, cfg);

  const brief = {
    generated_at: new Date().toISOString(),
    sources: raw.sources || {},
    stats: {
      total_items: sorted.length,
      high_impact: sorted.filter((x) => x.impact === 'HIGH').length,
      medium_impact: sorted.filter((x) => x.impact === 'MEDIUM').length,
      low_impact: sorted.filter((x) => x.impact === 'LOW').length
    },
    top_high: sorted.filter((x) => x.impact === 'HIGH').slice(0, 5),
    watchlist: sorted.slice(0, 20),
    level2Candidate: level2,
    shouldAlertNow: Boolean(level2)
  };

  const md = toMarkdown(brief);
  const alertText = renderAlert(level2, cfg);

  await fs.writeFile(BRIEF_JSON, JSON.stringify(brief, null, 2));
  await fs.writeFile(BRIEF_MD, md);
  await fs.writeFile(ALERT_TXT, alertText || '');

  if (writeMemoryPath) {
    await fs.appendFile(writeMemoryPath, `\n\n## ${new Date().toISOString()} — Automated Briefing\n\n${md}\n`);
  }

  console.log(JSON.stringify({ ok: true, json: BRIEF_JSON, markdown: BRIEF_MD, alert: ALERT_TXT, shouldAlertNow: brief.shouldAlertNow }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
