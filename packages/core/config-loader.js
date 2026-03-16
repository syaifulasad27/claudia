import fs from 'node:fs/promises';
import path from 'node:path';

let envLoaded = false;

async function readEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}

export async function loadWorkspaceEnv(rootDir = path.resolve(process.cwd())) {
  if (envLoaded) return;
  await readEnvFile(path.join(rootDir, '.env'));
  envLoaded = true;
}

export async function getConfig(rootDir = path.resolve(process.cwd())) {
  await loadWorkspaceEnv(rootDir);
  return {
    rootDir,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
    replizBaseUrl: process.env.REPLIZ_API_BASE_URL ?? 'https://api.repliz.com/public',
    replizAccessKey: process.env.REPLIZ_ACCESS_KEY ?? '',
    replizSecretKey: process.env.REPLIZ_SECRET_KEY ?? '',
    threadsUsername: process.env.THREADS_USERNAME ?? 'notesbyclaudia',
    braveApiKey: process.env.BRAVE_API_KEY ?? '',
    tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
  };
}
