# Sources

## Free Primary Sources

1. **ForexFactory calendar XML**
   - `https://nfs.faireconomy.media/ff_calendar_thisweek.xml`
   - Economic events with date/time, currency, impact, forecast/previous/actual (when available).

2. **Yahoo Finance RSS (macro focus)**
   - Gold + Nasdaq headlines:
   - `https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,^IXIC&region=US&lang=en-US`

## Optional Free Fallbacks (now active automatically)

- `https://www.fxstreet.com/rss/news`
- `https://www.investing.com/rss/news.rss`

Failover order for macro headlines:
1. Yahoo Finance RSS
2. FXStreet RSS
3. Investing RSS

## Paid Fallback (Strictly Limited)

- Brave Search API: max **1 request/hour** via throttle file `state/brave-usage.json`.
