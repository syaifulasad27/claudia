#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const USAGE_FILE = path.join(ROOT, 'state', 'usage.json');
const POLICY_FILE = path.join(ROOT, 'references', 'quota-policy.json');
const LOG_FILE = path.join(ROOT, 'state', 'search-log.jsonl');
const OUT_FILE = path.join(ROOT, 'state', 'usage-report.json');

async function readJson(file, fallback = {}) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }

async function readJsonl(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

function pct(used, cap) { return cap ? Math.round((used / cap) * 1000) / 10 : 0; }

async function main() {
  const usage = await readJson(USAGE_FILE, { day: { brave: 0, tavily: 0, total: 0 }, month: { brave: 0, tavily: 0 } });
  const policy = await readJson(POLICY_FILE, { dailyCaps: { brave: 25, tavily: 25, total: 50 }, monthlyCaps: { brave: 1000, tavily: 1000 } });
  const logs = await readJsonl(LOG_FILE);

  const report = {
    ts: new Date().toISOString(),
    dayKey: usage.dayKey,
    monthKey: usage.monthKey,
    usage: usage,
    caps: policy,
    utilization: {
      day: {
        bravePct: pct(usage.day.brave, policy.dailyCaps.brave),
        tavilyPct: pct(usage.day.tavily, policy.dailyCaps.tavily),
        totalPct: pct(usage.day.total, policy.dailyCaps.total)
      },
      month: {
        bravePct: pct(usage.month.brave, policy.monthlyCaps.brave),
        tavilyPct: pct(usage.month.tavily, policy.monthlyCaps.tavily)
      }
    },
    recentQueries: logs.slice(-10)
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
