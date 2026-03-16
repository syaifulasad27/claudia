#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../../packages/core/config-loader.js';
import { requestJson } from '../../packages/core/http-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const config = await getConfig(rootDir);

class ReplizClient {
  constructor() {
    const base = config.replizBaseUrl || 'https://api.repliz.com/public';
    this.baseUrl = base.endsWith('/public') ? base.replace('/public', '') : base;
    this.accessKey = config.replizAccessKey;
    this.secretKey = config.replizSecretKey;
    this.username = config.threadsUsername || 'notesbyclaudia';
    this.accountId = null;
  }

  buildUrl(endpoint) {
    if (endpoint.startsWith('/public/')) return `${this.baseUrl}${endpoint}`;
    return `${this.baseUrl}/public${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  async request(method, endpoint, data = null) {
    if (!this.accessKey || !this.secretKey) {
      return { ok: false, error: 'Missing REPLIZ credentials' };
    }
    const authString = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
    return requestJson(this.buildUrl(endpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: data,
      retries: 2,
      timeoutMs: 12000,
    });
  }

  async init() {
    const res = await this.request('GET', '/account?page=1&limit=10');
    if (!res.ok) return res;
    const data = res.data;
    const accounts = Array.isArray(data) ? data : (data.docs || data.accounts || data.data || []);
    const valid = accounts.filter((item) => item && (item._id || item.id));
    const account = valid.find((item) => item.username === this.username || item.name === this.username) || valid[0];
    if (!account) return { ok: false, error: 'No valid account found' };
    this.accountId = account._id || account.id;
    return { ok: true, accountId: this.accountId };
  }

  async getQueue(options = { page: 1, limit: 20, status: 'pending' }) {
    const params = new URLSearchParams({
      page: String(options.page || 1),
      limit: String(options.limit || 20),
      status: String(options.status || 'pending'),
    });
    if (this.accountId) params.append('accountIds[]', this.accountId);
    return this.request('GET', `/queue?${params.toString()}`);
  }

  async replyToComment(commentId, replyText) {
    return this.request('POST', `/queue/${commentId}`, { text: replyText });
  }

  async createPost(content, options = {}) {
    if (!this.accountId) return { ok: false, error: 'Client not initialized' };
    return this.request('POST', '/schedule', {
      accountId: this.accountId,
      type: 'text',
      description: content,
      scheduleAt: options.scheduleAt || new Date().toISOString(),
      medias: options.medias || [],
      title: options.title || '',
      replies: options.replies || [],
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const client = new ReplizClient();

  if (['init', 'queue', 'reply', 'post'].includes(command)) {
    const init = await client.init();
    if (!init.ok) {
      console.error(JSON.stringify(init, null, 2));
      process.exit(1);
    }
  }

  if (command === 'init') {
    console.log(JSON.stringify({ ok: true, accountId: client.accountId }, null, 2));
    return;
  }
  if (command === 'queue') {
    console.log(JSON.stringify(await client.getQueue(), null, 2));
    return;
  }
  if (command === 'reply') {
    console.log(JSON.stringify(await client.replyToComment(args[1], args[2]), null, 2));
    return;
  }
  if (command === 'post') {
    console.log(JSON.stringify(await client.createPost(args[1]), null, 2));
    return;
  }

  console.log('Repliz Client ready');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}

export { ReplizClient };
