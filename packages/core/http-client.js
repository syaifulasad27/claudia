function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestJson(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    retries = 2,
    timeoutMs = 10000,
    retryDelayMs = 500,
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < retries && response.status >= 500) {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, status: response.status, error: payload?.message || payload || lastError.message };
      }

      return { ok: true, status: response.status, data: payload };
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt < retries) {
        await wait(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  return { ok: false, status: 0, error: lastError?.message || 'request_failed' };
}
