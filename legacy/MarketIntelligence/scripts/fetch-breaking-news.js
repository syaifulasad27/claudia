#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import Parser from 'rss-parser';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATE_DIR = path.join(ROOT, 'state');
const BREAKING_FILE = path.join(STATE_DIR, 'breaking-news.json');

// We use ultra-fast/frequent RSS feeds for breaking news.
const RSS_URLS = [
  { source: 'investing-breaking', url: 'https://www.investing.com/rss/news_285.rss' }, // Breaking news or specific fast categories
  { source: 'yahoo-finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,^IXIC&region=US&lang=en-US' }
];

const rss = new Parser();

// Only consider news from the last 60 minutes for "breaking" context
const MAX_AGE_MS = 60 * 60 * 1000;

async function ensureStateDir() {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

function mapAssetsFromText(text = '') {
  const t = text.toLowerCase();
  const assets = [];
  if (/(gold|xau|bullion|treasury|fed|inflation|real yields)/.test(t)) assets.push('XAUUSD');
  if (/(nasdaq|\^ixic|tech stocks|rate cut|ai stocks|nvidia)/.test(t)) assets.push('NASDAQ');
  if (!assets.length) assets.push('XAUUSD', 'NASDAQ'); // Default assumption if ambiguous but breaking
  return [...new Set(assets)];
}

async function fetchFeed(source, url) {
  try {
    const feed = await rss.parseURL(url);
    const now = Date.now();

    return (feed.items || [])
      .map((item, i) => {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
        const timestamp_utc = item.isoDate || item.pubDate || new Date().toISOString();
        const ageMs = now - new Date(timestamp_utc).getTime();
        
        return {
          id: `${source}-fast-${item.guid || item.link || i}`,
          timestamp_utc,
          age_ms: ageMs,
          source,
          type: 'breaking_news',
          title: item.title || 'Untitled headline',
          url: item.link || null,
          summary: item.contentSnippet || null,
          impact_raw: 'FAST_TRACK', // High likelihood of being relevant if keywords match
          assets_affected: mapAssetsFromText(text)
        };
      })
      .filter((item) => item.age_ms <= MAX_AGE_MS && item.age_ms >= 0); // Only keep recent news
  } catch (err) {
    console.error(`Failed to fetch fast feed ${source}:`, err.message);
    return [];
  }
}

async function main() {
  await ensureStateDir();

  const allFastItems = [];
  const sourcesHealth = {};

  for (const feed of RSS_URLS) {
    const items = await fetchFeed(feed.source, feed.url);
    if (items && items.length > 0) {
      allFastItems.push(...items);
      sourcesHealth[feed.source] = 'ok';
    } else {
      sourcesHealth[feed.source] = 'empty_or_error';
    }
  }

  // Sort by newest first
  allFastItems.sort((a, b) => a.age_ms - b.age_ms);

  const payload = {
    generated_at: new Date().toISOString(),
    sources: sourcesHealth,
    items: allFastItems.slice(0, 30) // Cap the list
  };

  await fs.writeFile(BREAKING_FILE, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: true, file: BREAKING_FILE, count: payload.items.length, sources: payload.sources }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
