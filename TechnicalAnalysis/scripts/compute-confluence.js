#!/usr/bin/env node
/**
 * compute-confluence.js — Multi-Timeframe Confluence Score Engine
 *
 * Fetches indicators across D1, H4, H1, M15 and computes a weighted
 * confluence score for trade decisions.
 *
 * Output: state/confluence-{SYMBOL}.json
 *
 * Usage:
 *   node scripts/compute-confluence.js --url <BRIDGE_URL> --key <API_KEY> --symbol XAUUSD
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const WEIGHTS_FILE = path.join(__dirname, '..', 'references', 'confluence-weights.json');
const INDICATOR_SCRIPT = path.join(__dirname, 'compute-indicators.js');

// Timeframes to analyze
const TIMEFRAMES = ['D1', 'H4', 'H1', 'M15'];

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

// ─── Load indicators for a timeframe ────────────────────────────────
async function loadIndicators(symbol, tf) {
  const file = path.join(STATE_DIR, `indicators-${symbol}-${tf}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Compute indicators for all timeframes ──────────────────────────
async function computeAllTimeframes(url, key, symbol) {
  const results = {};
  for (const tf of TIMEFRAMES) {
    try {
      const { stdout } = await execFileAsync('node', [
        INDICATOR_SCRIPT,
        '--url', url,
        '--key', key,
        '--symbol', symbol,
        '--timeframe', tf,
        '--bars', '200',
      ], { timeout: 30000 });
      results[tf] = JSON.parse(stdout);
    } catch (err) {
      console.error(`Warning: Failed to compute ${tf}: ${err.message}`);
      results[tf] = null;
    }
  }
  return results;
}

// ─── Signal Evaluators ──────────────────────────────────────────────

function evalD1Trend(d1) {
  if (!d1?.trend) return { score: 0, detail: 'No D1 data' };
  const dir = d1.trend.direction;
  if (dir === 'BULLISH') return { score: 1, direction: 'BUY', detail: `D1 trend BULLISH (${d1.trend.ema_order})` };
  if (dir === 'BEARISH') return { score: -1, direction: 'SELL', detail: `D1 trend BEARISH (${d1.trend.ema_order})` };
  return { score: 0, direction: 'NEUTRAL', detail: `D1 trend NEUTRAL` };
}

function evalH4Structure(h4) {
  if (!h4?.ema?.ema20 || !h4?.price) return { score: 0, detail: 'No H4 data' };
  const price = h4.price.current_price;
  const ema20 = h4.ema.ema20.current;
  const ema50 = h4.ema.ema50?.current;

  if (price > ema20 && (!ema50 || price > ema50)) {
    return { score: 1, detail: `H4 price ${price} above EMA20=${ema20?.toFixed(2)} EMA50=${ema50?.toFixed(2) ?? 'N/A'}` };
  }
  if (price < ema20 && (!ema50 || price < ema50)) {
    return { score: -1, detail: `H4 price ${price} below EMA20=${ema20?.toFixed(2)} EMA50=${ema50?.toFixed(2) ?? 'N/A'}` };
  }
  return { score: 0, detail: 'H4 price between EMAs — mixed structure' };
}

function evalH1EmaAlignment(h1) {
  if (!h1?.ema?.ema20 || !h1?.ema?.ema50) return { score: 0, detail: 'No H1 EMA data' };
  const e20 = h1.ema.ema20.current;
  const e50 = h1.ema.ema50.current;
  if (e20 > e50) return { score: 1, detail: `H1 EMA20 (${e20?.toFixed(2)}) > EMA50 (${e50?.toFixed(2)}) — bullish` };
  if (e20 < e50) return { score: -1, detail: `H1 EMA20 (${e20?.toFixed(2)}) < EMA50 (${e50?.toFixed(2)}) — bearish` };
  return { score: 0, detail: 'H1 EMA20 ≈ EMA50 — neutral' };
}

function evalM15Momentum(m15) {
  if (!m15?.price) return { score: 0, detail: 'No M15 data' };
  const change = m15.price.change;
  if (change > 0) return { score: 1, detail: `M15 bullish candle (change: +${change?.toFixed(2)})` };
  if (change < 0) return { score: -1, detail: `M15 bearish candle (change: ${change?.toFixed(2)})` };
  return { score: 0, detail: 'M15 doji / no change' };
}

function evalVolumeConfirmation(h1) {
  if (!h1?.volume) return { score: 0, detail: 'No volume data' };
  if (h1.volume.above_average) {
    return { score: 1, detail: `Volume above avg (ratio: ${h1.volume.ratio}x)` };
  }
  return { score: 0, detail: `Volume below avg (ratio: ${h1.volume.ratio}x)` };
}

function evalRSIFilter(h1, tradeDirection) {
  if (!h1?.rsi?.current) return { score: 0, detail: 'No RSI data' };
  const rsi = h1.rsi.current;
  if (tradeDirection === 'BUY' && rsi >= 30 && rsi <= 70) {
    return { score: 1, detail: `RSI ${rsi?.toFixed(1)} in valid BUY zone (30-70)` };
  }
  if (tradeDirection === 'SELL' && rsi >= 30 && rsi <= 70) {
    return { score: 1, detail: `RSI ${rsi?.toFixed(1)} in valid SELL zone (30-70)` };
  }
  if (rsi > 70) return { score: -1, detail: `RSI ${rsi?.toFixed(1)} OVERBOUGHT — avoid BUY` };
  if (rsi < 30) return { score: -1, detail: `RSI ${rsi?.toFixed(1)} OVERSOLD — avoid SELL` };
  return { score: 0, detail: `RSI ${rsi?.toFixed(1)}` };
}

function evalMacroSentiment(symbol) {
  // Try to load latest MarketIntelligence briefing
  // For now return neutral — will integrate when MI data is available
  return { score: 0, detail: 'Macro sentiment: not evaluated (no MI briefing loaded)' };
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  // Load weights
  const weights = JSON.parse(await fs.readFile(WEIGHTS_FILE, 'utf-8'));

  // Compute indicators for all timeframes
  console.error('Computing indicators for all timeframes...');
  const indicators = await computeAllTimeframes(opts.url, opts.key, opts.symbol);

  const d1 = indicators.D1;
  const h4 = indicators.H4;
  const h1 = indicators.H1;
  const m15 = indicators.M15;

  // Determine primary direction from D1
  const d1Signal = evalD1Trend(d1);
  const tradeDirection = d1Signal.direction || 'NEUTRAL';

  // Evaluate all signals
  const signals = {
    d1_trend: { ...d1Signal, weight: weights.signals.d1_trend.weight },
    h4_structure: { ...evalH4Structure(h4), weight: weights.signals.h4_structure.weight },
    h1_ema_alignment: { ...evalH1EmaAlignment(h1), weight: weights.signals.h1_ema_alignment.weight },
    m15_momentum: { ...evalM15Momentum(m15), weight: weights.signals.m15_momentum.weight },
    volume_confirmation: { ...evalVolumeConfirmation(h1), weight: weights.signals.volume_confirmation.weight },
    rsi_filter: { ...evalRSIFilter(h1, tradeDirection), weight: weights.signals.rsi_filter.weight },
    macro_sentiment: { ...evalMacroSentiment(opts.symbol), weight: weights.signals.macro_sentiment.weight },
  };

  // Calculate total score
  // For directional signals: if direction matches trade_direction → positive, else negative
  let rawScore = 0;
  let maxPossible = 0;
  for (const [key, sig] of Object.entries(signals)) {
    const w = sig.weight;
    maxPossible += w;
    if (tradeDirection === 'NEUTRAL') {
      // No clear direction — score stays at 0 for directional signals
      continue;
    }
    // Align score with trade direction
    if (tradeDirection === 'BUY') rawScore += w * sig.score;
    else if (tradeDirection === 'SELL') rawScore += w * (-sig.score); // invert for sell alignment
  }

  // Normalize to 0-12 scale (max possible = sum of all weights = 12)
  const normalizedScore = Math.max(0, rawScore);

  // Confidence level
  let confidence = 'NO_TRADE';
  let sizeMultiplier = 0;
  if (normalizedScore >= weights.thresholds.high_confidence) {
    confidence = 'HIGH';
    sizeMultiplier = weights.size_multipliers.high;
  } else if (normalizedScore >= weights.thresholds.medium_confidence) {
    confidence = 'MEDIUM';
    sizeMultiplier = weights.size_multipliers.medium;
  }

  // Entry suggestion
  const entrySuggestion = (() => {
    if (confidence === 'NO_TRADE') return null;
    if (!h1?.ema?.ema20?.current || !h1?.atr?.current) return null;

    const ema20 = h1.ema.ema20.current;
    const atr = h1.atr.current;
    const price = h1.price.current_price;
    const extended = h1.price.extended;

    return {
      direction: tradeDirection,
      entry_zone: extended ? `Wait for pullback to EMA20 (${ema20?.toFixed(2)})` : `Current zone acceptable`,
      entry_price: extended ? ema20 : price,
      entry_type: extended ? 'LIMIT' : 'MARKET',
      sl_distance: +(atr * 1.5).toFixed(2),
      suggested_sl: tradeDirection === 'BUY'
        ? +((extended ? ema20 : price) - atr * 1.5).toFixed(2)
        : +((extended ? ema20 : price) + atr * 1.5).toFixed(2),
      suggested_tp: tradeDirection === 'BUY'
        ? +((extended ? ema20 : price) + atr * 3).toFixed(2)
        : +((extended ? ema20 : price) - atr * 3).toFixed(2),
      rr_ratio: '1:2',
    };
  })();

  // Build output
  const output = {
    ok: true,
    symbol: opts.symbol,
    timestamp: new Date().toISOString(),
    trade_direction: tradeDirection,
    confluence_score: normalizedScore,
    max_possible_score: maxPossible,
    confidence,
    size_multiplier: sizeMultiplier,
    decision: confidence === 'NO_TRADE'
      ? `❌ NO TRADE — Score ${normalizedScore}/${maxPossible} below threshold ${weights.thresholds.medium_confidence}`
      : `✅ ${confidence} CONFIDENCE ${tradeDirection} — Score ${normalizedScore}/${maxPossible}`,
    entry_suggestion: entrySuggestion,
    signals,
    timeframe_data_available: {
      D1: !!d1?.ok,
      H4: !!h4?.ok,
      H1: !!h1?.ok,
      M15: !!m15?.ok,
    },
  };

  // Write output
  const filename = `confluence-${opts.symbol}.json`;
  await fs.writeFile(path.join(STATE_DIR, filename), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
