#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const slotArg = process.argv[2]; // slot1..slot5
if (!slotArg) {
  console.error('Usage: node post-draft-slot.js <slot1|slot2|slot3|slot4|slot5>');
  process.exit(1);
}

(async () => {
  const draftsPath = path.join(root, 'content', 'daily-geopolitik-drafts.json');
  const logPath = path.join(root, 'logs', 'post-draft-slot.log');
  const raw = await fs.readFile(draftsPath, 'utf-8');
  const cfg = JSON.parse(raw);
  const slot = cfg.slots.find(s => s.label === slotArg);
  if (!slot) throw new Error(`Slot not found: ${slotArg}`);

  const text = slot.text.slice(0, 500); // hard cap

  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) throw new Error(`Init failed: ${init.error || 'unknown'}`);

  const res = await client.createPost(text);
  const line = `${new Date().toISOString()} ${slotArg} len=${text.length} ok=${!!res.ok} id=${res.postId || '-'} status=${res.raw?.status || res.status || '-'}\n`;
  await fs.appendFile(logPath, line);
  console.log(line.trim());
})();
