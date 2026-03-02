# Trading Configuration — Claudia System v2.0

*Implemented: 2026-03-03 setelah Post-Trade #001 Overhaul*

---

## Risk Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max Risk per Trade | **0.75%** equity | Turun dari 1% untuk buffer lebih aman |
| Bootstrap Risk (2-trade) | **0.375%** equity | 0.5x dari max risk untuk sesi pertama |
| Max Concurrent Positions | **1** | Fokus single pair (XAUUSD) |
| Max Drawdown Limit | **20%** | Hard stop — lapor ke Tuan |
| Absolute Max Drawdown | **50%** | Emergency stop — tidak boleh dilewati |

---

## Entry Rules (SEMI-AUTO CHECKLIST)

Semua kriteria HARUS terpenuhi (YES) sebelum entry:

```
□ [ ] Price < 0.5 ATR dari EMA20 H1 (tidak extended/parabolic)
□ [ ] Momentum candle H1/M15 sesuai direction (close > open untuk BUY)
□ [ ] Volume/spread normal (< 2x average spread)
□ [ ] Tidak dalam 30 menit pre-news high-impact
□ [ ] Risk/Reward minimum 1:2.0 (bukan 1:1.8)
□ [ ] ATR14 × 1.5 = minimum SL distance (dihitung otomatis)
□ [ ] Pre-trade timeout 15-30 menit sudah dilewati
```

---

## Dynamic Stop Loss Formula

```
SL_distance_pips = ATR14(H1) × 1.5

Position_Size = (Equity × 0.0075) / (SL_distance_pips × Pip_Value)

Contoh XAUUSD:
- Equity: $100,000
- ATR14 H1: 30 pips
- SL minimum: 45 pips
- Pip value: $1 per 0.01 lot
- Size: ($100,000 × 0.0075) / (45 × $1) = 0.16 lot
```

**Rule:** Jika SL terlalu jauh → **kurangi size**, bukan SL distance.

---

## Entry Methodology

### Workflow Baru (v2.0)

```
1. DETECT → Setup terdeteksi oleh analisis multi-timeframe
         ↓
2. WAIT → Delay 15-30 menit (1-2 candle M15 konfirmasi)
         ↓
3. CHECK → Apakah price extended? (close > 0.5 ATR dari EMA20?)
      ├─ YES → SKIP, tunggu pullback ke zona EMA20
      └─ NO  → PROCEED
         ↓
4. CALCULATE → Size = (0.75% × Equity) / (1.5 × ATR)
         ↓
5. PLACE → LIMIT order di EMA20 (bukan market order)
         ↓
6. MONITOR → Cron 1-menit untuk management posisi
```

### Entry Zone Prioritas

1. **Primary:** Limit order di EMA20 H1 (pullback zone)
2. **Secondary:** Limit order di EMA50 H1 (deep pullback)
3. **Avoid:** Market order saat price extended

---

## Position Management

### Source Validation (CRITICAL)

```python
# Pseudocode untuk validasi posisi
for position in positions:
    if not position.comment.startswith("Claudia-"):
        SKIP — ini posisi manual user, tidak di-manage
    if position.sl == 0:
        ALERT CRITICAL — posisi tanpa SL, lapor ke Tuan
```

### SL/TP Modification

- **Endpoint:** `PATCH /order/{ticket}`
- **Fallback:** Jika modify gagal → `CLOSE` posisi + `OPEN` baru dengan SL/TP benar
- **Rule:** Tidak boleh ada posisi terbuka tanpa SL lebih dari 1 menit

---

## Pair Focus

| Pair | Priority | Max Spread | Notes |
|------|----------|------------|-------|
| **XAUUSD** | 🥇 PRIMARY | 20 pips | Fokus utama, semua parameter di-optimasi untuk XAUUSD |
| EURUSD | 🥈 OPTIONAL | 5 pips | Hanya jika setup jelas |
| GBPUSD | 🥈 OPTIONAL | 8 pips | Hanya jika setup jelas |
| US100 | 🥈 OPTIONAL | 15 pips | Hanya jika setup jelas |

---

## News Filter

### High-Impact Events (Avoid 30 menit before/after)

- NFP (Non-Farm Payrolls)
- CPI (Consumer Price Index)
- FOMC Rate Decision & Press Conference
- ECB Rate Decision
- GDP releases
- Geopolitical crisis (case-by-case)

### Check Frequency

- Economic calendar: Setiap 1 jam via cron
- Breaking news: Real-time monitoring jika posisi terbuka

---

## Communication Protocol

### Wajib Lapor Ke Tuan

- ✅ Trade baru dibuka (dengan detail lengkap)
- ✅ Trade ditutup (hasil P/L exact)
- ✅ Alert kritis: posisi tanpa SL, drawdown >10%
- ✅ Masalah koneksi Bridge API (Kill Switch)

### Jangan Ganggu (Kecuali Diminta)

- ❌ Floating P/L setiap menit
- ❌ Update minor tanpa actionable insight
- ❌ Analisis yang belum matang

### Jam Tenang (23:00-07:00 WIB)

- Suppress routine notifications
- Kecuali: posisi dalam bahaya, koneksi lost, atau alert kritis

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-01 | Initial baseline |
| **v2.0** | **2026-03-03** | **Post-Trade #001 overhaul: ATR-based SL, pre-trade timeout, entry rules, position validation** |

---

## References

- `memory/trade-journal.md` — Log semua trade
- `memory/strategy-evolution.md` — Evolusi strategi
- `memory/mistake-prevention.md` — Aturan pencegahan kesalahan
- `TOOLS.md` — Bridge API reference
