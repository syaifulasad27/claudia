#!/usr/bin/env node
/**
 * detect-levels.js — Support/Resistance Level Detection
 *
 * Identifies key price levels from swing highs/lows and EMA zones.
 * Output: state/levels-{SYMBOL}.json
 *
 * Usage:
 *   node scripts/detect-levels.js --url <BRIDGE_URL> --key <API_KEY> --symbol XAUUSD
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');

// ─── CLI Args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, '')] = args[i + 1];
  }
  if (!opts.url || !opts.key || !opts.symbol) {
    console.error(JSON.stringify({ ok: false, error: 'Missing required args: --url, --key, --symbol' }));
    process.exit(1);
  }
  return opts;
}

// ─── Bridge API ─────────────────────────────────────────────────────
async function fetchMarketData(url, apiKey, symbol, timeframe, bars) {
  const res = await fetch(`${url}/market-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ symbol, timeframe, bars }),
  });
  if (!res.ok) throw new Error(`Bridge API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Swing Detection ────────────────────────────────────────────────

/**
 * Detect swing highs and lows using a window-based approach.
 * A swing high is a bar where the high is higher than `window` bars on each side.
 */
function detectSwings(highs, lows, window = 5) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = window; i < highs.length - window; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= window; j++) {
      if (highs[i] <= highs[i - j] || highs[i] <= highs[i + j]) isHigh = false;
      if (lows[i] >= lows[i - j] || lows[i] >= lows[i + j]) isLow = false;
    }

    if (isHigh) swingHighs.push({ index: i, price: highs[i] });
    if (isLow) swingLows.push({ index: i, price: lows[i] });
  }

  return { swingHighs, swingLows };
}

/**
 * Cluster nearby levels (within tolerance) into zones.
 * Returns array of { price, strength, touches } sorted by strength.
 */
function clusterLevels(levels, tolerance) {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const clusters = [];
  let current = { prices: [sorted[0].price], indices: [sorted[0].index] };

  for (let i = 1; i < sorted.length; i++) {
    const avg = current.prices.reduce((a, b) => a + b, 0) / current.prices.length;
    if (Math.abs(sorted[i].price - avg) <= tolerance) {
      current.prices.push(sorted[i].price);
      current.indices.push(sorted[i].index);
    } else {
      clusters.push(current);
      current = { prices: [sorted[i].price], indices: [sorted[i].index] };
    }
  }
  clusters.push(current);

  return clusters.map(c => ({
    price: +(c.prices.reduce((a, b) => a + b, 0) / c.prices.length).toFixed(5),
    strength: c.prices.length,
    touches: c.prices.length,
  })).sort((a, b) => b.strength - a.strength);
}

// ─── EMA as dynamic levels ──────────────────────────────────────────
function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  const ema = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  // Fetch multi-timeframe data
  const [h1Data, h4Data, d1Data] = await Promise.all([
    fetchMarketData(opts.url, opts.key, opts.symbol, 'H1', 200),
    fetchMarketData(opts.url, opts.key, opts.symbol, 'H4', 100),
    fetchMarketData(opts.url, opts.key, opts.symbol, 'D1', 60),
  ]);

  const currentPrice = h1Data.tick?.bid || h1Data.candles[h1Data.candles.length - 1].close;

  // Process each timeframe
  const processTimeframe = (data, tf, swingWindow) => {
    const highs = data.candles.map(c => c.high);
    const lows = data.candles.map(c => c.low);
    const closes = data.candles.map(c => c.close);

    // ATR for tolerance
    const atr14 = (() => {
      const tr = [highs[0] - lows[0]];
      for (let i = 1; i < closes.length; i++) {
        tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
      }
      let sum = 0;
      for (let i = 0; i < 14 && i < tr.length; i++) sum += tr[i];
      return sum / Math.min(14, tr.length);
    })();

    const tolerance = atr14 * 0.3; // Levels within 30% of ATR are clustered

    const { swingHighs, swingLows } = detectSwings(highs, lows, swingWindow);

    const resistanceLevels = clusterLevels(swingHighs, tolerance);
    const supportLevels = clusterLevels(swingLows, tolerance);

    // EMA dynamic levels
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);

    return {
      timeframe: tf,
      atr: +atr14.toFixed(5),
      tolerance: +tolerance.toFixed(5),
      resistance: resistanceLevels.slice(0, 5), // top 5
      support: supportLevels.slice(0, 5),
      ema_levels: {
        ema20: ema20[ema20.length - 1] ? +ema20[ema20.length - 1].toFixed(5) : null,
        ema50: ema50[ema50.length - 1] ? +ema50[ema50.length - 1].toFixed(5) : null,
      },
    };
  };

  const h1 = processTimeframe(h1Data, 'H1', 5);
  const h4 = processTimeframe(h4Data, 'H4', 3);
  const d1 = processTimeframe(d1Data, 'D1', 3);

  // Merge and find nearest levels to current price
  const allResistance = [
    ...h1.resistance.map(l => ({ ...l, tf: 'H1' })),
    ...h4.resistance.map(l => ({ ...l, tf: 'H4' })),
    ...d1.resistance.map(l => ({ ...l, tf: 'D1' })),
  ].filter(l => l.price > currentPrice)
   .sort((a, b) => a.price - b.price)
   .slice(0, 5);

  const allSupport = [
    ...h1.support.map(l => ({ ...l, tf: 'H1' })),
    ...h4.support.map(l => ({ ...l, tf: 'H4' })),
    ...d1.support.map(l => ({ ...l, tf: 'D1' })),
  ].filter(l => l.price < currentPrice)
   .sort((a, b) => b.price - a.price)
   .slice(0, 5);

  const output = {
    ok: true,
    symbol: opts.symbol,
    timestamp: new Date().toISOString(),
    current_price: currentPrice,
    nearest_resistance: allResistance[0] || null,
    nearest_support: allSupport[0] || null,
    key_levels: {
      resistance: allResistance,
      support: allSupport,
    },
    ema_zones: {
      H1: h1.ema_levels,
      H4: h4.ema_levels,
      D1: d1.ema_levels,
    },
    by_timeframe: { H1: h1, H4: h4, D1: d1 },
  };

  const filename = `levels-${opts.symbol}.json`;
  await fs.writeFile(path.join(STATE_DIR, filename), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
