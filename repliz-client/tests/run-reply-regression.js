#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeWithContext, generateContextualReply, relevanceScore } from '../scripts/smart-reply-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function includesAny(text, needles = []) {
  const t = String(text || '').toLowerCase();
  return needles.some(n => t.includes(String(n).toLowerCase()));
}

async function main() {
  const casesPath = path.join(__dirname, 'reply-regression-cases.json');
  const reportPath = path.join(__dirname, '..', 'reports', 'reply-regression-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const cases = JSON.parse(await fs.readFile(casesPath, 'utf-8'));
  const results = [];
  let pass = 0;

  for (const c of cases) {
    const analysis = analyzeWithContext(c.comment, c.post);
    const reply = generateContextualReply(analysis, c.comment, c.post, 'tester');
    const rel = relevanceScore(c.comment, c.post, reply);

    const hasMust = includesAny(reply, c.mustIncludeAny || []);
    const hasForbidden = includesAny(reply, c.mustNotIncludeAny || []);

    const ok = hasMust && !hasForbidden;
    if (ok) pass++;

    results.push({
      name: c.name,
      ok,
      relevance: rel,
      analysis,
      reply,
      checks: {
        hasMust,
        hasForbidden
      }
    });
  }

  const summary = {
    total: cases.length,
    pass,
    fail: cases.length - pass,
    passRate: Number((pass / cases.length * 100).toFixed(2)),
    generatedAt: new Date().toISOString()
  };

  const payload = { summary, results };
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  if (summary.fail > 0) process.exitCode = 2;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
