#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ReplizClient } from './repliz-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const slotArg = process.argv[2]; // slot1..slot5
if (!slotArg) {
  console.error('Usage: node post-draft-slot.js <slot1|slot2|slot3|slot4|slot5>');
  process.exit(1);
}

function getWibDateObj() {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}

function getDateKeyWIB() {
  const wib = getWibDateObj();
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayIndexWIB() {
  const d = getWibDateObj();
  const dayOfYear = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  return dayOfYear;
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hashText(text) {
  return crypto.createHash('sha256').update(normalizeText(text)).digest('hex').slice(0, 16);
}

function makeFallback(slotLabel, dateKey) {
  const hooks = [
    'Kadang yang paling berbahaya bukan pelurunya, tapi narasi yang bikin publik lengah.',
    'Di era geopolitik panas, siapa pegang framing biasanya pegang arah opini massa.',
    'Headline cepat itu bukan selalu informasi lengkap; seringnya cuma potongan konflik.'
  ];
  const angles = {
    slot1: 'Kalau kamu pilih satu, mana yang paling wajib dicek dulu: sumber primer, konteks, atau timeline?',
    slot2: 'Menurutmu, isu global hari ini lebih digerakkan fakta lapangan atau orkestrasi narasi?',
    slot3: 'Timing berita menurutmu kebetulan statistik atau pola yang berulang?',
    slot4: 'AI untuk pertahanan itu kebutuhan realistis atau pintu risiko etis jangka panjang?',
    slot5: 'Buat kamu pribadi, filter paling efektif biar nggak kebawa framing itu apa?'
  };

  const i = dayIndexWIB() % hooks.length;
  const base = `${hooks[i]} ${angles[slotLabel] || angles.slot5}`;
  return `${base}`.slice(0, 500);
}

(async () => {
  const draftsPath = path.join(root, 'content', 'daily-geopolitik-drafts.json');
  const logPath = path.join(root, 'logs', 'post-draft-slot.log');
  const postedSlotsPath = path.join(root, 'state', 'posted-slots.json');
  const historyPath = path.join(root, 'state', 'posted-content-history.json');

  const raw = await fs.readFile(draftsPath, 'utf-8');
  const cfg = JSON.parse(raw);
  const slot = cfg.slots.find(s => s.label === slotArg);
  if (!slot) throw new Error(`Slot not found: ${slotArg}`);

  const dateKey = getDateKeyWIB();

  // Load posted-slots state
  let slotState = { byDate: {} };
  try {
    slotState = JSON.parse(await fs.readFile(postedSlotsPath, 'utf-8'));
  } catch {}
  if (!slotState.byDate[dateKey]) slotState.byDate[dateKey] = { postedSlots: [] };

  // Skip if slot already posted today
  if (slotState.byDate[dateKey].postedSlots.includes(slotArg)) {
    const line = `${new Date().toISOString()} ${slotArg} SKIP already-posted date=${dateKey}\n`;
    await fs.appendFile(logPath, line);
    process.stdout.write(line);
    process.exit(0);
  }

  // Load history state
  let history = { entries: [] };
  try {
    history = JSON.parse(await fs.readFile(historyPath, 'utf-8'));
  } catch {}

  const initialText = String(slot.text || '').slice(0, 500);
  const initialHash = hashText(initialText);
  const duplicateFound = (history.entries || []).some(e => e.hash === initialHash);

  // If duplicate content found in history, auto-generate a fallback non-duplicate variant.
  let text = initialText;
  let textHash = initialHash;
  let source = 'slot';

  if (duplicateFound) {
    const candidate = makeFallback(slotArg, dateKey);
    const candidateHash = hashText(candidate);
    const candidateDup = (history.entries || []).some(e => e.hash === candidateHash);

    if (!candidateDup) {
      text = candidate;
      textHash = candidateHash;
      source = 'fallback-generated';
    } else {
      // Last resort: include slot+date+hour marker to force uniqueness while keeping context.
      const marker = new Date().toISOString().slice(11, 16);
      text = `${candidate} • ${slotArg.toUpperCase()} ${marker}`.slice(0, 500);
      textHash = hashText(text);
      source = 'fallback-generated-marker';
    }
  }

  const client = new ReplizClient();
  const init = await client.init();
  if (!init.ok) throw new Error(`Init failed: ${init.error || 'unknown'}`);

  const res = await client.createPost(text);

  // Mark slot + history only if accepted by API
  if (res?.ok) {
    slotState.byDate[dateKey].postedSlots.push(slotArg);

    history.entries = history.entries || [];
    history.entries.push({
      date: dateKey,
      slot: slotArg,
      hash: textHash,
      source,
      postId: res?.postId || null,
      createdAt: new Date().toISOString(),
      preview: text.slice(0, 120)
    });

    // Keep history bounded
    history.entries = history.entries.slice(-500);

    await fs.mkdir(path.join(root, 'state'), { recursive: true });
    await fs.writeFile(postedSlotsPath, JSON.stringify(slotState, null, 2));
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
  }

  const line = `${new Date().toISOString()} ${slotArg} len=${text.length} ok=${!!res?.ok} id=${res?.postId || '-'} status=${res?.raw?.status || res?.status || '-'} date=${dateKey} source=${source} duplicateGuard=${duplicateFound}\n`;
  await fs.appendFile(logPath, line);
  process.stdout.write(line);
})();
