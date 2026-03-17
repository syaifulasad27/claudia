#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { GROWTH_TARGETS } from '../../packages/core/growth-recovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = path.join(root, 'memory', 'repliz-social-state', 'outreach-engine.json');
const existing = await readJson(file, { history: [] });
const today = new Date().toISOString().slice(0, 10);
const todayState = existing.history.find((entry) => entry.date === today) || {
  date: today,
  targetRelevantPosts: GROWTH_TARGETS.dailyRelevantPosts,
  targetReplies: GROWTH_TARGETS.dailyOutreachMinimum,
  executedReplies: 0,
  monitoredWindows: ['12:30 WIB', '19:00 WIB'],
  sourceClusters: ['AI automation', 'digital marketing', 'career advice'],
  rules: {
    postAgeHoursMax: 24,
    requireVisibleDiscussion: true,
    requireTopicMatch: true,
  },
  templateClasses: {
    problemReframer: 'Bukan cuma soal tools. Biasanya bottleneck-nya ada di workflow yang masih manual.',
    practicalAddOn: 'Kalau mau hasil lebih cepat, pecah jadi 3 step: trigger, action, follow-up.',
    questionReply: 'Kalau harus pilih satu bottleneck dulu, yang paling bikin lambat sekarang apa: content, leads, atau follow-up?',
    softBridge: 'Saya baru breakdown ini di post terakhir saya, inti masalahnya justru ada di proses sebelum AI dipakai.',
  },
};

existing.generatedAt = new Date().toISOString();
existing.current = todayState;
existing.history = [
  todayState,
  ...(existing.history || []).filter((entry) => entry.date !== today).slice(0, 6),
];

await writeJson(file, existing);
console.log(JSON.stringify({ ok: true, date: today, targetReplies: todayState.targetReplies }, null, 2));
