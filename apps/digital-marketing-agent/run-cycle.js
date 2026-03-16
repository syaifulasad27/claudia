#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, releaseLock } from '../../packages/core/lock-manager.js';
import { createLogger } from '../../packages/core/logger.js';
import { readJson, writeJson } from '../../packages/core/state-manager.js';
import { analyzeTrends } from '../../packages/ai/trend-analyst.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const log = createLogger('digital-marketing-agent');
const stateDir = path.join(root, 'apps', 'digital-marketing-agent', 'state');
const lockFile = path.join(stateDir, 'run-cycle.lock.json');

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { cwd: root, stdio: 'inherit' });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${script} failed with ${code}`)));
  });
}

const lock = await acquireLock(lockFile, 10 * 60 * 1000);
if (!lock.ok) {
  console.log(JSON.stringify({ ok: false, reason: 'lock_active' }, null, 2));
  process.exit(0);
}

const steps = [];
try {
  await log.info('observe:start');
  await run('MarketingIntelligence/scripts/run-cycle.js');
  steps.push('marketing_intelligence');
  await run('AudienceIntelligence/scripts/run-cycle.js');
  steps.push('audience_intelligence');
  await run('ContentPerformanceAnalysis/scripts/run-cycle.js');
  steps.push('content_performance_analysis');

  await log.info('reason:start');
  await run('AgentPlanner/scripts/evaluate-goals.js');
  await run('AgentPlanner/scripts/select-cycle-strategy.js');
  await run('AgentPlanner/scripts/prioritize-actions.js');
  steps.push('agent_planner');

  const marketingInsights = await readJson(path.join(root, 'memory', 'marketing-insights.json'), { insights: [] });
  const audienceSignals = await readJson(path.join(root, 'memory', 'audience-signals.json'), {});
  const contentPerformance = await readJson(path.join(root, 'memory', 'content-performance.json'), {});
  const reasoning = analyzeTrends({
    insights: marketingInsights.insights || [],
    audienceSignals,
    contentPerformance,
  });
  await writeJson(path.join(stateDir, 'reasoning-output.json'), { generatedAt: new Date().toISOString(), reasoning });
  steps.push('trend_analyst');

  await log.info('act:start');
  await run('ContentEngine/scripts/generate-post.js');
  await run('ContentEngine/scripts/generate-carousel.js');
  await run('ContentEngine/scripts/generate-sales-copy.js');
  await run('ContentEngine/scripts/schedule-post.js');
  steps.push('content_engine');
  await run('repliz-client/scripts/comment-fetcher.js');
  await run('SalesManager/scripts/detect-leads.js');
  await run('SalesManager/scripts/update-funnel-stage.js');
  await run('SalesManager/scripts/suggest-followup.js');
  await run('SalesManager/scripts/update-sales-stats.js');
  await run('repliz-client/scripts/smart-reply-generator.js');
  await run('repliz-client/scripts/notify-tuan.js');
  await run('repliz-client/scripts/approval-handler.js');
  steps.push('social_sales_pipeline');

  await log.info('learn:start');
  await run('ContentLearning/scripts/analyze-post-performance.js');
  await run('ContentLearning/scripts/update-content-strategy.js');
  await run('ContentExperimentEngine/scripts/run-hook-test.js');
  await run('ContentExperimentEngine/scripts/run-cta-test.js');
  await run('ContentExperimentEngine/scripts/compare-posting-times.js');
  await run('ContentExperimentEngine/scripts/compare-content-formats.js');
  steps.push('learning_loop');

  const currentPlan = await readJson(path.join(stateDir, 'current-plan.json'), {});
  const latestRun = {
    generatedAt: new Date().toISOString(),
    phases: {
      observe: ['marketing_intelligence', 'audience_intelligence', 'content_performance_analysis'],
      reason: ['agent_planner', 'trend_analyst'],
      act: ['content_engine', 'social_sales_pipeline'],
      learn: ['learning_loop'],
    },
    steps,
    currentPlan,
    reasoning,
  };
  await writeJson(path.join(stateDir, 'latest-run.json'), latestRun);
  await log.info('run-cycle complete', { steps: steps.length });
  console.log(JSON.stringify({ ok: true, steps }, null, 2));
} finally {
  await releaseLock(lockFile);
}

