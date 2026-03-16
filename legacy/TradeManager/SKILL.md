---
name: TradeManager
description: Automated active trade management — trailing stop, break-even, partial close, risk monitoring, and performance statistics auto-update. Designed to run on a 1-minute cron during active trading sessions.
---

# TradeManager

Automated position management and risk monitoring for active trades.

## Workflow

1. Run `scripts/manage-positions.js` on a 1-minute cron when positions are open to auto-trail SL, move to break-even, and execute partial closes.
2. Run `scripts/check-risk.js` before entering new trades to verify daily/weekly/consecutive loss limits.
3. Run `scripts/update-stats.js` after trades close to auto-update `memory/performance-stats.md`.

## Commands

```bash
# Active position management (trailing stop, BE, partial close)
node TradeManager/scripts/manage-positions.js --url $BRIDGE_BASE_URL --key $API_KEY

# Risk limit check (before opening new trades)
node TradeManager/scripts/check-risk.js --url $BRIDGE_BASE_URL --key $API_KEY

# Update performance statistics from order history
node TradeManager/scripts/update-stats.js --url $BRIDGE_BASE_URL --key $API_KEY --memory-path ./memory
```

## Outputs

- `state/management-log.json` — Trail/BE/partial close actions log
- `state/risk-status.json` — Current risk limit status
- Updates `memory/performance-stats.md` in-place

## Position Management Rules

| Condition | Action |
|-----------|--------|
| Profit ≥ 1× risk | Move SL to break-even |
| Profit ≥ 1.5× risk | Trail SL to 0.5× risk profit above entry |
| Profit ≥ 2× risk | Trail SL to 1× risk profit above entry |
| Profit ≥ 2.5× risk | Partial close 50% + trail rest |
| > 4 hrs, RR < 1:1 | Evaluate close |

## Risk Limits (from references/risk-limits.json)

| Limit | Value |
|-------|-------|
| Daily loss | 5% equity |
| Consecutive losses | 3 → 24hr cooldown |
| Weekly loss | 10% → stop until review |

## Notes

- Only manages positions with `Claudia-*` comment prefix
- Requires Bridge API v2.0 endpoints
- Reference configs are adjustable in `references/`
