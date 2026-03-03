#!/usr/bin/env node
/**
 * compute-indicators.js — Technical Indicator Calculator
 *
 * Fetches OHLCV data from Bridge API and computes all indicators precisely.
 * Output: state/indicators-{SYMBOL}-{TF}.json
 *
 * Usage:
 *   node scripts/compute-indicators.js --url <BRIDGE_URL> --key <API_KEY> --symbol XAUUSD --timeframe H1 --bars 200
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const PARAMS_FILE = path.join(__dirname, '..', 'references', 'indicator-params.json');

// ─── CLI Args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { bars: 200 };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    opts[key] = args[i + 1];
  }
  if (!opts.url || !opts.key || !opts.symbol || !opts.timeframe) {
    console.error(JSON.stringify({ ok: false, error: 'Missing required args: --url, --key, --symbol, --timeframe' }));
    process.exit(1);
  }
  opts.bars = parseInt(opts.bars, 10);
  return opts;
}

// ─── Bridge API Fetch ───────────────────────────────────────────────
async function fetchMarketData(url, apiKey, symbol, timeframe, bars) {
  const res = await fetch(`${url}/market-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ symbol, timeframe, bars }),
  });
  if (!res.ok) {
    throw new Error(`Bridge API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── Indicator Math Functions ───────────────────────────────────────

/** Exponential Moving Average */
function calcEMA(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const ema = new Array(closes.length).fill(null);

  // SMA for seed
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/** Simple Moving Average */
function calcSMA(data, period) {
  if (data.length < period) return [];
  const sma = new Array(data.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  sma[period - 1] = sum / period;
  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    sma[i] = sum / period;
  }
  return sma;
}

/** Average True Range */
function calcATR(highs, lows, closes, period) {
  if (closes.length < 2) return [];
  const tr = new Array(closes.length).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }
  // Wilder's smoothing (RMA)
  const atr = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

/** Relative Strength Index */
function calcRSI(closes, period) {
  if (closes.length < period + 1) return [];
  const rsi = new Array(closes.length).fill(null);
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Initial average
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/** MACD (Moving Average Convergence Divergence) */
function calcMACD(closes, fast, slow, signal) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = [];
  const validIndices = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      validMacd.push(macdLine[i]);
      validIndices.push(i);
    }
  }

  const signalEma = calcEMA(validMacd, signal);
  const signalLine = new Array(closes.length).fill(null);
  const histogram = new Array(closes.length).fill(null);

  for (let j = 0; j < signalEma.length; j++) {
    const idx = validIndices[j];
    if (signalEma[j] !== null) {
      signalLine[idx] = signalEma[j];
      histogram[idx] = macdLine[idx] - signalEma[j];
    }
  }

  return { macdLine, signalLine, histogram };
}

/** Bollinger Bands */
function calcBollinger(closes, period, stddev) {
  const sma = calcSMA(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  const width = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    if (sma[i] === null) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - sma[i]) ** 2;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = sma[i] + stddev * sd;
    lower[i] = sma[i] - stddev * sd;
    width[i] = sma[i] > 0 ? ((upper[i] - lower[i]) / sma[i]) * 100 : 0;
  }

  return { middle: sma, upper, lower, width };
}

/** Standard Pivot Points (from daily OHLC) */
function calcPivotPoints(high, low, close) {
  const pp = (high + low + close) / 3;
  return {
    pp,
    r1: 2 * pp - low,
    r2: pp + (high - low),
    r3: high + 2 * (pp - low),
    s1: 2 * pp - high,
    s2: pp - (high - low),
    s3: low - 2 * (high - pp),
  };
}

/** Fibonacci Retracement from swing high/low */
function calcFibonacci(highs, lows, levels, lookback) {
  const len = Math.min(highs.length, lookback);
  const slice_h = highs.slice(-len);
  const slice_l = lows.slice(-len);

  const swingHigh = Math.max(...slice_h);
  const swingLow = Math.min(...slice_l);
  const range = swingHigh - swingLow;

  // Determine trend: if last close > midpoint → uptrend (retrace from high)
  const midpoint = (swingHigh + swingLow) / 2;
  const lastPrice = highs[highs.length - 1]; // approximate

  const fibs = {};
  for (const lvl of levels) {
    // Uptrend: retracement down from high
    fibs[`${(lvl * 100).toFixed(1)}%`] = {
      retrace_down: swingHigh - range * lvl,
      retrace_up: swingLow + range * lvl,
    };
  }

  return {
    swing_high: swingHigh,
    swing_low: swingLow,
    range,
    levels: fibs,
  };
}

