---
name: MarketIntelligence
description: Collect macro market intelligence using low-cost sources first (ForexFactory calendar + Yahoo Finance RSS), score impact for XAUUSD and NASDAQ, and use Brave Search only as a capped fallback (max 1 request per hour). Use when user asks for economic calendar checks, macro/geopolitical news scans, or scheduled market briefing summaries.
---

# MarketIntelligence

Run scripts from this skill to collect and summarize economic and macro headlines with strict source/cost controls.

## Workflow

1. Run `scripts/fetch-intel.js` to pull data from free sources and normalize output.
2. Run `scripts/analyze-intel.js` to deduplicate, score impact, and create a concise briefing.
3. Only use Brave fallback when:
   - free sources fail, or
   - high-impact event needs confirmation.
4. Never exceed one Brave request per hour (`state/brave-usage.json`).

## Commands

```bash
node MarketIntelligence/scripts/fetch-intel.js
node MarketIntelligence/scripts/analyze-intel.js
node MarketIntelligence/scripts/run-cycle.js --write-memory ./memory/macro-insights.md
```

Optional flags:

```bash
node MarketIntelligence/scripts/fetch-intel.js --use-brave --brave-query "fed rate outlook"
node MarketIntelligence/scripts/analyze-intel.js --write-memory ./memory/macro-insights.md
```

## Outputs

- `state/raw-intel.json` — normalized raw events/headlines
- `state/latest-briefing.json` — structured scored output
- `state/latest-briefing.md` — human-readable summary
- `state/ops-alert.txt` — ops escalation alert when feed degraded repeatedly
- `references/cron-template.json` — ready template for hourly scheduling
- `references/quiet-mode.md` — detailed weekend/quiet-hour notification policy
- `references/alert-thresholds.json` — numeric threshold + Telegram alert template
- `references/daily-digest-template.json` — weekday morning digest cron template (WIB)

## Notes

- Keep `state/*.json` out of git.
- Keep long-term learnings in `memory/macro-insights.md`.
