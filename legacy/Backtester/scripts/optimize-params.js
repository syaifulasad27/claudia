#!/usr/bin/env node
/**
 * optimize-params.js — Parameter Sweep Optimizer
 *
 * Tests multiple parameter combinations and ranks by Sharpe ratio.
 * Finds the optimal EMA periods, ATR multiplier, and RR ratio.
 *
 * Output: state/optimization-result.json
 *
 * Usage:
 *   node scripts/optimize-params.js --url <BRIDGE_URL> --key <API_KEY> --symbol XAUUSD --days 30
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const BACKTEST_SCRIPT = path.join(__dirname, 'run-backtest.js');

// ─── CLI Args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { days: 30 };
  for (let i = 0; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, '')] = args[i + 1];
  }
  if (!opts.url || !opts.key || !opts.symbol) {
    console.error(JSON.stringify({ ok: false, error: 'Missing required args: --url, --key, --symbol' }));
    process.exit(1);
  }
  opts.days = parseInt(opts.days, 10);
  return opts;
}

// ─── Parameter Ranges ───────────────────────────────────────────────
const PARAM_RANGES = {
  ema_fast: [10, 15, 20, 25, 30],
  ema_slow: [40, 50, 60],
  atr_mult: [1.0, 1.25, 1.5, 1.75, 2.0],
  rr: [1.5, 2.0, 2.5, 3.0],
};

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  const combinations = [];
  for (const ef of PARAM_RANGES.ema_fast) {
    for (const es of PARAM_RANGES.ema_slow) {
      if (ef >= es) continue; // fast must be less than slow
      for (const am of PARAM_RANGES.atr_mult) {
        for (const rr of PARAM_RANGES.rr) {
          combinations.push({ ema_fast: ef, ema_slow: es, atr_mult: am, rr });
        }
      }
    }
  }

  console.error(`Testing ${combinations.length} parameter combinations...`);

  const results = [];
  let completed = 0;

  for (const combo of combinations) {
    try {
      const { stdout } = await execFileAsync('node', [
        BACKTEST_SCRIPT,
        '--url', opts.url,
        '--key', opts.key,
        '--symbol', opts.symbol,
        '--days', String(opts.days),
        '--ema-fast', String(combo.ema_fast),
        '--ema-slow', String(combo.ema_slow),
        '--atr-mult', String(combo.atr_mult),
        '--rr', String(combo.rr),
      ], { timeout: 60000 });

      const result = JSON.parse(stdout);
      if (result.ok) {
        results.push({
          params: combo,
          metrics: result.metrics,
        });
      }
    } catch (err) {
      // Skip failed combinations
    }

    completed++;
    if (completed % 10 === 0) {
      console.error(`Progress: ${completed}/${combinations.length}`);
    }
  }

  // Rank by Sharpe ratio (primary) and profit factor (secondary)
  results.sort((a, b) => {
    // Filter out negative Sharpe first
    const aSharpe = a.metrics.sharpe_ratio || -999;
    const bSharpe = b.metrics.sharpe_ratio || -999;
    if (aSharpe !== bSharpe) return bSharpe - aSharpe;
    return (b.metrics.profit_factor || 0) - (a.metrics.profit_factor || 0);
  });

  const output = {
    ok: true,
    symbol: opts.symbol,
    days_tested: opts.days,
    combinations_tested: combinations.length,
    combinations_successful: results.length,
    timestamp: new Date().toISOString(),
    top_10: results.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      ...r,
    })),
    best: results.length > 0 ? {
      params: results[0].params,
      metrics: results[0].metrics,
      recommendation: `Use EMA ${results[0].params.ema_fast}/${results[0].params.ema_slow}, ATR×${results[0].params.atr_mult}, RR ${results[0].params.rr}:1`,
    } : null,
    worst: results.length > 0 ? {
      params: results[results.length - 1].params,
      metrics: results[results.length - 1].metrics,
    } : null,
  };

  await fs.writeFile(path.join(STATE_DIR, 'optimization-result.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
