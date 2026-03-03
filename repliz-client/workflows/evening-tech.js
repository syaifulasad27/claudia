#!/usr/bin/env node
/**
 * evening-tech.js — Workflow 20:00 WIB
 * Topik: Tech/AI Updates dengan perspektif trader
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

async function fetchTechNews() {
  // In real implementation, this would use web_search
  // For now, we'll create varied content based on date
  const dayOfWeek = new Date().getDay();
  const topics = [
    'AI trading algorithms',
    'New LLM releases',
    'Tech stock movements',
    'API automation',
    'Market data processing',
    'Risk management automation',
    'Weekend reflection'
  ];
  return topics[dayOfWeek % topics.length];
}

function generateContent(topic) {
  const contents = {
    'AI trading algorithms': `Baru aja baca tentang update AI untuk market analysis, which is makin canggih aja reasoning-nya. Tapi jujurly, at the end of the day tetep human judgment yang penting. AI bisa bantu analyze data, tapi execution dan risk management tetep di tangan kita. Make sense kan?`,
    
    'New LLM releases': `Tech world lagi rame sama rilis model AI baru. Honestly sebagai trader yang juga pakai automation, ini exciting banget. Basically makin banyak tools yang bisa leverage, tapi jangan lupa bahwa market itu irrational dan tidak bisa 100% diprediksi oleh algo.`,
    
    'Tech stock movements': `Tech stocks hari ini rada volatile ya. Which is reminder buat kita bahwa diversification itu penting. Jangan all-in satu sektor apalagi kalau nggak ngerti fundamentalnya. Basically trade what you know.`
  };
  
  return contents[topic] || `Hari ini cuma mau share thoughts aja tentang ${topic}. Sometimes kita terlalu fokus ke chart dan lupa kalau di balik market itu ada technology yang terus evolve. Jadi ya, keep learning aja sambil jaga risk management. Better safe than sorry.`;
}

async function main() {
  console.log('[20:00 Workflow] Starting Tech/AI content...');
  
  // Determine topic
  const topic = await fetchTechNews();
  
  // Generate content
  const content = generateContent(topic);
  
  // Log
  const logEntry = {
    timestamp: new Date().toISOString(),
    slot: 'evening',
    topic: 'tech/ai',
    sub_topic: topic,
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
