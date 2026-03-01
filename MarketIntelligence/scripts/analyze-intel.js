#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW_FILE = path.join(ROOT, 'state', 'raw-intel.json');
const BRIEF_JSON = path.join(ROOT, 'state', 'latest-briefing.json');
const BRIEF_MD = path.join(ROOT, 'state', 'latest-briefing.md');

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
      lines.push(`- **${item.title}** (${item.source}) | Impact: ${item.impact} | Bias: ${bias}`);
    }
  }
  lines.push(``);
  lines.push(`## Watchlist`);
  for (const item of brief.watchlist.slice(0, 8)) {
    lines.push(`- [${item.impact}] ${item.title} (${item.source})`);
  }
  lines.push(``);
  return lines.join('\n');
}

async function main() {
  const raw = JSON.parse(await fs.readFile(RAW_FILE, 'utf8'));
  const clean = dedup(raw.items || []).map((item) => {
    const impact = classifyImpact(item);
    const bias = assetBias(item);
    return { ...item, impact, bias };
  });

  const sorted = clean.sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (rank[b.impact] || 0) - (rank[a.impact] || 0);
  });

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
    watchlist: sorted.slice(0, 20)
  };

  const md = toMarkdown(brief);
  await fs.writeFile(BRIEF_JSON, JSON.stringify(brief, null, 2));
  await fs.writeFile(BRIEF_MD, md);

  if (writeMemoryPath) {
    await fs.appendFile(writeMemoryPath, `\n\n## ${new Date().toISOString()} — Automated Briefing\n\n${md}\n`);
  }

  console.log(JSON.stringify({ ok: true, json: BRIEF_JSON, markdown: BRIEF_MD, high: brief.stats.high_impact }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
