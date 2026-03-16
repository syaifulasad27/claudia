#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const trendsFile = path.join(root, 'MarketingIntelligence', 'state', 'marketing-trends.json');
const sentimentFile = path.join(root, 'MarketingIntelligence', 'state', 'audience-sentiment.json');
const outFile = path.join(root, 'memory', 'marketing-insights.json');

const trendData = await readJson(trendsFile, { trends: [] });
const sentiment = await readJson(sentimentFile, { sentiment: {} });
const insights = (trendData.trends || []).map((trend) => ({
  theme: trend.theme,
  opportunityScore: trend.opportunityScore,
  rationale: `${trend.rationale} Sentiment pain count: ${sentiment.sentiment?.pain || 0}.`,
  suggestedAngles: [
    `${trend.theme} tutorial`,
    `${trend.theme} mistakes to avoid`,
    `${trend.theme} practical framework`,
  ],
}));

await writeJson(outFile, { generatedAt: new Date().toISOString(), insights });
console.log(JSON.stringify({ ok: true, file: outFile, count: insights.length }, null, 2));

