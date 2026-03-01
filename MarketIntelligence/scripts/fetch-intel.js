#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import Parser from 'rss-parser';
import { XMLParser } from 'fast-xml-parser';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_DIR = path.join(ROOT, 'state');
const RAW_FILE = path.join(STATE_DIR, 'raw-intel.json');
const BRAVE_STATE = path.join(STATE_DIR, 'brave-usage.json');

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
const YAHOO_URL = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,^IXIC&region=US&lang=en-US';
const FXSTREET_URL = 'https://www.fxstreet.com/rss/news';
const INVESTING_URL = 'https://www.investing.com/rss/news.rss';

const argv = new Set(process.argv.slice(2));
const useBrave = argv.has('--use-brave');
const forceBrave = argv.has('--force-brave');
const braveQueryIdx = process.argv.indexOf('--brave-query');
const braveQuery = braveQueryIdx > -1 ? process.argv[braveQueryIdx + 1] : 'gold nasdaq macro news';

const rss = new Parser();
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', allowBooleanAttributes: true, parseTagValue: true, trimValues: true });

async function ensureStateDir() { await fs.mkdir(STATE_DIR, { recursive: true }); }

async function fetchForexFactory() {
  const res = await fetch(FF_URL, { headers: { 'User-Agent': 'MarketIntelligence/0.2' } });
  if (!res.ok) throw new Error(`ForexFactory fetch failed: ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const events = parsed?.weeklyevents?.event ?? [];
  const list = Array.isArray(events) ? events : [events];
  return list.filter(Boolean).map((e) => ({
    id: `ff-${e.id ?? `${e.date}-${e.time}-${e.currency}-${e.title}`}`,
    timestamp_utc: inferUtcDate(e.date, e.time), source: 'forexfactory', type: 'economic',
    title: e.title ?? 'Untitled event', currency: e.currency ?? null,
    impact_raw: e.impact ?? e.impact_title ?? null, actual: e.actual ?? null, forecast: e.forecast ?? null, previous: e.previous ?? null,
    assets_affected: mapAssetsFromCurrency(e.currency)
  }));
}

function mapRssItems(source, feed) {
  return (feed.items || []).map((item, i) => {
    const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
    return {
      id: `${source}-${item.guid || item.link || i}`,
      timestamp_utc: item.isoDate || item.pubDate || new Date().toISOString(),
      source, type: 'market', title: item.title || 'Untitled headline', url: item.link || null,
      summary: item.contentSnippet || null, impact_raw: null, assets_affected: mapAssetsFromText(text)
    };
  });
}

async function fetchYahoo() { return mapRssItems('yahoo-finance-rss', await rss.parseURL(YAHOO_URL)); }
async function fetchFxstreet() { return mapRssItems('fxstreet-rss', await rss.parseURL(FXSTREET_URL)); }
async function fetchInvesting() { return mapRssItems('investing-rss', await rss.parseURL(INVESTING_URL)); }

async function maybeBraveFallback(allowReason) {
  const key = process.env.BRAVE_API_KEY;
  if ((!useBrave && !forceBrave) || !key) return { used: false, items: [], reason: 'disabled-or-missing-key' };
  if (!forceBrave && allowReason !== 'needed') return { used: false, items: [], reason: 'not-needed-this-cycle' };

  const now = Date.now();
  const dayKey = getWibDayKey(); // enforce daily cap in WIB.
  const state = await readJson(BRAVE_STATE, { lastRequestMs: 0, dayKey, dayCount: 0, totalCount: 0 });

  let dayCount = state.dayCount || 0;
  if (state.dayKey !== dayKey) dayCount = 0;

  const oneHour = 60 * 60 * 1000;
  const dailyCap = 32;

  if (!forceBrave && now - (state.lastRequestMs || 0) < oneHour) return { used: false, items: [], reason: 'hourly-cap-reached' };
  if (!forceBrave && dayCount >= dailyCap) return { used: false, items: [], reason: 'daily-cap-reached-32' };

  const qs = new URLSearchParams({ q: braveQuery, count: '5', freshness: 'pw' });
  const url = `https://api.search.brave.com/res/v1/web/search?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key, 'User-Agent': 'MarketIntelligence/0.2' } });
  if (!res.ok) return { used: false, items: [], reason: `brave-http-${res.status}` };

  const json = await res.json();
  const items = (json?.web?.results || []).map((r, i) => ({
    id: `brave-${i}-${r.url}`, timestamp_utc: new Date().toISOString(), source: 'brave-search', type: 'geopolitical',
    title: r.title || 'Untitled result', url: r.url || null, summary: r.description || null, impact_raw: null,
    assets_affected: mapAssetsFromText(`${r.title || ''} ${r.description || ''}`.toLowerCase())
  }));

  const nextState = {
    lastRequestMs: now,
    query: braveQuery,
    dayKey,
    dayCount: dayCount + 1,
    totalCount: (state.totalCount || 0) + 1
  };
  await fs.writeFile(BRAVE_STATE, JSON.stringify(nextState, null, 2));
  return { used: true, items, reason: `ok(day=${nextState.dayCount}/32)` };
}

function inferUtcDate(date, time) {
  if (!date) return null;
  const parsed = new Date(`${date} ${time || '00:00am'} UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function getWibDayKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
function mapAssetsFromCurrency(currency = '') {
  const c = String(currency).toUpperCase(); const assets = [];
  if (['USD', 'EUR', 'GBP', 'JPY'].includes(c)) assets.push('XAUUSD', 'NASDAQ');
  return [...new Set(assets)];
}
function mapAssetsFromText(text = '') {
  const t = text.toLowerCase(); const assets = [];
  if (/(gold|xau|bullion|treasury|fed|inflation|real yields)/.test(t)) assets.push('XAUUSD');
  if (/(nasdaq|\^ixic|tech stocks|rate cut|ai stocks|nvidia)/.test(t)) assets.push('NASDAQ');
  if (!assets.length) assets.push('XAUUSD', 'NASDAQ');
  return [...new Set(assets)];
}
async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }

async function main() {
  await ensureStateDir();
  const ff = await Promise.allSettled([fetchForexFactory()]).then((r) => r[0]);
  const y = await Promise.allSettled([fetchYahoo()]).then((r) => r[0]);

  let fallbackSource = { status: 'skipped', items: [] };
  if (y.status !== 'fulfilled') {
    const fx = await Promise.allSettled([fetchFxstreet()]).then((r) => r[0]);
    if (fx.status === 'fulfilled') fallbackSource = { status: 'fulfilled', name: 'fxstreet', items: fx.value };
    else {
      const inv = await Promise.allSettled([fetchInvesting()]).then((r) => r[0]);
      if (inv.status === 'fulfilled') fallbackSource = { status: 'fulfilled', name: 'investing', items: inv.value };
      else fallbackSource = { status: 'error', name: 'fxstreet+investing', error: `${fx.reason?.message || fx.reason}; ${inv.reason?.message || inv.reason}`, items: [] };
    }
  }

  const needBrave = ff.status !== 'fulfilled' || (y.status !== 'fulfilled' && fallbackSource.status !== 'fulfilled');
  const brave = await maybeBraveFallback(needBrave ? 'needed' : 'not-needed');

  const payload = {
    generated_at: new Date().toISOString(),
    sources: {
      forexfactory: ff.status === 'fulfilled' ? 'ok' : `error: ${ff.reason?.message || ff.reason}`,
      yahoo: y.status === 'fulfilled' ? 'ok' : `error: ${y.reason?.message || y.reason}`,
      fallback_rss: y.status === 'fulfilled' ? 'not-used' : (fallbackSource.status === 'fulfilled' ? `ok:${fallbackSource.name}` : `error:${fallbackSource.error || 'none'}`),
      brave: brave.reason
    },
    items: [
      ...(ff.status === 'fulfilled' ? ff.value : []),
      ...(y.status === 'fulfilled' ? y.value : []),
      ...(y.status !== 'fulfilled' && fallbackSource.status === 'fulfilled' ? fallbackSource.items : []),
      ...brave.items
    ]
  };

  await fs.writeFile(RAW_FILE, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: true, file: RAW_FILE, count: payload.items.length, sources: payload.sources }, null, 2));
}

main().catch((err) => { console.error(JSON.stringify({ ok: false, error: err.message }, null, 2)); process.exit(1); });
