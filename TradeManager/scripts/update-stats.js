#!/usr/bin/env node
/**
 * update-stats.js — Auto-Update Performance Statistics
 *
 * Fetches closed trade history from Bridge API and updates
 * memory/performance-stats.md with accurate statistics.
 *
 * Usage:
 *   node scripts/update-stats.js --url <BRIDGE_URL> --key <API_KEY> --memory-path ./memory
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI Args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { 'memory-path': path.join(__dirname, '..', '..', 'memory') };
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

// ─── Stats Calculation ──────────────────────────────────────────────
function calculateStats(deals, initialEquity) {
  if (deals.length === 0) {
    return {
      total_trades: 0, wins: 0, losses: 0, win_rate: 0,
      avg_win: 0, avg_loss: 0, profit_factor: 0,
      total_pl: 0, max_drawdown: 0, current_equity: initialEquity,
      best_trade: 0, worst_trade: 0,
      total_commission: 0, total_swap: 0,
    };
  }

  // Group by order ID to pair entry/exit (deals come in pairs: open + close)
  // Closed trades are SELL deals for BUY positions and BUY deals for SELL positions
  // We only count deals with non-zero profit as exits
  const exitDeals = deals.filter(d => d.profit !== 0);

  const wins = exitDeals.filter(d => d.profit > 0);
  const losses = exitDeals.filter(d => d.profit < 0);

  const totalPL = exitDeals.reduce((s, d) => s + d.profit, 0);
  const totalSwap = exitDeals.reduce((s, d) => s + d.swap, 0);
  const totalCommission = exitDeals.reduce((s, d) => s + d.commission, 0);
  const netPL = totalPL + totalSwap + totalCommission;

  const avgWin = wins.length > 0 ? wins.reduce((s, d) => s + d.profit, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, d) => s + d.profit, 0) / losses.length) : 0;

  const grossWin = wins.reduce((s, d) => s + d.profit, 0);
  const grossLoss = Math.abs(losses.reduce((s, d) => s + d.profit, 0));

  // Max drawdown (running calculation)
  let peak = initialEquity;
  let maxDD = 0;
  let running = initialEquity;
  for (const deal of exitDeals) {
    running += deal.profit + deal.swap + deal.commission;
    if (running > peak) peak = running;
    const dd = ((peak - running) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    total_trades: exitDeals.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: exitDeals.length > 0 ? +((wins.length / exitDeals.length) * 100).toFixed(1) : 0,
    avg_win: +avgWin.toFixed(2),
    avg_loss: +avgLoss.toFixed(2),
    profit_factor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? Infinity : 0,
    total_pl: +netPL.toFixed(2),
    total_gross_pl: +totalPL.toFixed(2),
    total_swap: +totalSwap.toFixed(2),
    total_commission: +totalCommission.toFixed(2),
    max_drawdown: +maxDD.toFixed(2),
    current_equity: +(initialEquity + netPL).toFixed(2),
    best_trade: exitDeals.length > 0 ? +Math.max(...exitDeals.map(d => d.profit)).toFixed(2) : 0,
    worst_trade: exitDeals.length > 0 ? +Math.min(...exitDeals.map(d => d.profit)).toFixed(2) : 0,
  };
}

// ─── Generate Markdown ──────────────────────────────────────────────
function generateMarkdown(stats, deals) {
  const exitDeals = deals.filter(d => d.profit !== 0);
  const rrRatio = stats.avg_loss > 0 ? (stats.avg_win / stats.avg_loss).toFixed(2) : 'N/A';

  let md = `# Performance Statistics\n\n`;
  md += `## Running Statistics\n`;
  md += `- Total Trades: ${stats.total_trades}\n`;
  md += `- Win Rate: ${stats.win_rate}%\n`;
  md += `- Average Win: $${stats.avg_win}\n`;
  md += `- Average Loss: $${stats.avg_loss}\n`;
  md += `- Profit Factor: ${stats.profit_factor}\n`;
  md += `- Risk/Reward Ratio: ${rrRatio}\n`;
  md += `- Max Drawdown Reached: ${stats.max_drawdown}%\n`;
  md += `- Current Equity: $${stats.current_equity.toLocaleString()}\n`;
  md += `- P/L Total: $${stats.total_pl >= 0 ? '' : ''}${stats.total_pl}\n`;
  md += `- Total Swap: $${stats.total_swap}\n`;
  md += `- Total Commission: $${stats.total_commission}\n`;
  md += `- Best Trade: $${stats.best_trade}\n`;
  md += `- Worst Trade: $${stats.worst_trade}\n\n`;

  md += `## Session Breakdown\n\n`;
  md += `| # | Date | Symbol | Direction | Volume | P/L | Swap | Result |\n`;
  md += `|---|------|--------|-----------|--------|-----|------|--------|\n`;

  exitDeals.forEach((d, i) => {
    const date = d.time.split('T')[0];
    const result = d.profit > 0 ? '✅ Win' : '❌ Loss';
    md += `| ${i + 1} | ${date} | ${d.symbol} | ${d.type} | ${d.volume} | $${d.profit.toFixed(2)} | $${d.swap.toFixed(2)} | ${result} |\n`;
  });

  md += `\n## Notes\n`;
  md += `- Statistik diperbarui otomatis oleh TradeManager/scripts/update-stats.js\n`;
  md += `- Hanya menghitung trade dari sistem Claudia (comment prefix: Claudia-*)\n`;
  md += `- Last updated: ${new Date().toISOString()}\n`;

  return md;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  const memoryPath = opts['memory-path'];

  // Fetch history
  const history = await apiGet(opts.url, opts.key, '/orders/history?days=90');

  // Filter Claudia trades only
  const claudiaDeals = history.deals.filter(d => d.comment?.startsWith('Claudia'));

  // Calculate stats
  const stats = calculateStats(claudiaDeals, 100000);

  // Generate and write markdown
  const md = generateMarkdown(stats, claudiaDeals);
  const statsFile = path.join(memoryPath, 'performance-stats.md');
  await fs.writeFile(statsFile, md);

  // Also save raw stats JSON
  const stateDir = path.join(__dirname, '..', 'state');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(
    path.join(stateDir, 'performance-data.json'),
    JSON.stringify({ ok: true, stats, deals_count: claudiaDeals.length, updated: new Date().toISOString() }, null, 2)
  );

  console.log(JSON.stringify({ ok: true, stats, message: `Updated ${statsFile} with ${stats.total_trades} trades` }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
