import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, readJson, writeJson } from './state-manager.js';

export async function acquireLock(lockFile, ttlMs = 15 * 60 * 1000) {
  await ensureDir(path.dirname(lockFile));
  const existing = await readJson(lockFile, null);
  const now = Date.now();
  if (existing?.expiresAt && existing.expiresAt > now) {
    return { ok: false, reason: 'lock_active', lock: existing };
  }
  const lock = { pid: process.pid, acquiredAt: now, expiresAt: now + ttlMs };
  await writeJson(lockFile, lock);
  return { ok: true, lock };
}

export async function releaseLock(lockFile) {
  try {
    await fs.unlink(lockFile);
  } catch {}
}
