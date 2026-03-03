#!/usr/bin/env node
/**
 * repliz-client.js — Repliz API Wrapper for Threads Social Media Management
 * 
 * Target API: https://clawhub.ai/staryone/repliz
 * Base URL: https://api.repliz.com
 * Authentication: Basic Auth (REPLIZ_ACCESS_KEY:REPLIZ_SECRET_KEY)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import crypto from 'node:crypto'; // For generating dummy IDs if needed locally

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from root .env
const rootDir = path.join(__dirname, '..', '..');
const envPath = path.join(rootDir, '.env');
dotenv.config({ path: envPath });

class ReplizClient {
  constructor() {
    // Determine Base URL. The env var might include /public so we handle it cleanly
    const envBase = process.env.REPLIZ_API_BASE_URL || 'https://api.repliz.com/public';
    this.baseUrl = envBase.endsWith('/public') ? envBase.replace('/public', '') : envBase;
    
    this.accessKey = process.env.REPLIZ_ACCESS_KEY;
    this.secretKey = process.env.REPLIZ_SECRET_KEY;
    this.username = process.env.THREADS_USERNAME || 'notesbyclaudia';
    this.stateDir = path.join(__dirname, '..', 'state');
    
    // We need to fetch and store the actual account ID from /public/account
    this.accountId = null;
  }

  /**
   * Helper to build full endpoint URL ensuring /public is present
   */
  _buildUrl(endpoint) {
    if (endpoint.startsWith('/public/')) return `${this.baseUrl}${endpoint}`;
    return `${this.baseUrl}/public${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  /**
   * Make HTTP request to Repliz API using native fetch
   */
  async request(method, endpoint, data = null) {
    if (!this.accessKey || !this.secretKey) {
      return { ok: false, error: 'Missing REPLIZ_ACCESS_KEY or REPLIZ_SECRET_KEY' };
    }

    const url = this._buildUrl(endpoint);
    
    // Basic Authentication Header
    const authString = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`
    };

    const options = { method, headers };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      // Handle no content response
      if (response.status === 204) {
        return { ok: true, status: response.status };
      }

      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        return { 
          ok: false, 
          status: response.status, 
          error: responseData.message || responseData || 'API Error' 
        };
      }

      return { ok: true, status: response.status, data: responseData };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Initialize client: Fetch account ID to be used for posting
   */
  async init() {
    await fs.mkdir(this.stateDir, { recursive: true });
    
    console.log('Repliz Client initializing...');
    
    // Fetch Accounts to find the Correct Account ID
    const res = await this.request('GET', '/account');
    
    if (!res.ok) {
      console.error('Failed to fetch accounts:', res.error);
      return { ok: false, error: res.error };
    }

    // Assuming the API returns an array or object of accounts
    const accounts = Array.isArray(res.data) ? res.data : (res.data.accounts || res.data.data || Object.values(res.data));
    
    if (accounts && accounts.length > 0) {
      // Find account matching username, or just pick the first one
      const targetAcc = accounts.find(a => a.username === this.username || a.name === this.username) || accounts[0];
      this.accountId = targetAcc._id || targetAcc.id;
      console.log(`✅ Connected to account: ${targetAcc.username || targetAcc.name || 'Unknown'} (ID: ${this.accountId})`);
    } else {
      console.warn('⚠️ No accounts found connected to this API key.');
      return { ok: false, error: 'No accounts found' };
    }

    return { ok: true, accountId: this.accountId };
  }

  /**
   * Create a Post or Thread on Threads via /public/schedule
   */
  async createPost(content, options = {}) {
    if (!this.accountId) {
      return { ok: false, error: 'Account ID not initialized. Call init() first.' };
    }

    // Strict Anti-Spam Filter (New Hooks)
    if (this.containsForeignChars(content)) {
      console.log('Skipping post: contains foreign characters (Anti-Spam)');
      return { ok: false, reason: 'foreign_chars_detected' };
    }

    const payload = {
      accountId: this.accountId,
      type: 'text', // Assuming text post by default
      description: content,
      scheduleAt: options.scheduleAt || new Date().toISOString(),
      medias: options.medias || [],
      title: options.title || ''
    };

    // If it's a Thread (Nested posts), add replies array
    if (options.replies && Array.isArray(options.replies) && options.replies.length > 0) {
      for (const reply of options.replies) {
        if (this.containsForeignChars(reply)) {
          console.log('Skipping thread: a reply contains foreign characters (Anti-Spam)');
          return { ok: false, reason: 'foreign_chars_detected_in_thread' };
        }
      }

      payload.replies = options.replies.map(replyContent => ({
        type: 'text',
        description: replyContent,
        medias: []
      }));
    }

    const res = await this.request('POST', '/schedule', payload);
    
    if (res.ok) {
      return {
        ok: true,
        postId: res.data._id || res.data.id || crypto.randomUUID(),
        status: 'published_or_scheduled',
        raw: res.data
      };
    } else {
      return { ok: false, reason: res.error };
    }
  }

  /**
   * Fetch Comment Queue
   */
  async getQueue(options = { page: 1, limit: 20 }) {
    const params = new URLSearchParams({
      page: options.page,
      limit: options.limit,
      status: options.status || 'pending'
    });
    
    if (this.accountId) params.append('accountIds', this.accountId);

    return await this.request('GET', `/queue?${params.toString()}`);
  }

  /**
   * Reply to a Comment (Marks as resolved)
   */
  async replyToComment(commentId, replyText) {
    if (this.containsForeignChars(replyText)) {
      console.log('Skipping reply: contains foreign characters');
      return { ok: false, reason: 'foreign_chars_detected' };
    }

    const payload = { text: replyText };
    const res = await this.request('POST', `/queue/${commentId}`, payload);
    
    return res.ok 
      ? { ok: true, status: 'resolved', raw: res.data }
      : { ok: false, error: res.error };
  }

  /**
   * Detect foreign/unknown characters (Anti-Spam Filter)
   * Specifically blocks Chinese, Japanese, Korean, Arabic, Thai, and ALL Indian scripts
   */
  containsForeignChars(text) {
    const blockedRanges = [
      /[\u4E00-\u9FFF]/, // Chinese (CJK Unified Ideographs)
      /[\u3400-\u4DBF]/, // Chinese Extension A
      /[\u3040-\u309F]/, // Hiragana (Japanese)
      /[\u30A0-\u30FF]/, // Katakana (Japanese)
      /[\uAC00-\uD7AF]/, // Korean Hangul
      /[\u0600-\u06FF]/, // Arabic
      /[\u0590-\u05FF]/, // Hebrew
      /[\u0E00-\u0E7F]/, // Thai
      /[\u0900-\u097F]/, // Devanagari (Hindi, Marathi, Nepali, Sanskrit)
      /[\u0980-\u09FF]/, // Bengali & Assamese
      /[\u0A80-\u0AFF]/, // Gujarati
      /[\u0B00-\u0B7F]/, // Oriya
      /[\u0B80-\u0BFF]/, // Tamil
      /[\u0C00-\u0C7F]/, // Telugu
      /[\u0C80-\u0CFF]/, // Kannada
      /[\u0D00-\u0D7F]/, // Malayalam
    ];

    for (const range of blockedRanges) {
      if (range.test(text)) return true;
    }
    return false;
  }
}

