#!/usr/bin/env node
/**
 * integrated-workflow.js — Full LLM-Based Workflow
 * 
 * 1. Fetch comments
 * 2. LLM Analysis & Reply Generation
 * 3. Send to Telegram for approval
 * 
 * Run: Every 10 minutes
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runCommand(cmd, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', cwd: '/root/.openclaw/workspace/claudia' });
    console.log(output);
    return true;
  } catch (err) {
    console.error(`❌ ${description} failed:`, err.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   CLAUDIA THREADS WORKFLOW (LLM-Based) ║');
  console.log('╚════════════════════════════════════════╝\n');
  
  const timestamp = new Date().toISOString();
  console.log(`⏰ Run at: ${timestamp}\n`);
  
  // Step 1: Fetch Comments
  const fetchSuccess = await runCommand(
    'node repliz-client/scripts/comment-fetcher.js',
    'Step 1: Fetching comments from Threads'
  );
  
  if (!fetchSuccess) {
    console.log('⚠️  Fetch failed or no new comments. Exiting.');
    return;
  }
  
  // Step 2: Generate Smart Replies (LLM)
  const generateSuccess = await runCommand(
    'node repliz-client/scripts/smart-reply-generator.js',
    'Step 2: Generating contextual replies with LLM'
  );
  
  if (!generateSuccess) {
    console.log('⚠️  Reply generation failed. Exiting.');
    return;
  }
  
  // Step 3: Notify Tuan via Telegram
  const notifySuccess = await runCommand(
    'node repliz-client/scripts/notify-tuan.js',
    'Step 3: Sending approval request to Telegram'
  );
  
  if (!notifySuccess) {
    console.log('⚠️  Telegram notification failed.');
    console.log('   Check TELEGRAM_BOT_TOKEN in .env');
  }
  
  console.log('\n✅ Workflow complete!');
  console.log('   Next: Tuan reviews and approves via Telegram');
  console.log('   Handler will publish approved replies.\n');
}

main().catch(console.error);
