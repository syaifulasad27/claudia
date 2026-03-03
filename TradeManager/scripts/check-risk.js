#!/usr/bin/env node
/**
 * check-risk.js — Pre-Trade Risk Limit Validator
 *
 * Checks daily/weekly loss limits, consecutive losses, drawdown levels,
 * and position exposure before allowing new trades.
 *
 * Output: state/risk-status.json
 *
 * Usage:
 *   node scripts/check-risk.js --url <BRIDGE_URL> --key <API_KEY>
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const LIMITS_FILE = path.join(__dirname, '..', 'references', 'risk-limits.json');

// ─── CLI Args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    opts[args[i].replace(/^--/, '')] = args[i + 1];
  }
  if (!opts.url || !opts.key) {
    console.error(JSON.stringify({ ok: false, error: 'Missing required args: --url, --key' }));
    process.exit(1);
  }
  return opts;
}

// ─── Bridge API ─────────────────────────────────────────────────────
async function apiGet(url, key, endpoint) {
  const res = await fetch(`${url}${endpoint}`, { headers: { 'X-API-KEY': key } });
  if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status}`);
  return res.json();
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  const limits = JSON.parse(await fs.readFile(LIMITS_FILE, 'utf-8'));

  // Fetch data
  const [account, positions, historyToday, historyWeek] = await Promise.all([
    apiGet(opts.url, opts.key, '/account'),
    apiGet(opts.url, opts.key, '/positions'),
    apiGet(opts.url, opts.key, '/orders/history?days=1'),
    apiGet(opts.url, opts.key, '/orders/history?days=7'),
  ]);

  const equity = account.equity;
  const initialEquity = limits.initial_equity;

  // ── Daily P/L ──
  const todayDeals = historyToday.deals.filter(d => d.comment?.startsWith('Claudia'));
  const dailyPL = todayDeals.reduce((sum, d) => sum + d.profit + d.swap + d.commission, 0);
  const dailyPLPct = (dailyPL / equity) * 100;
  const dailyLimitBreached = dailyPLPct <= -limits.daily_loss_limit_pct;

  // ── Weekly P/L ──
  const weekDeals = historyWeek.deals.filter(d => d.comment?.startsWith('Claudia'));
  const weeklyPL = weekDeals.reduce((sum, d) => sum + d.profit + d.swap + d.commission, 0);
  const weeklyPLPct = (weeklyPL / equity) * 100;
  const weeklyLimitBreached = weeklyPLPct <= -limits.weekly_loss_limit_pct;

  // ── Consecutive Losses ──
  const sortedDeals = [...weekDeals].sort((a, b) => new Date(b.time) - new Date(a.time));
  let consecutiveLosses = 0;
  for (const deal of sortedDeals) {
    if (deal.profit < 0) consecutiveLosses++;
    else break;
  }
  const consecutiveLimitBreached = consecutiveLosses >= limits.max_consecutive_losses;

  // ── Drawdown ──
  const drawdownPct = ((initialEquity - equity) / initialEquity) * 100;
  const drawdownBreached = drawdownPct >= limits.max_drawdown_pct;
  const emergencyDrawdown = drawdownPct >= limits.emergency_drawdown_pct;

  // ── Current Exposure ──
  const claudiaPositions = positions.filter(p => p.comment?.startsWith('Claudia'));
  const positionLimitBreached = claudiaPositions.length >= limits.max_concurrent_positions;

  // ── SL Check ──
  const positionsWithoutSL = claudiaPositions.filter(p => p.sl === 0);

  // ── Cooldown Check ──
  let cooldownActive = false;
  let cooldownUntil = null;
  const cooldownFile = path.join(STATE_DIR, 'cooldown.json');
  try {
    const cd = JSON.parse(await fs.readFile(cooldownFile, 'utf-8'));
    if (cd.until && new Date(cd.until) > new Date()) {
      cooldownActive = true;
      cooldownUntil = cd.until;
    }
  } catch { /* no cooldown file */ }

  // Set cooldown if consecutive limit breached
  if (consecutiveLimitBreached && !cooldownActive) {
    const until = new Date(Date.now() + limits.cooldown_hours * 3600000).toISOString();
    await fs.writeFile(cooldownFile, JSON.stringify({ until, reason: `${consecutiveLosses} consecutive losses` }));
    cooldownActive = true;
    cooldownUntil = until;
  }

  // ── Decision ──
  const alerts = [];
  let tradingAllowed = true;

  if (emergencyDrawdown) {
    alerts.push({ level: 'EMERGENCY', message: `EMERGENCY: Drawdown ${drawdownPct.toFixed(1)}% exceeds ${limits.emergency_drawdown_pct}%` });
    tradingAllowed = false;
  }
  if (drawdownBreached) {
    alerts.push({ level: 'CRITICAL', message: `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${limits.max_drawdown_pct}% — report to Tuan` });
    tradingAllowed = false;
  }
  if (dailyLimitBreached) {
    alerts.push({ level: 'HIGH', message: `Daily loss ${dailyPLPct.toFixed(2)}% exceeds -${limits.daily_loss_limit_pct}% limit` });
    tradingAllowed = false;
  }
  if (weeklyLimitBreached) {
    alerts.push({ level: 'HIGH', message: `Weekly loss ${weeklyPLPct.toFixed(2)}% exceeds -${limits.weekly_loss_limit_pct}% limit — stop until Tuan reviews` });
    tradingAllowed = false;
  }
  if (consecutiveLimitBreached) {
    alerts.push({ level: 'HIGH', message: `${consecutiveLosses} consecutive losses — ${limits.cooldown_hours}hr cooldown active` });
    tradingAllowed = false;
  }
  if (cooldownActive) {
    alerts.push({ level: 'MEDIUM', message: `Cooldown active until ${cooldownUntil}` });
    tradingAllowed = false;
  }
  if (positionLimitBreached) {
    alerts.push({ level: 'MEDIUM', message: `Max concurrent positions reached (${claudiaPositions.length}/${limits.max_concurrent_positions})` });
    tradingAllowed = false;
  }
  if (positionsWithoutSL.length > 0) {
    alerts.push({ level: 'CRITICAL', message: `${positionsWithoutSL.length} position(s) WITHOUT STOP LOSS: ${positionsWithoutSL.map(p => p.ticket).join(', ')}` });
  }

  const output = {
    ok: true,
    timestamp: new Date().toISOString(),
    trading_allowed: tradingAllowed,
    decision: tradingAllowed ? '✅ TRADING ALLOWED' : '❌ TRADING BLOCKED',
    account: {
      equity,
      balance: account.balance,
      free_margin: account.free_margin,
    },
    risk_metrics: {
      daily_pl: +dailyPL.toFixed(2),
      daily_pl_pct: +dailyPLPct.toFixed(2),
      weekly_pl: +weeklyPL.toFixed(2),
      weekly_pl_pct: +weeklyPLPct.toFixed(2),
      drawdown_pct: +drawdownPct.toFixed(2),
      consecutive_losses: consecutiveLosses,
      open_positions: claudiaPositions.length,
      cooldown_active: cooldownActive,
      cooldown_until: cooldownUntil,
    },
    limits: {
      daily_loss_limit: `-${limits.daily_loss_limit_pct}%`,
      weekly_loss_limit: `-${limits.weekly_loss_limit_pct}%`,
      max_drawdown: `${limits.max_drawdown_pct}%`,
      max_consecutive_losses: limits.max_consecutive_losses,
      max_positions: limits.max_concurrent_positions,
    },
    alerts,
    trades_today: todayDeals.length,
    trades_this_week: weekDeals.length,
  };

  await fs.writeFile(path.join(STATE_DIR, 'risk-status.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
