---
name: smart-search
description: Urgent-only web intelligence retrieval for trading/investment decisions using Brave and Tavily with strict quota governance (Brave 25/day, Tavily 25/day, total 50/day, monthly 1000 each). Use when immediate external confirmation is needed before/around high-impact market decisions.
---

# smart-search

Use this skill only for urgent, actionable information gaps.

## Policy

- Daily caps: Brave 25, Tavily 25, Total 50 (WIB)
- Monthly caps: Brave 1000, Tavily 1000
- Block routine/non-urgent usage

## Commands

```bash
node smart-search/scripts/smart-search.js --query "latest fed surprise and gold impact" --urgent --need-confirmation
```

Optional:

```bash
node smart-search/scripts/smart-search.js --query "iran escalation update xauusd" --urgent --provider brave
node smart-search/scripts/smart-search.js --query "ecb statement market impact" --urgent --provider tavily
```

## Outputs

- `smart-search/state/usage.json` — quota counters
- `smart-search/state/search-log.jsonl` — audit trail
- `smart-search/state/latest-result.json` — latest merged search result
- `smart-search/references/urgency-rules.json` — automatic urgency scoring rules
