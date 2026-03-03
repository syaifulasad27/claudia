#!/usr/bin/env node
/**
 * smart-scheduler.js — Dynamic Content Scheduler
 * Triggers workflows + posts to Threads via Repliz
 * 
 * Cron: 0 8,14,20 * * *
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ReplizClient } from '../scripts/repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'scheduler.log');

const SCHEDULE_CONFIG = {
  '08:00': { workflow: 'morning-forex.js', topic: 'forex' },
  '14:00': { workflow: 'afternoon-macro.js', topic: 'macro' },
  '20:00': { workflow: 'evening-tech.js', topic: 'tech' }
};

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.appendFile(LOG_FILE, line).catch(() => {});
}

async function runWorkflow(workflowFile) {
  const workflowPath = path.join(WORKFLOWS_DIR, workflowFile);
  
  try {
    const output = execSync(`node ${workflowPath}`, {
      encoding: 'utf-8',
      timeout: 60000
    });
    
    // Extract content after ---POST_CONTENT---
    const match = output.match(/---POST_CONTENT---\n([\s\S]+)$/);
    if (match) {
      return match[1].trim();
    }
    
    return null;
  } catch (err) {
    await log(`❌ Workflow ${workflowFile} failed: ${err.message}`);
    return null;
  }
}

async function main() {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const timeKey = `${hour}:${minute}`;
  
  const config = SCHEDULE_CONFIG[timeKey];
  
  if (!config) {
    await log(`No schedule for ${timeKey}. Exiting.`);
    return;
  }
  
  await log(`🚀 Starting ${timeKey} schedule (${config.topic})`);
  
  // Step 1: Run workflow to generate content
  await log(`Running workflow: ${config.workflow}`);
  const content = await runWorkflow(config.workflow);
  
  if (!content) {
    await log('❌ No content generated. Skipping post.');
    return;
  }
  
  await log(`Generated content: "${content.substring(0, 50)}..."`);
  
  // Step 2: Post via Repliz
  await log('Posting to Threads...');
  
  const client = new ReplizClient();
  const initRes = await client.init();
  
  if (!initRes.ok) {
    await log(`❌ Repliz init failed: ${initRes.error}`);
    return;
  }
  
  const postRes = await client.createPost(content);
  
  if (postRes.ok) {
    await log(`✅ Posted! ID: ${postRes.postId}`);
  } else {
    await log(`❌ Post failed: ${postRes.reason || postRes.error}`);
  }
}

main().catch(async (err) => {
  console.error('Scheduler error:', err);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] FATAL: ${err.message}\n`).catch(() => {});
  process.exit(1);
});
