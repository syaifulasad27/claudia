#!/usr/bin/env node
/**
 * afternoon-macro.js — Workflow 14:00 WIB
 * Topik: Stocks/Macro/Geopolitik dengan data terkini
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

async function fetchLatestMacro() {
  try {
    // Run MarketIntelligence skill untuk data terbaru
    const macroFile = path.join(rootDir, 'memory', 'macro-insights.md');
    const content = await fs.readFile(macroFile, 'utf-8');
    
    // Extract today's briefing
    const today = new Date().toISOString().split('T')[0];
    const regex = new RegExp(`## ${today}T[^\\n]+([\\s\\S]*?)(?=## \\d{4}-\\d{2}-\\d{2}T|$)`);
    const match = content.match(regex);
    
    return match ? match[1].trim() : null;
  } catch (err) {
    return null;
  }
}

async function fetchStockMarketNews() {
  try {
    // Simple search simulation - in real implementation would use web_search tool
    // For now, return null to trigger fallback
    return null;
  } catch (err) {
    return null;
  }
}

function generateContent(macroData) {
  if (!macroData) {
    return `Honestly hari ini macro-nya agak sepi, which is kadang-kadang better daripada terlalu banyak noise. Basically kita fokus ke technical setup aja sambil nunggu news yang signifikan. Make sense kan?`;
  }
  
  // Check for high-impact keywords
  const hasGeopolitical = /iran|strikes|war|geopolitics|tension/i.test(macroData);
  const hasEconomicData = /CPI|NFP|FOMC|ECB|Fed|interest rate/i.test(macroData);
  const hasGoldImpact = /XAUUSD|gold|safe haven/i.test(macroData);
  
  if (hasGeopolitical && hasGoldImpact) {
    return `Jujurly geopolitik luar lagi panas banget, which is literally salah satu alasan kenapa safe haven kayak gold susah turun. Tapi inget ya, trade based on technical, jangan cuma FOMO gara-gara news. SL tetep wajib, at the end of the day risk management yang selamatkan account.`;
  }
  
  if (hasEconomicData) {
    return `Basically hari ini ada rilis data ekonomi penting which is bisa bikin market volatil. Buat yang suka maksa nahan posisi tanpa SL, literally siap-siap MC deh. Data-driven trading means respect the numbers, bukan cuma feeling.`;
  }
  
  return `Macro hari ini mixed signals ya. Honestly yang namanya trading itu bukan cuma lihat chart, tapi juga understand konteks besarnya. Jadi lebih aware aja kalau ada event-event yang bisa nge-spike price tiba-tiba.`;
}

async function main() {
  console.log('[14:00 Workflow] Starting Macro/Stocks analysis...');
  
  // Fetch data
  const macro = await fetchLatestMacro();
  
  // Generate content
  const content = generateContent(macro);
  
  // Log
  const logEntry = {
    timestamp: new Date().toISOString(),
    slot: 'afternoon',
    topic: 'macro/stocks',
    data_source: macro ? 'macro-insights.md' : 'fallback',
    content: content,
    status: 'ready_to_post'
  };
  
  const logFile = path.join(__dirname, '..', 'logs', 'content-generation.log');
  await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  
  console.log('Generated content:');
  console.log(content);
  console.log('\n[Ready to post via Repliz]');
  
  console.log('\n---POST_CONTENT---');
  console.log(content);
}

main().catch(console.error);
