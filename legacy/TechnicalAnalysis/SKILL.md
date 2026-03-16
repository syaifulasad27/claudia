---
name: TechnicalAnalysis
description: Compute precise technical indicators (EMA, ATR, RSI, MACD, Bollinger Bands, Pivot Points, Fibonacci) and multi-timeframe confluence scores from Bridge API OHLCV data. Use before any trading decision to obtain exact numerical analysis instead of relying on LLM interpretation of raw candle data.
---

# TechnicalAnalysis

Compute indicators and generate confluence scores for trading decisions.

## Workflow

1. Run `scripts/compute-indicators.js` with Bridge API URL, symbol, and timeframe to calculate all indicators.
2. Run `scripts/compute-confluence.js` with Bridge API URL and symbol to compute multi-timeframe confluence score across D1/H4/H1/M15.
3. Run `scripts/detect-levels.js` with Bridge API URL and symbol to identify support/resistance levels.

## Commands

```bash
# Compute indicators for a single timeframe
node TechnicalAnalysis/scripts/compute-indicators.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD --timeframe H1 --bars 200

# Compute multi-timeframe confluence score
node TechnicalAnalysis/scripts/compute-confluence.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD

# Detect support/resistance levels
node TechnicalAnalysis/scripts/detect-levels.js --url $BRIDGE_BASE_URL --key $API_KEY --symbol XAUUSD
```

## Outputs

- `state/indicators-{SYMBOL}-{TF}.json` — All indicator values for a specific timeframe
- `state/confluence-{SYMBOL}.json` — Multi-TF confluence score with signal breakdown
- `state/levels-{SYMBOL}.json` — Support/resistance levels with strength ratings

## Indicator Reference

| Indicator | Params | Trading Use |
|-----------|--------|-------------|
| EMA 20/50/200 | periods: 20, 50, 200 | Trend direction, entry zones, golden/death cross |
| ATR 14 | period: 14 | Volatility, SL sizing (× 1.5) |
| RSI 14 | period: 14 | Overbought (>70) / oversold (<30) filter |
| MACD | fast: 12, slow: 26, signal: 9 | Momentum confirmation, divergence |
| Bollinger Bands | period: 20, stddev: 2 | Volatility regime, squeeze detection |
| Pivot Points | type: Standard (daily) | Intraday S/R levels |
| Fibonacci | auto from swing high/low | Pullback zones (38.2%, 50%, 61.8%) |

## Confluence Score Interpretation

| Score | Confidence | Action |
|-------|-----------|--------|
| ≥ 8 | HIGH | Full position size |
| 5–7 | MEDIUM | 50% position size |
| < 5 | LOW | NO TRADE |

## Notes

- Parameters are configurable in `references/indicator-params.json`
- Confluence weights are adjustable in `references/confluence-weights.json`
- Keep `state/*.json` out of git
