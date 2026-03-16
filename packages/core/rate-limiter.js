import { readJson, writeJson } from './state-manager.js';

export async function checkRateLimit(filePath, key, limit, windowMs) {
  const now = Date.now();
  const state = await readJson(filePath, {});
  const active = (state[key] || []).filter((ts) => now - ts < windowMs);
  const allowed = active.length < limit;
  if (allowed) {
    active.push(now);
    state[key] = active;
    await writeJson(filePath, state);
  }
  return { allowed, remaining: Math.max(limit - active.length, 0) };
}