// ─── CLI Execution ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const client = new ReplizClient();
  
  if (['post', 'thread', 'queue', 'reply', 'init'].includes(command)) {
    const initRes = await client.init();
    if (!initRes.ok) {
      console.error('Initialization failed. Aborting.');
      process.exit(1);
    }
  }

  switch (command) {
    case 'init':
      console.log('Client successfully validated connection to Repliz.');
      break;

    case 'post': {
      const content = args[1];
      if (!content) {
        console.error('Usage: node repliz-client.js post "your text here"');
        process.exit(1);
      }
      const result = await client.createPost(content);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'thread': {
      // Usage: node repliz-client.js thread "Post 1" "Reply 1" "Reply 2"
      const mainContent = args[1];
      const replies = args.slice(2);
      if (!mainContent) {
        console.error('Usage: node repliz-client.js thread "Main" "Reply1" "Reply2"');
        process.exit(1);
      }
      const result = await client.createPost(mainContent, { replies });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'queue': {
      const qRes = await client.getQueue();
      console.log(JSON.stringify(qRes, null, 2));
      break;
    }

    case 'reply': {
      const commentId = args[1];
      const replyContent = args[2];
      if (!commentId || !replyContent) {
        console.error('Usage: repliz-client.js reply <commentId> <content>');
        process.exit(1);
      }
      const replyResult = await client.replyToComment(commentId, replyContent);
      console.log(JSON.stringify(replyResult, null, 2));
      break;
    }

    case 'test-filter':
      console.log('Testing foreign char block:');
      console.log('Indonesian:', client.containsForeignChars('Selamat pagi'));
      console.log('Chinese (Blocked):', client.containsForeignChars('你好世界'));
      break;

    default:
      console.log('Repliz Client (ClawHub API Version)');
      console.log('Commands:');
      console.log('  init                     Test auth & fetch account ID');
      console.log('  post <text>              Create a single post');
      console.log('  thread <main> <r1> <r2>  Create a thread with replies');
      console.log('  queue                    List pending comments');
      console.log('  reply <id> <text>        Reply to a comment in queue');
      console.log('  test-filter              Test character filters');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ReplizClient };
