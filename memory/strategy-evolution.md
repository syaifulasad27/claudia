# Strategy Evolution Log

## 2026-03-01 — Initialization
- **Change:** Baseline strategy framework initialized.
- **Why:** Workspace first-run bootstrap.
- **Data Support:** N/A (initial state).
- **Result:** Pending real trading sessions.

---

## 2026-03-03 — Post-Trade #001 System Overhaul (MAJOR)
- **Change:** Complete parameter adjustment and entry rule restructuring setelah loss Trade #001.
- **Why:** Entry FOMO, SL terlalu ketat untuk volatilitas, dan posisi non-system tanpa SL terdeteksi.
- **Data Support:** Trade #001 loss -$471 (0.47% equity), SL hit karena 27 pips vs ATR14 29 pips.
- **Result:** Sistem baru diimplementasikan — lebih defensif, ATR-based, dengan pre-trade timeout.

### Parameter Changes (Implemented)

| Parameter | Sebelum | Sesudah | Alasan |
|-----------|---------|---------|--------|
| Max risk/trade | 1% | **0.75%** | Buffer lebih aman |
| SL calculation | Fixed 25-30 pips | **1.5 × ATR14** | Dinamis sesuai volatilitas |
| Entry type | Market order | **Limit order di EMA20** | Better R:R, anti-FOMO |
| Entry timing | Immediate | **15-30 min delay** | Konfirmasi pullback |
| RR minimum | 1:1.8 | **1:2.0** | Expected value positif |
| Position validation | None | **Claudia-* prefix check** | Hanya manage posisi sistem |
| Bootstrap risk | 0.5x (0.5%) | **Tetap 0.5x** | Valid, perlu disiplin |
| Max concurrent | 1 | **Tetap 1** | Fokus |

### New Entry Rules (SEMI-AUTO CHECKLIST — Semua Harus YES)

```
□ Price < 0.5 ATR dari EMA20 H1 (tidak extended)
□ Momentum candle H1/M15 bullish (close > open)
□ Volume/spread normal (< 2x average)
□ Tidak dalam 30 menit pre-news high-impact
□ Risk/Reward minimal 1:2 (bukan 1:1.8)
□ ATR14 × 1.5 = minimum SL distance
```

### Dynamic SL Formula

```
SL_distance = ATR14 × 1.5
Size = (0.75% × Equity) / (SL_distance × Pip_Value)

Example XAUUSD:
- ATR14 H1 = 30 pips
- SL minimum = 45 pips
- Jika SL terlalu jauh → kurangi size, bukan SL
```

### Position Source Validation (NEW)

Sebelum manage posisi:
1. Cek `comment` field dari `/positions`
2. Hanya proses posisi dengan prefix `Claudia-*`
3. Posisi tanpa prefix = manual user → tidak di-intervensi
4. Posisi tanpa SL → alert critical ke Tuan

### Pre-Trade Timeout (NEW)

```
1. Detect Setup
↓
2. Wait 15-30 min (konfirmasi candle M15)
↓
3. Check: Extended? (close > 0.5 ATR dari EMA20?)
├─ YES → Skip, tunggu pullback
└─ NO → Proceed
↓
4. Calculate: Size = (0.75% equity) / (1.5x ATR)
↓
5. Place LIMIT order di EMA20, bukan market
↓
6. Monitor dengan cron 1-menit
```
