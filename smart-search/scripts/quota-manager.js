#!/usr/bin/env node
import fs from 'node:fs/promises';

export async function readJson(file, fallback = {}) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

export function getWibDayKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function getWibMonthKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}`;
}

export async function ensureQuota(stateFile) {
  const dayKey = getWibDayKey();
  const monthKey = getWibMonthKey();
  const state = await readJson(stateFile, {
    dayKey,
    monthKey,
    day: { brave: 0, tavily: 0, total: 0 },
    month: { brave: 0, tavily: 0 }
  });

  if (state.dayKey !== dayKey) {
    state.dayKey = dayKey;
    state.day = { brave: 0, tavily: 0, total: 0 };
  }
  if (state.monthKey !== monthKey) {
    state.monthKey = monthKey;
    state.month = { brave: 0, tavily: 0 };
  }
  return state;
}

export function canUse(state, policy, provider) {
  const dailyCaps = policy.dailyCaps;
  const monthlyCaps = policy.monthlyCaps;

  if (state.day.total >= dailyCaps.total) return { ok: false, reason: 'daily-total-cap-reached' };
  if (state.day[provider] >= dailyCaps[provider]) return { ok: false, reason: `daily-${provider}-cap-reached` };
  if (state.month[provider] >= monthlyCaps[provider]) return { ok: false, reason: `monthly-${provider}-cap-reached` };

  return { ok: true, reason: 'ok' };
}

export function useOne(state, provider) {
  state.day[provider] += 1;
  state.day.total += 1;
  state.month[provider] += 1;
  return state;
}

export async function saveQuota(stateFile, state) {
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}
