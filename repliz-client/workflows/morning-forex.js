#!/usr/bin/env node
/**
 * morning-forex.js — Workflow 08:00 WIB
 * Topik: Forex/Gold (XAUUSD) dengan data real-time
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

async function fetchConfluenceData() {
  try {
    const output = execSync(
      `cd ${rootDir} && node TechnicalAnalysis/scripts/compute-confluence.js --url https://f31b-2404-c0-ca01-b40e-bde0-f771-7b43-9c1f.ngrok-free.app --key "$API_KEY_MT5" --symbol XAUUSD`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return JSON.parse(output);
  } catch (err) {
    console.error('Failed to fetch confluence:', err.message);
    return null;
  }
}

async function fetchMacroInsights() {
  try {
    const macroFile = path.join(rootDir, 'memory', 'macro-insights.md');
    const content = await fs.readFile(macroFile, 'utf-8');
    // Extract latest briefing
    const latestMatch = content.match(/## (\d{4}-\d{2}-\d{2}T[^\n]+)[\s\S]*?(?=## \d{4}-\d{2}-\d{2}T|$)/);
    return latestMatch ? latestMatch[0] : null;
  } catch (err) {
    return null;
  }
}

function generateContent(data) {
  const { confluence_score, trade_direction, entry_suggestion } = data;
  const { ema20, price } = entry_suggestion || {};
  
  const isBullish = trade_direction === 'BUY';
  const score = confluence_score || 0;
  
  // Dynamic content based on real data
  if (score >= 8) {
    return `Jujurly pagi ini XAUUSD vibes-nya ${isBullish ? 'bullish' : 'bearish'} banget dengan confluence score ${score}/12. Price sekarang di ${price} which is masih ${ema20 > price ? 'di atas' : 'dekat'} EMA20. Basically setup yang bagus tapi ya tetep disiplin SL lah, jangan FOMO masuk market gegara cuan orang mulu yang dilihat.`;
  } else if (score >= 5) {
    return `Honestly setup hari ini agak mixed ya, confluence cuma ${score}/12. Market lagi ${isBullish ? 'cenderung naik' : 'cenderung turun'} tapi confidence-nya masih medium. Lebih baik mager dulu nunggu konfirmasi lebih kuat daripada nyangkut nanti.`;
  } else {
    return `Jujurly hari ini market-nya rada aneh, confluence score cuma ${score}/12 which is too low untuk entry. Sometimes the best trade is no trade, make sense kan? Mending ngopi dulu sampai setup yang proper muncul.`;
  }
}

async function main() {
  console.log('[08:00 Workflow] Starting Forex/Gold analysis...');
  
  // Fetch data
  const confluence = await fetchConfluenceData();
  const macro = await fetchMacroInsights();
  
  if (!confluence || !confluence.ok) {
    console.log('❌ Data fetch failed. Skipping post.');
    process.exit(0);
  }
  
  // Generate content
  const content = generateContent(confluence);
  
  // Log for review
  const logEntry = {
    timestamp: new Date().toISOString(),
    slot: 'morning',
    topic: 'forex/gold',
    data: {
      confluence_score: confluence.confluence_score,
      direction: confluence.trade_direction,
      price: confluence.entry_suggestion?.entry_price
    },
    content: content,
    status: 'ready_to_post'
  };
  
  const logFile = path.join(__dirname, '..', 'logs', 'content-generation.log');
  await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  
  console.log('Generated content:');
  console.log(content);
  console.log('\n[Ready to post via Repliz]');
  
  // Output for scheduler to capture
  console.log('\n---POST_CONTENT---');
  console.log(content);
}

main().catch(console.error);
