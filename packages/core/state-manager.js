import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp`;
  const payload = JSON.stringify(value, null, 2);
  try {
    await fs.writeFile(tempFile, payload, 'utf8');
    await fs.rename(tempFile, filePath);
  } catch {
    await fs.writeFile(filePath, payload, 'utf8');
  }
}

export async function appendText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, text, 'utf8');
}

export async function writeText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  const tempFile = `${filePath}.tmp`;
  try {
    await fs.writeFile(tempFile, text, 'utf8');
    await fs.rename(tempFile, filePath);
  } catch {
    await fs.writeFile(filePath, text, 'utf8');
  }
}

export async function updateJson(filePath, updater, fallback = {}) {
  const current = await readJson(filePath, fallback);
  const next = await updater(current ?? fallback);
  await writeJson(filePath, next);
  return next;
}
