# Trading Configuration — Claudia System v3.0

*Implemented: 2026-03-03 — Bridge API v2.0 Integration + Active Trade Management*

---

## Risk Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max Risk per Trade | **0.75%** equity | Turun dari 1% untuk buffer lebih aman |
| Bootstrap Risk (2-trade) | **0.375%** equity | 0.5x dari max risk untuk sesi pertama |
| Max Concurrent Positions | **1** | Fokus single pair (XAUUSD) |
| Max Drawdown Limit | **20%** | Hard stop — lapor ke Tuan |
| Absolute Max Drawdown | **50%** | Emergency stop — tidak boleh dilewati |
| Daily Loss Limit | **5%** equity | Stop trading hari itu jika tercapai |
| Consecutive Loss Limit | **3 trades** | Mandatory cooldown 24 jam |

---

## Entry Rules (v3.0 CHECKLIST)

Semua kriteria HARUS terpenuhi (YES) sebelum entry:

```
□ [ ] Price < 0.5 ATR dari EMA20 H1 (tidak extended/parabolic)
□ [ ] Momentum candle H1/M15 sesuai direction (close > open untuk BUY)
□ [ ] Volume/spread normal (< 2x average spread)
□ [ ] Tidak dalam 30 menit pre-news high-impact
□ [ ] Risk/Reward minimum 1:2.0 (bukan 1:1.8)
□ [ ] ATR14 × 1.5 = minimum SL distance (dihitung otomatis)
□ [ ] Pre-trade timeout 15-30 menit sudah dilewati
□ [ ] Session filter: dalam window optimal (lihat Session Rules)
□ [ ] Cek /symbol-info/{symbol} untuk pip size, min volume, spread terkini
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

## Entry Methodology (v3.0)

### Workflow Baru — Limit Order via Bridge API

```
1. DETECT → Setup terdeteksi oleh analisis multi-timeframe
         ↓
2. WAIT → Delay 15-30 menit (1-2 candle M15 konfirmasi)
         ↓
3. CHECK → Apakah price extended? (close > 0.5 ATR dari EMA20?)
      ├─ YES → SKIP, tunggu pullback ke zona EMA20
      └─ NO  → PROCEED
         ↓
4. SYMBOL INFO → GET /symbol-info/XAUUSD
   └── Ambil: point, digits, pip value, spread terkini, volume constraints
         ↓
5. CALCULATE → Size = (0.75% × Equity) / (1.5 × ATR × pip_value)
         ↓
6. PLACE → POST /order/pending (BUY_LIMIT di EMA20 H1)
   └── Jika EMA20 terlalu dekat → gunakan market order POST /order
         ↓
7. MONITOR → Cron 1-menit untuk management posisi
         ↓