/** Average volume over N bars */
function calcAvgVolume(volumes, period = 20) {
  if (volumes.length < period) return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recent = volumes.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / period;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  // Load params
  const params = JSON.parse(await fs.readFile(PARAMS_FILE, 'utf-8'));

  // Fetch data
  const data = await fetchMarketData(opts.url, opts.key, opts.symbol, opts.timeframe, opts.bars);
  const candles = data.candles;

  if (!candles || candles.length < 50) {
    console.error(JSON.stringify({ ok: false, error: `Insufficient data: ${candles?.length || 0} candles` }));
    process.exit(1);
  }

  // Extract arrays
  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const times = candles.map(c => c.time);

  // Current values helper
  const last = (arr) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null) return arr[i];
    }
    return null;
  };

  // ── Compute all indicators ──

  // EMA
  const emaResults = {};
  for (const period of params.ema.periods) {
    const ema = calcEMA(closes, period);
    emaResults[`ema${period}`] = {
      current: last(ema),
      previous: ema[ema.length - 2] ?? null,
    };
  }

  // ATR
  const atr = calcATR(highs, lows, closes, params.atr.period);
  const atrResult = {
    current: last(atr),
    previous: atr[atr.length - 2] ?? null,
    sl_distance: last(atr) ? last(atr) * 1.5 : null,
  };

  // RSI
  const rsi = calcRSI(closes, params.rsi.period);
  const rsiCurrent = last(rsi);
  const rsiResult = {
    current: rsiCurrent,
    previous: rsi[rsi.length - 2] ?? null,
    overbought: rsiCurrent !== null ? rsiCurrent > params.rsi.overbought : null,
    oversold: rsiCurrent !== null ? rsiCurrent < params.rsi.oversold : null,
    zone: rsiCurrent !== null
      ? (rsiCurrent > params.rsi.overbought ? 'OVERBOUGHT' : rsiCurrent < params.rsi.oversold ? 'OVERSOLD' : 'NEUTRAL')
      : null,
  };

  // MACD
  const macd = calcMACD(closes, params.macd.fast, params.macd.slow, params.macd.signal);
  const macdResult = {
    macd_line: last(macd.macdLine),
    signal_line: last(macd.signalLine),
    histogram: last(macd.histogram),
    crossover: (() => {
      const len = macd.histogram.length;
      const curr = macd.histogram[len - 1];
      const prev = macd.histogram[len - 2];
      if (curr === null || prev === null) return 'NONE';
      if (prev < 0 && curr > 0) return 'BULLISH_CROSS';
      if (prev > 0 && curr < 0) return 'BEARISH_CROSS';
      return 'NONE';
    })(),
    momentum: last(macd.histogram) > 0 ? 'BULLISH' : 'BEARISH',
  };

  // Bollinger Bands
  const bb = calcBollinger(closes, params.bollinger.period, params.bollinger.stddev);
  const lastClose = closes[closes.length - 1];
  const bbResult = {
    upper: last(bb.upper),
    middle: last(bb.middle),
    lower: last(bb.lower),
    width: last(bb.width),
    position: (() => {
      const u = last(bb.upper);
      const l = last(bb.lower);
      if (!u || !l) return null;
      return ((lastClose - l) / (u - l) * 100).toFixed(1) + '%';
    })(),
    squeeze: last(bb.width) !== null && last(bb.width) < 2 ? true : false,
  };

  // Pivot Points (use last complete candle high/low/close as daily proxy)
  const pivotResult = calcPivotPoints(
    highs[highs.length - 2],
    lows[lows.length - 2],
    closes[closes.length - 2]
  );

  // Fibonacci
  const fibResult = calcFibonacci(
    highs, lows,
    params.fibonacci.levels,
    params.fibonacci.lookback_bars
  );

  // Volume
  const avgVol = calcAvgVolume(volumes);
  const currentVol = volumes[volumes.length - 1];
  const volumeResult = {
    current: currentVol,
    average_20: avgVol,
    ratio: avgVol > 0 ? +(currentVol / avgVol).toFixed(2) : null,
    above_average: currentVol > avgVol,
  };

  // Price context
  const ema20Current = emaResults.ema20?.current;
  const priceContext = {
    current_price: lastClose,
    previous_close: closes[closes.length - 2],
    change: lastClose - closes[closes.length - 2],
    change_pct: ((lastClose - closes[closes.length - 2]) / closes[closes.length - 2] * 100).toFixed(3),
    distance_to_ema20: ema20Current ? +(lastClose - ema20Current).toFixed(5) : null,
    distance_to_ema20_in_atr: (ema20Current && atrResult.current)
      ? +((lastClose - ema20Current) / atrResult.current).toFixed(3)
      : null,
    extended: (ema20Current && atrResult.current)
      ? Math.abs(lastClose - ema20Current) > atrResult.current * 0.5
      : null,
  };

  // Trend assessment
  const trendAssessment = (() => {
    const e20 = emaResults.ema20?.current;
    const e50 = emaResults.ema50?.current;
    const e200 = emaResults.ema200?.current;
    if (!e20 || !e50) return { direction: 'UNKNOWN', strength: 'UNKNOWN' };

    const bullish_alignment = e20 > e50 && (e200 ? e50 > e200 : true);
    const bearish_alignment = e20 < e50 && (e200 ? e50 < e200 : true);

    let direction = 'NEUTRAL';
    if (bullish_alignment) direction = 'BULLISH';
    else if (bearish_alignment) direction = 'BEARISH';

    const strength = e200
      ? (bullish_alignment || bearish_alignment ? 'STRONG' : 'WEAK')
      : 'MODERATE';

    return { direction, strength, ema_order: `EMA20=${e20?.toFixed(2)} EMA50=${e50?.toFixed(2)} EMA200=${e200?.toFixed(2) ?? 'N/A'}` };
  })();

  // ── Build output ──
  const output = {
    ok: true,
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    bars: candles.length,
    timestamp: new Date().toISOString(),
    last_candle_time: times[times.length - 1],
    price: priceContext,
    trend: trendAssessment,
    ema: emaResults,
    atr: atrResult,
    rsi: rsiResult,
    macd: macdResult,
    bollinger: bbResult,
    pivot_points: pivotResult,
    fibonacci: fibResult,
    volume: volumeResult,
    tick: data.tick,
    spread: data.spread,
  };

  // Round all numeric values to 5 decimal places
  const rounded = JSON.parse(JSON.stringify(output, (k, v) =>
    typeof v === 'number' ? +v.toFixed(5) : v
  ));

  // Write output
  const filename = `indicators-${opts.symbol}-${opts.timeframe}.json`;
  await fs.writeFile(path.join(STATE_DIR, filename), JSON.stringify(rounded, null, 2));
  console.log(JSON.stringify(rounded, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
