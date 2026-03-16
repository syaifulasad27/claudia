#!/usr/bin/env node
/**
 * run-backtest.js — Strategy Backtesting Engine
 *
 * Simulates trading strategy on historical OHLCV data.
 * Calculates win rate, profit factor, max drawdown, Sharpe ratio.
 *
 * Usage:
 *   node scripts/run-backtest.js --url <BRIDGE_URL> --key <API_KEY> --symbol XAUUSD --days 30
 *   node scripts/run-backtest.js --url <URL> --key <KEY> --symbol XAUUSD --days 60 --ema-fast 20 --ema-slow 50 --atr-mult 1.5 --rr 2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const STRATEGY_FILE = path.join(__dirname, '..', 'references', 'default-strategy.json');

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

// ─── Bridge API ─────────────────────────────────────────────────────
async function fetchMarketData(url, apiKey, symbol, timeframe, bars) {
  const res = await fetch(`${url}/market-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ symbol, timeframe, bars }),
  });
  if (!res.ok) throw new Error(`Bridge API error ${res.status}`);
  return res.json();
}

// ─── Indicator Functions (copied from TechnicalAnalysis for self-containment) ──
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

function calcATR(highs, lows, closes, period) {
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const atr = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

function calcRSI(closes, period) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return rsi;
  const gains = [], losses = [];
  for (let i = 1; i < closes.length; i++) {
    const c = closes[i] - closes[i - 1];
    gains.push(c > 0 ? c : 0);
    losses.push(c < 0 ? -c : 0);
  }
  let ag = 0, al = 0;
  for (let i = 0; i < period; i++) { ag += gains[i]; al += losses[i]; }
  ag /= period; al /= period;
  rsi[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period; i < gains.length; i++) {
    ag = (ag * (period - 1) + gains[i]) / period;
    al = (al * (period - 1) + losses[i]) / period;
    rsi[i + 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return rsi;
}

// ─── Backtest Engine ────────────────────────────────────────────────
function runBacktest(candles, strategy) {
  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const times = candles.map(c => c.time);

  const emaFast = calcEMA(closes, strategy.ema_fast);
  const emaSlow = calcEMA(closes, strategy.ema_slow);
  const atr = calcATR(highs, lows, closes, strategy.atr_period);
  const rsi = calcRSI(closes, strategy.rsi_period);

  const trades = [];
  let equity = strategy.initial_equity;
  let peak = equity;
  let maxDrawdown = 0;
  let inTrade = false;
  let tradeEntry = null;

  // Minimum bars needed before we can trade
  const startBar = Math.max(strategy.ema_slow, strategy.atr_period, strategy.rsi_period) + 1;

  for (let i = startBar; i < candles.length; i++) {
    // Skip if indicators not ready
    if (!emaFast[i] || !emaSlow[i] || !atr[i] || rsi[i] === null) continue;

    // ── Exit logic (if in trade) ──
    if (inTrade && tradeEntry) {
      const t = tradeEntry;
      const isBuy = t.direction === 'BUY';

      // Check SL hit
      if (isBuy && lows[i] <= t.sl) {
        const pnl = (t.sl - t.entry) * t.volume * 100; // approximate
        equity += pnl;
        trades.push({ ...t, exit: t.sl, exit_time: times[i], exit_bar: i, pnl: +pnl.toFixed(2), exit_reason: 'SL_HIT' });
        inTrade = false; tradeEntry = null;
        continue;
      }
      if (!isBuy && highs[i] >= t.sl) {
        const pnl = (t.entry - t.sl) * t.volume * 100;
        equity += pnl;
        trades.push({ ...t, exit: t.sl, exit_time: times[i], exit_bar: i, pnl: +pnl.toFixed(2), exit_reason: 'SL_HIT' });
        inTrade = false; tradeEntry = null;
        continue;
      }

      // Check TP hit
      if (isBuy && highs[i] >= t.tp) {
        const pnl = (t.tp - t.entry) * t.volume * 100;
        equity += pnl;
        trades.push({ ...t, exit: t.tp, exit_time: times[i], exit_bar: i, pnl: +pnl.toFixed(2), exit_reason: 'TP_HIT' });
        inTrade = false; tradeEntry = null;
        continue;
      }
      if (!isBuy && lows[i] <= t.tp) {
        const pnl = (t.entry - t.tp) * t.volume * 100;
        equity += pnl;
        trades.push({ ...t, exit: t.tp, exit_time: times[i], exit_bar: i, pnl: +pnl.toFixed(2), exit_reason: 'TP_HIT' });
        inTrade = false; tradeEntry = null;
        continue;
      }

      // Trailing stop simulation
      const currentDist = isBuy ? closes[i] - t.entry : t.entry - closes[i];
      const riskDist = Math.abs(t.entry - t.original_sl);
      const rMultiple = riskDist > 0 ? currentDist / riskDist : 0;

      if (rMultiple >= strategy.trailing.trail_2_at) {
        const newSL = isBuy
          ? t.entry + riskDist * strategy.trailing.trail_2_lock
          : t.entry - riskDist * strategy.trailing.trail_2_lock;
        if (isBuy ? newSL > t.sl : newSL < t.sl) t.sl = newSL;
      } else if (rMultiple >= strategy.trailing.trail_1_at) {
        const newSL = isBuy
          ? t.entry + riskDist * strategy.trailing.trail_1_lock
          : t.entry - riskDist * strategy.trailing.trail_1_lock;
        if (isBuy ? newSL > t.sl : newSL < t.sl) t.sl = newSL;
      } else if (rMultiple >= strategy.trailing.breakeven_at) {
        const newSL = t.entry; // break-even
        if (isBuy ? newSL > t.sl : newSL < t.sl) t.sl = newSL;
      }

      continue; // don't enter new trade while in one
    }

    // ── Entry logic (EMA pullback) ──
    const trend = emaFast[i] > emaSlow[i] ? 'BUY' : 'SELL';
    const prevClose = closes[i - 1];
    const currClose = closes[i];

    // BUY signal: uptrend + price pulls back to touch emaFast + RSI not overbought
    let signal = null;
    if (trend === 'BUY' && lows[i] <= emaFast[i] && currClose > emaFast[i] && rsi[i] < strategy.rsi_overbought) {
      signal = 'BUY';
    }
    // SELL signal: downtrend + price pulls up to touch emaFast + RSI not oversold
    if (trend === 'SELL' && highs[i] >= emaFast[i] && currClose < emaFast[i] && rsi[i] > strategy.rsi_oversold) {
      signal = 'SELL';
    }

    if (signal && !inTrade) {
      const slDist = atr[i] * strategy.atr_multiplier;
      const entry = currClose;
      const sl = signal === 'BUY' ? entry - slDist : entry + slDist;
      const tp = signal === 'BUY' ? entry + slDist * strategy.risk_reward : entry - slDist * strategy.risk_reward;

      // Position sizing: risk_per_trade_pct of equity
      const riskAmount = equity * (strategy.risk_per_trade_pct / 100);
      const volume = +(riskAmount / (slDist * 100)).toFixed(2); // approximate pip value

      if (volume >= 0.01) {
        tradeEntry = {
          direction: signal, entry, entry_time: times[i], entry_bar: i,
          sl: +sl.toFixed(5), original_sl: +sl.toFixed(5),
          tp: +tp.toFixed(5), volume,
        };
        inTrade = true;
      }
    }

    // Drawdown tracking
    if (equity > peak) peak = equity;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Close any remaining open trade at last close
  if (inTrade && tradeEntry) {
    const lastClose = closes[closes.length - 1];
    const isBuy = tradeEntry.direction === 'BUY';
    const pnl = isBuy
      ? (lastClose - tradeEntry.entry) * tradeEntry.volume * 100
      : (tradeEntry.entry - lastClose) * tradeEntry.volume * 100;
    equity += pnl;
    trades.push({ ...tradeEntry, exit: lastClose, exit_time: times[times.length - 1], exit_bar: candles.length - 1, pnl: +pnl.toFixed(2), exit_reason: 'END_OF_DATA' });
  }

  return { trades, equity, maxDrawdown, peak };
}

// ─── Calculate Metrics ──────────────────────────────────────────────
function calcMetrics(trades, initialEquity, finalEquity, maxDrawdown) {
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);

  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);

  // Sharpe ratio (simplified: daily returns std)
  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // annualized

  return {
    total_trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: trades.length > 0 ? +((wins.length / trades.length) * 100).toFixed(1) : 0,
    gross_win: +grossWin.toFixed(2),
    gross_loss: +grossLoss.toFixed(2),
    profit_factor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : Infinity,
    total_pnl: +totalPnL.toFixed(2),
    avg_win: wins.length > 0 ? +(grossWin / wins.length).toFixed(2) : 0,
    avg_loss: losses.length > 0 ? +(grossLoss / losses.length).toFixed(2) : 0,
    best_trade: trades.length > 0 ? +Math.max(...trades.map(t => t.pnl)).toFixed(2) : 0,
    worst_trade: trades.length > 0 ? +Math.min(...trades.map(t => t.pnl)).toFixed(2) : 0,
    max_drawdown_pct: +maxDrawdown.toFixed(2),
    sharpe_ratio: +sharpe.toFixed(3),
    expectancy: trades.length > 0 ? +(totalPnL / trades.length).toFixed(2) : 0,
    initial_equity: initialEquity,
    final_equity: +finalEquity.toFixed(2),
    return_pct: +(((finalEquity - initialEquity) / initialEquity) * 100).toFixed(2),
  };
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  // Load strategy
  const strategy = JSON.parse(await fs.readFile(STRATEGY_FILE, 'utf-8'));

  // Override from CLI
  if (opts['ema-fast']) strategy.ema_fast = parseInt(opts['ema-fast']);
  if (opts['ema-slow']) strategy.ema_slow = parseInt(opts['ema-slow']);
  if (opts['atr-mult']) strategy.atr_multiplier = parseFloat(opts['atr-mult']);
  if (opts['rr']) strategy.risk_reward = parseFloat(opts['rr']);

  // Fetch historical data (H1 for backtesting)
  const barsNeeded = Math.min(opts.days * 24, 5000); // H1 bars
  const data = await fetchMarketData(opts.url, opts.key, opts.symbol, 'H1', barsNeeded);

  if (!data.candles || data.candles.length < 100) {
    console.error(JSON.stringify({ ok: false, error: `Insufficient data: ${data.candles?.length || 0} candles` }));
    process.exit(1);
  }

  // Run backtest
  const { trades, equity, maxDrawdown } = runBacktest(data.candles, strategy);

  // Calculate metrics
  const metrics = calcMetrics(trades, strategy.initial_equity, equity, maxDrawdown);

  const output = {
    ok: true,
    symbol: opts.symbol,
    timeframe: 'H1',
    bars_used: data.candles.length,
    strategy_params: {
      ema_fast: strategy.ema_fast,
      ema_slow: strategy.ema_slow,
      atr_multiplier: strategy.atr_multiplier,
      risk_reward: strategy.risk_reward,
      rsi_period: strategy.rsi_period,
      risk_per_trade_pct: strategy.risk_per_trade_pct,
    },
    trailing: strategy.trailing,
    metrics,
    timestamp: new Date().toISOString(),
  };

  // Save results
  await fs.writeFile(path.join(STATE_DIR, 'backtest-result.json'), JSON.stringify(output, null, 2));
  await fs.writeFile(path.join(STATE_DIR, 'backtest-trades.json'), JSON.stringify({ trades, total: trades.length }, null, 2));

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
