#!/usr/bin/env node
/**
 * manage-positions.js — Active Position Management Engine
 *
 * Monitors open positions and executes:
 * - Break-even SL moves
 * - Trailing stop adjustments
 * - Partial closes at profit milestones
 * - Stale position evaluation
 *
 * Output: state/management-log.json (append-style)
 *
 * Usage:
 *   node scripts/manage-positions.js --url <BRIDGE_URL> --key <API_KEY>
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', 'state');
const RULES_FILE = path.join(__dirname, '..', 'references', 'trailing-rules.json');

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

// ─── Bridge API Helpers ─────────────────────────────────────────────
async function apiGet(url, key, endpoint) {
  const res = await fetch(`${url}${endpoint}`, {
    headers: { 'X-API-KEY': key },
  });
  if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.status}`);
  return res.json();
}

async function apiPost(url, key, endpoint, body) {
  const res = await fetch(`${url}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${endpoint} failed: ${res.status}`);
  return res.json();
}

async function apiPatch(url, key, endpoint, body) {
  const res = await fetch(`${url}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${endpoint} failed: ${res.status}`);
  return res.json();
}

// ─── Log Helper ─────────────────────────────────────────────────────
async function appendLog(actions) {
  const logFile = path.join(STATE_DIR, 'management-log.json');
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(logFile, 'utf-8'));
  } catch { /* first run */ }
  existing.push(...actions);
  // Keep last 200 entries
  if (existing.length > 200) existing = existing.slice(-200);
  await fs.writeFile(logFile, JSON.stringify(existing, null, 2));
}

// ─── Position Analysis ──────────────────────────────────────────────

