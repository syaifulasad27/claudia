#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const queueFile = path.join(root, 'repliz-client', 'content', 'scheduled', 'queue.json');
const draftDir = path.join(root, 'memory', 'content-drafts');
const queue = await readJson(queueFile, { queue: [] });
const files = (await fs.readdir(draftDir)).filter((file) => file.endsWith('.json')).sort();
const latest = files.at(-1);
let scheduled = false;
if (latest) {
  const content = await readJson(path.join(draftDir, latest), null);
  if (content) {
    queue.queue = queue.queue || [];
    queue.queue.push({
      id: content.id,
      type: 'text',
      description: `${content.hook || content.theme}. ${content.body} ${content.cta}`,
      scheduleAt: new Date(Date.now() + 30 * 60000).toISOString(),
      status: 'pending',
    });
    await writeJson(queueFile, queue);
    scheduled = true;
  }
}
console.log(JSON.stringify({ ok: true, scheduled }, null, 2));

