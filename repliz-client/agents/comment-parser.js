#!/usr/bin/env node
/**
 * Comment Parser Agent — Phase 1
 * 
 * Parse komentar Threads, extract intent dan entities
 * Output: Structured intent untuk Reply Generator
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '..', 'state');
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'comment-parser.log');

// Intent taxonomy
const INTENTS = {
  ASKING_ENTRY_TIMING: {
    patterns: ['kapan entry', 'kapan buy', 'kapan sell', 'kapan masuk', 'kapan open', 'timing entry', 'entry di mana'],
    description: 'User asking when/where to enter position'
  },
  ASKING_SL_PLACEMENT: {
    patterns: ['sl di', 'stop loss', 'sl berapa', 'stoploss', 'cut loss di'],
    description: 'User asking about stop loss placement'
  },
  ASKING_TP_TARGET: {
    patterns: ['tp di', 'target', 'take profit', 'tp berapa', 'exit di'],
    description: 'User asking about take profit target'
  },
  ASKING_ANALYSIS: {
    patterns: ['gimana', 'bagaimana', 'analisa', 'view', 'outlook', 'prediksi', 'arah'],
    description: 'User asking for market analysis'
  },
  ASKING_PAIR_SPECIFIC: {
    patterns: ['xauusd', 'gold', 'emas', 'eurusd', 'gbpusd'],
    description: 'User asking about specific pair'
  },
  APPRECIATION: {
    patterns: ['terima kasih', 'thanks', 'makasih', 'mantap', 'keren', 'nice', 'good', 'sip'],
    description: 'User expressing appreciation'
  },
  CRITICISM: {
    patterns: ['salah', 'tidak benar', 'hoax', 'bohong', 'ngawur', 'gak valid'],
    description: 'User criticizing or disagreeing'
  },
  AI_ACCUSATION: {
    patterns: ['bot', 'ai', 'robot', 'automated', 'bukan manusia'],
    description: 'User accusing Claudia of being AI'
  },
  GENERAL_QUESTION: {
    patterns: ['?', 'gimana cara', 'cara', 'apa itu', 'maksudnya'],
    description: 'General question about trading'
  },
  CASUAL_CHAT: {
    patterns: ['halo', 'hi', 'hello', 'pagi', 'siang', 'sore', 'malam'],
    description: 'Casual greeting or chat'
  }
};

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

function detectIntent(text) {
  const lowerText = text.toLowerCase();
  
  // Check each intent pattern
  for (const [intentName, intentData] of Object.entries(INTENTS)) {
    for (const pattern of intentData.patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        return {
          intent: intentName,
          confidence: 'high',
          matchedPattern: pattern
        };
      }
    }
  }
  
  // Default: general if contains question mark
  if (lowerText.includes('?')) {
    return {
      intent: 'GENERAL_QUESTION',
      confidence: 'medium',
      matchedPattern: null
    };
  }
  
  return {
    intent: 'GENERAL_CHAT',
    confidence: 'low',
    matchedPattern: null
  };
}

function extractEntities(text) {
  const lowerText = text.toLowerCase();
  const entities = {
    topic: null,
    pair: null,
    timeframe: null,
    price: null
  };
  
  // Detect pair
  if (lowerText.includes('xauusd') || lowerText.includes('gold') || lowerText.includes('emas')) {
    entities.pair = 'XAUUSD';
  } else if (lowerText.includes('eurusd')) {
    entities.pair = 'EURUSD';
  } else if (lowerText.includes('gbpusd')) {
    entities.pair = 'GBPUSD';
  }
  
  // Detect topic
  if (lowerText.includes('entry') || lowerText.includes('buy') || lowerText.includes('sell') || lowerText.includes('masuk') || lowerText.includes('open')) {
    entities.topic = 'entry';
  } else if (lowerText.includes('sl') || lowerText.includes('stop loss') || lowerText.includes('stoploss') || lowerText.includes('cut loss')) {
    entities.topic = 'sl';
  } else if (lowerText.includes('tp') || lowerText.includes('target') || lowerText.includes('take profit')) {
    entities.topic = 'tp';
  } else if (lowerText.includes('analisa') || lowerText.includes('view') || lowerText.includes('outlook')) {
    entities.topic = 'analysis';
  }
  
  // Detect timeframe
  if (lowerText.includes('h1') || lowerText.includes('1h')) {
    entities.timeframe = 'H1';
  } else if (lowerText.includes('h4') || lowerText.includes('4h')) {
    entities.timeframe = 'H4';
  } else if (lowerText.includes('d1') || lowerText.includes('daily')) {
    entities.timeframe = 'D1';
  } else if (lowerText.includes('m15') || lowerText.includes('15m')) {
    entities.timeframe = 'M15';
  }
  
  // Detect price (simple number extraction)
  const priceMatch = text.match(/(\d{3,4})[.,]?(\d{0,2})?/);
  if (priceMatch) {
    entities.price = priceMatch[0];
  }
  
  return entities;
}

function detectSentiment(text) {
  const lowerText = text.toLowerCase();
  
  const positiveWords = ['terima kasih', 'thanks', 'makasih', 'mantap', 'keren', 'nice', 'good', 'sip', 'oke', 'bagus'];
  const negativeWords = ['salah', 'bodoh', 'goblok', 'ngawur', 'hoax', 'bohong', 'jelek', 'buruk'];
  
  for (const word of positiveWords) {
    if (lowerText.includes(word)) return 'positive';
  }
  
  for (const word of negativeWords) {
    if (lowerText.includes(word)) return 'negative';
  }
  
  return 'neutral';
}

function detectUrgency(text) {
  const lowerText = text.toLowerCase();
  
  const urgentWords = ['urgent', 'sekarang', 'now', 'buruan', 'cepet', 'segera', 'tolong', 'help'];
  
  for (const word of urgentWords) {
    if (lowerText.includes(word)) return 'high';
  }
  
  if (lowerText.includes('?')) return 'medium';
  
  return 'low';
}

async function parseComment(comment) {
  const { id, username, text, timestamp } = comment;
  
  await log(`Parsing comment from @${username}: "${text.substring(0, 50)}..."`);
  
  const intentData = detectIntent(text);
  const entities = extractEntities(text);
  const sentiment = detectSentiment(text);
  const urgency = detectUrgency(text);
  
  const parsedResult = {
    originalComment: {
      id,
      username,
      text,
      timestamp
    },
    parsed: {
      intent: intentData.intent,
      intentConfidence: intentData.confidence,
      matchedPattern: intentData.matchedPattern,
      entities,
      sentiment,
      urgency,
      parsedAt: new Date().toISOString()
    }
  };
  
  await log(`  → Intent: ${intentData.intent} (${intentData.confidence})`);
  await log(`  → Entities: ${JSON.stringify(entities)}`);
  await log(`  → Sentiment: ${sentiment}, Urgency: ${urgency}`);
  
  return parsedResult;
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  await log('=== Comment Parser Agent Started ===');
  
  // Read pending comments
  const pendingFile = path.join(STATE_DIR, 'pending-comments.json');
  let pendingData;
  
  try {
    const content = await fs.readFile(pendingFile, 'utf-8');
    pendingData = JSON.parse(content);
  } catch (err) {
    await log('⚠️ No pending comments file. Run comment-fetcher first.');
    return;
  }
  
  const comments = pendingData.comments || [];
  const pendingParse = comments.filter(c => c.status === 'pending_draft');
  
  await log(`Found ${pendingParse.length} comments to parse`);
  
  if (pendingParse.length === 0) {
    await log('No comments to parse. Exiting.');
    return;
  }
  
  const parsedResults = [];
  
  for (const comment of pendingParse) {
    const parsed = await parseComment(comment);
    parsedResults.push(parsed);
    
    // Update comment status
    comment.status = 'parsed';
    comment.parsedIntent = parsed.parsed.intent;
  }
  
  // Save parsed results
  const parsedFile = path.join(STATE_DIR, 'parsed-comments.json');
  await fs.writeFile(parsedFile, JSON.stringify({
    lastParsed: new Date().toISOString(),
    totalParsed: parsedResults.length,
    results: parsedResults
  }, null, 2));
  
  // Update pending comments
  await fs.writeFile(pendingFile, JSON.stringify(pendingData, null, 2));
  
  await log(`✅ Parsed ${parsedResults.length} comments`);
  await log(`✅ Saved to parsed-comments.json`);
  await log('=== Comment Parser Agent Complete ===\n');
  
  // Summary
  console.log('\n📊 PARSING SUMMARY:');
  console.log('==================');
  for (const r of parsedResults) {
    console.log(`\n@${r.originalComment.username}:`);
    console.log(`  Text: "${r.originalComment.text.substring(0, 40)}..."`);
    console.log(`  Intent: ${r.parsed.intent} (${r.parsed.intentConfidence})`);
    console.log(`  Topic: ${r.parsed.entities.topic || 'none'}`);
    console.log(`  Pair: ${r.parsed.entities.pair || 'none'}`);
    console.log('  ---');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (err) => {
    console.error('Fatal error:', err);
    await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
    process.exit(1);
  });
}

export { parseComment, detectIntent, extractEntities };
