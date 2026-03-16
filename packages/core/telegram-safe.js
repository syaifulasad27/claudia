import { requestJson } from './http-client.js';

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isAuthorizedChat(chatId, allowedChatId) {
  return String(chatId || '') === String(allowedChatId || '');
}

export async function sendTelegramMessage({ botToken, chatId, text, parseMode = 'HTML' }) {
  if (!botToken || !chatId) return { ok: false, error: 'telegram_not_configured' };
  return requestJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    },
    retries: 2,
    timeoutMs: 10000,
  });
}
