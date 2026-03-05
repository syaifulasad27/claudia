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

function getDateKeyWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

(async () => {
  const draftsPath = path.join(root, 'content', 'daily-geopolitik-drafts.json');
  const logPath = path.join(root, 'logs', 'post-draft-slot.log');
  const statePath = path.join(root, 'state', 'posted-slots.json');

  const raw = await fs.readFile(draftsPath, 'utf-8');
  const cfg = JSON.parse(raw);
  const slot = cfg.slots.find(s => s.label === slotArg);
  if (!slot) throw new Error(`Slot not found: ${slotArg}`);

  const dateKey = getDateKeyWIB();

  // Load state
  let state = { byDate: {} };
  try {
    state = JSON.parse(await fs.readFile(statePath, 'utf-8'));
  } catch {
    // first run
  }
  if (!state.byDate[dateKey]) state.byDate[dateKey] = { postedSlots: [] };

  // Skip if slot already posted today
  if (state.byDate[dateKey].postedSlots.includes(slotArg)) {
    const line = `${new Date().toISOString()} ${slotArg} SKIP already-posted date=${dateKey}\n`;
    await fs.appendFile(logPath, line);
    process.stdout.write(line);
    process.exit(0);
  }

  const text = slot.text.slice(0, 500); // hard cap

  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) throw new Error(`Init failed: ${init.error || 'unknown'}`);

  const res = await client.createPost(text);

  // Mark slot as posted only if accepted by API
  if (res?.ok) {
    state.byDate[dateKey].postedSlots.push(slotArg);
    await fs.mkdir(path.join(root, 'state'), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  const line = `${new Date().toISOString()} ${slotArg} len=${text.length} ok=${!!res?.ok} id=${res?.postId || '-'} status=${res?.raw?.status || res?.status || '-'} date=${dateKey}\n`;
  await fs.appendFile(logPath, line);
  process.stdout.write(line);
})();
