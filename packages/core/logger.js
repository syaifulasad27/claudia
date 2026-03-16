import path from 'node:path';
import { appendText, ensureDir } from './state-manager.js';

function levelValue(level) {
  return { debug: 10, info: 20, warn: 30, error: 40 }[level] ?? 20;
}

export function createLogger(scope = 'app', options = {}) {
  const minLevel = options.minLevel ?? process.env.CLAUDIA_LOG_LEVEL ?? 'info';
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');

  async function write(level, message, meta = null) {
    if (levelValue(level) < levelValue(minLevel)) return;
    const line = `[${new Date().toISOString()}] [${scope}] [${level.toUpperCase()}] ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
    const printer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    printer(line);
    await ensureDir(logDir);
    await appendText(path.join(logDir, `${scope}.log`), `${line}\n`);
  }

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}
