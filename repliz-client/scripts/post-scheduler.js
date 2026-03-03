#!/usr/bin/env node
/**
 * post-scheduler.js — Automated Posting Scheduler for Threads
 * 
 * Run via cron every 15 minutes to check and publish scheduled posts
 * Cron: */15 * * * * cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/post-scheduler.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const QUEUE_FILE = path.join(__dirname, '..', 'content', 'scheduled', 'queue.json');
const POSTED_DIR = path.join(__dirname, '..', 'content', 'posted');
const LOG_FILE = path.join(__dirname, '..', 'logs', 'scheduler.log');

async function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  await fs.appendFile(LOG_FILE, logLine).catch(() => {});
}

async function loadQueue() {
  try {
    const data = await fs.readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { queue: [], lastUpdated: new Date().toISOString() };
  }
}

async function saveQueue(queueData) {
  queueData.lastUpdated = new Date().toISOString();
  await fs.writeFile(QUEUE_FILE, JSON.stringify(queueData, null, 2));
}

async function archivePost(post) {
  await fs.mkdir(POSTED_DIR, { recursive: true });
  const archiveFile = path.join(POSTED_DIR, `${post.id}_${Date.now()}.json`);
  await fs.writeFile(archiveFile, JSON.stringify(post, null, 2));
}

async function main() {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  log('Scheduler started');
  
  const client = new ReplizClient();
  await client.init();
  
  const queueData = await loadQueue();
  const now = new Date();
  
  let published = 0;
  let skipped = 0;
  
  for (const post of queueData.queue) {
    // Skip already posted
    if (post.status === 'posted') {
      continue;
    }
    
    const scheduledTime = new Date(post.scheduledFor);
    
    // Check if it's time to post (within last 15 minutes)
    const timeDiff = now - scheduledTime;
    const fifteenMinutes = 15 * 60 * 1000;
    
    if (timeDiff >= 0 && timeDiff <= fifteenMinutes) {
      log(`Publishing post ${post.id}...`);
      
      try {
        const result = await client.createPost(post.content);
        
        if (result.ok) {
          post.status = 'posted';
          post.postedAt = new Date().toISOString();
          post.postId = result.postId;
          post.url = result.url;
          
          await archivePost(post);
          published++;
          log(`✅ Published: ${result.url}`);
        } else {
          log(`❌ Failed to publish ${post.id}: ${result.reason || 'Unknown error'}`);
        }
      } catch (err) {
        log(`❌ Error publishing ${post.id}: ${err.message}`);
      }
    } else if (timeDiff > fifteenMinutes) {
      // Missed the window
      log(`⚠️ Missed window for ${post.id}`);
      post.status = 'missed';
      skipped++;
    }
  }
  
  await saveQueue(queueData);
  
  log(`Scheduler complete: ${published} published, ${skipped} missed`);
}

main().catch(err => {
  console.error('Scheduler error:', err);
  process.exit(1);
});
