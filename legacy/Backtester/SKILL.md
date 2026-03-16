---
name: Backtester
description: Simulate trading strategies on historical OHLCV data before going live. Tests entry/exit rules, calculates win rate, max drawdown, profit factor, and Sharpe ratio. Run parameter sweeps to find optimal indicator settings.
---

# Backtester

Test strategy performance on historical data before risking real capital.

## Workflow

1. Run `scripts/run-backtest.js` with strategy parameters to simulate trades on historical data.
2. Run `scripts/optimize-params.js` to sweep parameter ranges and find optimal settings.

## Commands

```bash
# Run backtest with default strategy
node Backtester/scripts/run-backtest.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD --days 30

# Run backtest with custom parameters
node Backtester/scripts/run-backtest.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD --days 60 \
  --ema-fast 20 --ema-slow 50 --atr-mult 1.5 --rr 2.0

# Parameter optimization
node Backtester/scripts/optimize-params.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD --days 30
```

## Outputs

- `state/backtest-result.json` — Detailed backtest metrics
- `state/backtest-trades.json` — Individual simulated trade list
- `state/optimization-result.json` — Parameter sweep results ranked by Sharpe

## Metrics Calculated

| Metric | Description |
|--------|-------------|
| Win Rate | % of profitable trades |
| Profit Factor | Gross wins / Gross losses |
| Max Drawdown | Largest peak-to-trough decline |
| Sharpe Ratio | Risk-adjusted return |
| Avg RR | Average risk/reward achieved |
| Expectancy | Average profit per trade |

## Notes

- Uses same indicator math as TechnicalAnalysis skill
- Historical data limited by Bridge API `/market-data` bar count (max 10,000)
- Results are indicative — past performance ≠ future results
- Default strategy params in `references/default-strategy.json`