8. MANAGE → Active trade management (lihat Trade Management Rules)
```

### Entry Zone Prioritas

1. **Primary:** Limit order di EMA20 H1 via `POST /order/pending` (BUY_LIMIT/SELL_LIMIT)
2. **Secondary:** Limit order di EMA50 H1 (deep pullback)
3. **Fallback:** Market order via `POST /order` saat EMA20 < 5 pips dari current price
4. **Avoid:** Market order saat price extended

---

## Session / Time Filter Rules (BARU v3.0)

### Optimal Trading Windows (WIB)

| Session | WIB Time | XAUUSD Activity | Trade Allowed |
|---------|----------|-----------------|---------------|
| Asian (Tokyo) | 06:00–09:00 | LOW | ⚠️ Hanya jika ada setup kuat |
| Asian-London Gap | 09:00–14:00 | LOW-MEDIUM | ⚠️ Monitor only |
| **London Open** | **14:00–17:00** | **HIGH** | ✅ **PRIMARY WINDOW** |
| **London-NY Overlap** | **19:30–23:00** | **HIGHEST** | ✅ **BEST WINDOW** |
| NY Afternoon | 23:00–01:00 | MEDIUM | ⚠️ Reduce size 50% |
| Off-Hours | 01:00–06:00 | VERY LOW | ❌ NO NEW TRADES |

### Session Rules

1. **Primary trading:** London Open (14:00-17:00 WIB) + London-NY Overlap (19:30-23:00 WIB)
2. **NO new trades** di off-hours (01:00-06:00 WIB) kecuali posisi sudah terbuka
3. **Reduce size 50%** jika entry di luar primary window
4. **XAUUSD** paling volatile saat London dan NY session → fokus di sini
5. **Weekend:** TIDAK trading dari Sabtu 04:00 WIB sampai Senin 06:00 WIB

---

## Active Trade Management Rules (BARU v3.0)

### Trailing Stop & Break-Even Protocol

Setelah trade dibuka, Claudia WAJIB mengelola SL secara aktif menggunakan `PATCH /order/{ticket}`:

| Kondisi | Aksi | Endpoint |
|---------|------|----------|
| Profit ≥ 1× risk amount | Move SL ke **break-even** (entry price + 2 pips) | `PATCH /order/{ticket}` |
| Profit ≥ 1.5× risk amount | Trail SL ke **0.5× risk profit** di atas entry | `PATCH /order/{ticket}` |
| Profit ≥ 2× risk amount | Trail SL ke **1× risk profit** di atas entry | `PATCH /order/{ticket}` |
| Profit ≥ 2.5× risk amount | Consider **partial close 50%** + trail rest | `POST /close/partial` + `PATCH /order/{ticket}` |
| Time > 4 jam tanpa progress | Evaluate close jika R:R saat ini < 1:1 | `POST /close` |
| News high-impact dalam 15 min | Tighten SL ke break-even ATAU close | `PATCH /order/{ticket}` atau `POST /close` |
| Spread > 2× normal | Alert, evaluate close jika floating loss | Monitor |

### Trailing SL Formula

```
Saat profit ≥ 1× risk:
  new_SL = entry_price + (2 × point)  // break-even + buffer

Saat profit ≥ 1.5× risk:
  new_SL = entry_price + (0.5 × original_risk_distance)

Saat profit ≥ 2× risk:
  new_SL = entry_price + (1.0 × original_risk_distance)
```

### Partial Close Strategy

```
Saat profit ≥ 2.5× risk DAN position size ≥ 0.02 lot:
  1. POST /close/partial → close 50% volume
  2. PATCH /order/{ticket} → trail SL sisa ke 1× risk profit
  3. Biarkan sisa running menuju TP
```

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

### Pending Order Management

- **List pending:** `GET /orders/pending`
- **Cancel:** `DELETE /order/pending/{ticket}`
- **Rule:** Cancel pending order jika setup sudah tidak valid setelah 2 jam

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

## Kill Switch Enhancement (v3.0)

| Condition | Action |
|-----------|--------|
| Equity drop > 5% dalam 1 hari | STOP trading hari itu |
| 3 consecutive losses | Mandatory cooldown 24 jam |
| Weekly loss > 10% | STOP sampai Tuan review |
| API disconnected + posisi terbuka | Kill Switch Protocol (AGENTS.md) |

---

## Communication Protocol

### Wajib Lapor Ke Tuan

- ✅ Trade baru dibuka (dengan detail lengkap)
- ✅ Trade ditutup (hasil P/L exact)
- ✅ SL moved to break-even (notif ringkas)
- ✅ Partial close executed
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
| v2.0 | 2026-03-03 | Post-Trade #001 overhaul: ATR-based SL, pre-trade timeout, entry rules |
| **v3.0** | **2026-03-03** | **Bridge API v2.0 integration: pending orders, partial close, trailing stop rules, session filter, kill switch enhancement** |

---

## References

- `memory/trade-journal.md` — Log semua trade
- `memory/strategy-evolution.md` — Evolusi strategi
- `memory/mistake-prevention.md` — Aturan pencegahan kesalahan
- `TOOLS.md` — Bridge API reference (v2.0)
