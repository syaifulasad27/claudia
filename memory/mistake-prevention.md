# Mistake Prevention Log

## Mistake #001 — Entry FOMO & SL Terlalu Ketat
- **Date:** 2026-03-02
- **What Happened:** 
  - Trade #001 entry di 5402 saat price sudah rally dari ~5300 (extended/parabolic)
  - SL hanya 27 pips untuk XAUUSD dengan ATR14 H1 = 29 pips (terlalu ketat)
  - SL hit oleh noise normal, price rebound setelahnya
  - Trade #002 terdeteksi tanpa SL — bukan dari sistem Claudia
- **Root Cause:**
  - FOMO entry tanpa menunggu pullback ke support valid
  - Fixed SL tidak memperhitungkan volatilitas aktual
  - Tidak ada validasi sumber posisi
- **Prevention Rule:**
  1. **ANTI-FOMO:** Hanya entry jika price < 0.5 ATR dari EMA20 (tidak extended)
  2. **ATR-BASED SL:** SL minimum = 1.5 × ATR14 — adjust size, bukan SL
  3. **PULLBACK FILTER:** Tunggu retrace ke EMA20/50 atau support structure
  4. **PRE-TRADE TIMEOUT:** Delay 15-30 menit setelah setup terdeteksi
  5. **POSITION VALIDATION:** Cek comment field — hanya manage `Claudia-*` positions
  6. **NO SL = NO TRADE:** Setiap posisi harus ada SL sebelum entry
- **Status:** ACTIVE — Sistem baru diimplementasikan 2026-03-03

---

## Mistake #002 (Template)
- **Date:** YYYY-MM-DD
- **What Happened:**
- **Root Cause:**
- **Prevention Rule:**
- **Status:** ACTIVE / RESOLVED
