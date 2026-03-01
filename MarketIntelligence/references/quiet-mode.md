# Weekend / Quiet Mode Rules

## Objectives
- Avoid spam.
- Preserve only actionable alerts.
- Keep market context available without noisy push messages.

## Timezone
- Primary timezone for decisioning: **Asia/Jakarta (WIB, UTC+7)**.

## Quiet Hours (Daily)
- Quiet window: **23:00–07:00 WIB**.
- During quiet hours:
  - Run collection/analysis as usual.
  - **Do not push routine briefings**.
  - Push only if **critical** condition is met.

## Weekend Rules
- Weekend window: **Saturday 00:00 WIB → Sunday 23:59 WIB**.
- During weekend:
  - Run hourly cycle for continuity/logging.
  - Suppress routine push updates.
  - Push only if one of the following is true:
    1. Market anomaly/unscheduled shock with potential open-gap risk,
    2. Tuan explicitly requests live monitoring,
    3. There are open positions requiring risk attention.

## Notification Levels

### Level 0 — Silent Log Only
- Trigger: no high-impact item.
- Action: write to `memory/macro-insights.md` only.

### Level 1 — Deferred Summary
- Trigger: medium/high-impact exists, but inside quiet/weekend and not critical.
- Action: store summary internally; send on next active window (>=07:00 WIB weekday).

### Level 2 — Immediate Alert
- Trigger (any):
  - high-impact + strong cross-source confirmation,
  - geopolitical shock likely to affect XAUUSD/NASDAQ,
  - open position risk event.
- Action: send concise alert immediately.

## Brave Usage Control
- Hard cap: **max 1 Brave request per hour**.
- Hard cap daily: **max 32 Brave requests per day (WIB)**.
- Use Brave only if:
  - free feeds fail, or
  - a high-impact item needs confirmation.
- If cap reached, fallback to free feeds and tag confidence lower.

## Message Format (if alert needed)
- Event
- Why it matters
- Affected assets: XAUUSD / NASDAQ
- Bias: bullish / bearish / neutral
- Action: monitor / wait / caution