function analyzePosition(pos, symbolInfo, rules) {
  const actions = [];
  const now = Date.now();

  // Calculate risk amount from SL distance
  const isBuy = pos.type === 'BUY';
  const slDistance = Math.abs(pos.price_open - pos.sl);
  const currentDistance = isBuy
    ? pos.price_current - pos.price_open
    : pos.price_open - pos.price_current;

  // If no SL set, this is CRITICAL
  if (pos.sl === 0) {
    actions.push({
      type: 'ALERT_CRITICAL',
      ticket: pos.ticket,
      message: `Position ${pos.ticket} has NO STOP LOSS — CRITICAL RISK`,
      timestamp: new Date().toISOString(),
    });
    return actions;
  }

  // Risk multiple = how many times the original risk we've profited
  const riskMultiple = slDistance > 0 ? currentDistance / slDistance : 0;
  const point = symbolInfo?.point || 0.01;

  // ── Trailing stop rules (check highest tier first) ──

  // Partial close at 2.5× risk
  if (riskMultiple >= rules.partial_close.trigger_risk_multiple) {
    if (pos.volume >= rules.partial_close.min_volume) {
      const closeVol = +(pos.volume * rules.partial_close.close_percentage).toFixed(2);
      if (closeVol >= (symbolInfo?.volume_min || 0.01)) {
        actions.push({
          type: 'PARTIAL_CLOSE',
          ticket: pos.ticket,
          volume: closeVol,
          reason: `Profit ≥ ${rules.partial_close.trigger_risk_multiple}× risk (${riskMultiple.toFixed(2)}×) — closing ${(rules.partial_close.close_percentage * 100)}%`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Trail to 1× risk at 2× profit
  for (const tier of [...rules.trailing].reverse()) {
    if (riskMultiple >= tier.trigger_risk_multiple) {
      const lockDistance = slDistance * tier.sl_lock_risk_multiple;
      const newSL = isBuy
        ? +(pos.price_open + lockDistance).toFixed(5)
        : +(pos.price_open - lockDistance).toFixed(5);

      // Only move SL if it's an improvement
      const currentSLBetter = isBuy ? pos.sl >= newSL : pos.sl <= newSL;
      if (!currentSLBetter) {
        actions.push({
          type: 'TRAIL_SL',
          ticket: pos.ticket,
          new_sl: newSL,
          current_sl: pos.sl,
          reason: `Profit ≥ ${tier.trigger_risk_multiple}× risk (${riskMultiple.toFixed(2)}×) — trailing SL to ${tier.sl_lock_risk_multiple}× risk above entry`,
          timestamp: new Date().toISOString(),
        });
      }
      break; // Apply highest tier only
    }
  }

  // Break-even at 1× risk
  if (riskMultiple >= rules.breakeven.trigger_risk_multiple) {
    const buffer = rules.breakeven.buffer_pips * point;
    const beSL = isBuy
      ? +(pos.price_open + buffer).toFixed(5)
      : +(pos.price_open - buffer).toFixed(5);

    const slAlreadyAtBE = isBuy ? pos.sl >= beSL : pos.sl <= beSL;
    if (!slAlreadyAtBE) {
      // Only add if no trail action already taken
      const hasTrail = actions.some(a => a.type === 'TRAIL_SL');
      if (!hasTrail) {
        actions.push({
          type: 'MOVE_BE',
          ticket: pos.ticket,
          new_sl: beSL,
          current_sl: pos.sl,
          reason: `Profit ≥ ${rules.breakeven.trigger_risk_multiple}× risk (${riskMultiple.toFixed(2)}×) — moving SL to break-even`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Stale position check
  const openTime = new Date(pos.time).getTime();
  const hoursOpen = (now - openTime) / 3600000;
  if (hoursOpen > rules.stale_position.max_hours) {
    const currentRR = slDistance > 0 ? currentDistance / slDistance : 0;
    if (currentRR < rules.stale_position.min_rr) {
      actions.push({
        type: 'STALE_ALERT',
        ticket: pos.ticket,
        hours_open: +hoursOpen.toFixed(1),
        current_rr: +currentRR.toFixed(2),
        message: `Position open ${hoursOpen.toFixed(1)} hrs with RR ${currentRR.toFixed(2)} — consider closing`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return actions;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  await fs.mkdir(STATE_DIR, { recursive: true });

  const rules = JSON.parse(await fs.readFile(RULES_FILE, 'utf-8'));

  // Get positions
  const positions = await apiGet(opts.url, opts.key, '/positions');
  const claudiaPositions = positions.filter(p => p.comment?.startsWith('Claudia'));

  if (claudiaPositions.length === 0) {
    const output = { ok: true, message: 'No Claudia positions to manage', positions: 0, actions: [] };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const allActions = [];
  const executedActions = [];

  for (const pos of claudiaPositions) {
    // Get symbol info for pip value
    let symbolInfo = null;
    try {
      symbolInfo = await apiGet(opts.url, opts.key, `/symbol-info/${pos.symbol}`);
    } catch { /* proceed without */ }

    const actions = analyzePosition(pos, symbolInfo, rules);
    allActions.push(...actions);

    // Execute actions
    for (const action of actions) {
      try {
        if (action.type === 'TRAIL_SL' || action.type === 'MOVE_BE') {
          const result = await apiPatch(opts.url, opts.key, `/order/${action.ticket}`, { sl: action.new_sl });
          executedActions.push({ ...action, executed: true, result: result.status });
        } else if (action.type === 'PARTIAL_CLOSE') {
          const result = await apiPost(opts.url, opts.key, '/close/partial', { ticket: action.ticket, volume: action.volume });
          executedActions.push({ ...action, executed: true, result: result.status });
        } else {
          // Alerts aren't executed, just logged
          executedActions.push({ ...action, executed: false });
        }
      } catch (err) {
        executedActions.push({ ...action, executed: false, error: err.message });
      }
    }
  }

  // Check pending orders for staleness
  let pendingActions = [];
  try {
    const pending = await apiGet(opts.url, opts.key, '/orders/pending');
    const claudiaPending = pending.filter(o => o.comment?.startsWith('Claudia'));

    for (const order of claudiaPending) {
      const setupTime = new Date(order.time_setup).getTime();
      const hoursActive = (Date.now() - setupTime) / 3600000;
      if (hoursActive > 2) {
        pendingActions.push({
          type: 'STALE_PENDING',
          ticket: order.ticket,
          hours_active: +hoursActive.toFixed(1),
          message: `Pending order ${order.ticket} active for ${hoursActive.toFixed(1)} hrs — consider cancelling`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error(`Warning: Could not check pending orders: ${err.message}`);
  }

  await appendLog([...executedActions, ...pendingActions]);

  const output = {
    ok: true,
    timestamp: new Date().toISOString(),
    positions_managed: claudiaPositions.length,
    actions_detected: allActions.length,
    actions_executed: executedActions.filter(a => a.executed).length,
    pending_alerts: pendingActions.length,
    details: [...executedActions, ...pendingActions],
    position_summary: claudiaPositions.map(p => ({
      ticket: p.ticket,
      symbol: p.symbol,
      type: p.type,
      volume: p.volume,
      profit: p.profit,
      sl: p.sl,
      tp: p.tp,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
