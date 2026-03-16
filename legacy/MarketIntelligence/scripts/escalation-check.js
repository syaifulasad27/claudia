#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BRIEF = path.join(ROOT, 'state', 'latest-briefing.json');
const ESC_STATE = path.join(ROOT, 'state', 'escalation-state.json');
const OUT = path.join(ROOT, 'state', 'ops-alert.txt');

async function readJson(file, fallback = {}) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function main() {
  const brief = await readJson(BRIEF, {});
  const st = await readJson(ESC_STATE, { degradedStreak: 0, lastHealth: null, lastAlertAt: null });

  const health = brief.health_marker || 'unknown';
  let degradedStreak = health === 'degraded' ? (st.degradedStreak || 0) + 1 : 0;

  let alert = '';
  if (degradedStreak >= 2) {
    alert = [
      '⚠️ OPS ALERT',
      `Feed health degraded ${degradedStreak} cycles berturut-turut.`,
      'Action: cek koneksi feed RSS/endpoint dan fallback source.'
    ].join('\n');
  }

  await fs.writeFile(ESC_STATE, JSON.stringify({ degradedStreak, lastHealth: health, lastAlertAt: alert ? new Date().toISOString() : st.lastAlertAt }, null, 2));
  await fs.writeFile(OUT, alert);

  console.log(JSON.stringify({ ok: true, health, degradedStreak, alerted: Boolean(alert), out: OUT }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
