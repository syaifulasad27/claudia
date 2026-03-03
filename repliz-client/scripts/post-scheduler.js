#!/usr/bin/env node
/**
 * post-scheduler.js — Automated Posting Scheduler for Threads
 * 
 * Run via cron every 15 minutes to check and publish scheduled posts
 * Cron: 0,15,30,45 * * * * cd /root/.openclaw/workspace/claudia && node repliz-client/scripts/post-scheduler.js
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

// Promisified setTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  log('Scheduler started');
  
  const client = new ReplizClient();
  await client.init();
  
  const queueData = await loadQueue();
  const now = new Date();
  
  let published = 0;
  let skipped = 0;
  
  const publishTasks = [];
  
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
      // 🎲 JITTERING: Add random delay between 1 to 45 minutes to seem human
      const jitterMinutes = Math.floor(Math.random() * 45) + 1;
      const jitterMs = jitterMinutes * 60 * 1000;
      
      log(`Jitter delay added: waiting ${jitterMinutes} minutes before publishing post ${post.id}...`);
      
      // Push promise to array to wait for all jittered posts
      publishTasks.push((async () => {
        await delay(jitterMs);
        
        log(`Executing jittered publication for post ${post.id}...`);
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
      })());
      
    } else if (timeDiff > fifteenMinutes) {
      // Missed the window
      log(`⚠️ Missed window for ${post.id}`);
      post.status = 'missed';
      skipped++;
    }
  }
  
  // Wait for all jittered publishers to finish
  if (publishTasks.length > 0) {
    log(`Waiting for ${publishTasks.length} jittered post(s) to finish...`);
    await Promise.all(publishTasks);
  }
  
  await saveQueue(queueData);
  
  log(`Scheduler complete: ${published} published, ${skipped} missed`);
}

main().catch(err => {
  console.error('Scheduler error:', err);
  process.exit(1);
});
