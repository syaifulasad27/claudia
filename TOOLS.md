# TOOLS.md — Bridge API Reference & Tools (v2.0)

_Referensi lengkap semua tools yang tersedia untuk Claudia._

---

## Bridge API — MT5 Execution Gateway (v2.0)

### Connection Configuration

| Parameter | Value |
|---|---|
| **Base URL** | Dinamis — diberikan Tuan via Telegram (Ngrok URL) |
| **Authentication** | Header: `X-API-Key: [API_KEY]` |
| **Protocol** | HTTPS (via Ngrok tunnel) |
| **Availability** | TIDAK selalu online — hanya saat dijalankan manual |
| **Version** | 2.0.0 |

### Runtime Variable

Saat Tuan mengirim URL Bridge API, simpan sebagai:

```
BRIDGE_BASE_URL = "https://xxxx-xx-xxx.ngrok-free.app"
```

Gunakan untuk semua API calls. URL ini berubah setiap kali Ngrok di-restart.

---

## Endpoint Reference

### 1. Health Check

```
GET {BRIDGE_BASE_URL}/health
```

**Purpose:** Validasi koneksi Bridge API dan status MT5

**Response:**
```json
{
  "status": "ok | error",
  "mt5_connected": true | false,
  "trade_allowed": true | false,
  "terminal_info": { ... } | null,
  "account_balance": 10000.00 | null,
  "server_time": "2026-03-01T04:00:00+00:00"
}
```

**Kapan digunakan:**
- ✅ WAJIB dipanggil pertama kali sebelum trading session
- ✅ Dipanggil di setiap heartbeat jika Bridge API aktif
- ✅ Dipanggil sebelum setiap batch operasi trading

**Error Handling:**
- Jika `status: "error"` → MT5 tidak terkoneksi, JANGAN trading
- Jika request timeout → Bridge API offline, JANGAN trading
- Jika `mt5_connected: false` → MT5 terminal belum login
- Jika `trade_allowed: false` → MT5 terminal belum siap trading

---

### 2. Account Info

```
GET {BRIDGE_BASE_URL}/account
```

**Purpose:** Mendapatkan informasi akun trading lengkap

**Response:**
```json
{
  "balance": 10000.00,
  "equity": 10250.00,
  "margin": 500.00,
  "free_margin": 9750.00,
  "leverage": 100,
  "currency": "USD",
  "profit": 250.00
}
```

**Kapan digunakan:**
- ✅ Sebelum membuka posisi baru (cek margin available)
- ✅ Untuk kalkulasi risk per trade (% dari equity)
- ✅ Untuk monitoring drawdown level

**Data Penting untuk Risk Management:**
- `equity` → Basis kalkulasi drawdown
- `free_margin` → Batas kapasitas untuk posisi baru
- `profit` → P/L floating saat ini
- `balance - equity` → Floating loss/profit

---

### 3. Market Data

```
POST {BRIDGE_BASE_URL}/market-data
```

**Purpose:** Mengambil data OHLCV candle, latest tick, dan spread

**Request Body:**
```json
{
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "bars": 100
}
```

**Timeframe Values:**
| Value | Timeframe |
|---|---|
| `M1` | 1 Minute |
| `M5` | 5 Minutes |
| `M15` | 15 Minutes |
| `M30` | 30 Minutes |
| `H1` | 1 Hour |
| `H4` | 4 Hours |
| `D1` | Daily |
| `W1` | Weekly |
| `MN1` | Monthly |

**Response:** Data OHLCV array + tick info + spread

**Kapan digunakan:**
- ✅ Analisis teknikal multi-timeframe
- ✅ Identifikasi setup trading
- ✅ Evaluasi volatilitas (menggunakan ATR dari candle data)
- ✅ Monitoring kondisi market saat posisi terbuka

**Best Practice:**
- Ambil minimal 3 timeframe untuk analisis: D1 (big picture), H1 (trend), M15 (entry)
- Gunakan 100-200 bars untuk analisis yang cukup
- Cek spread sebelum eksekusi — spread terlalu lebar = bahaya

---

### 4. Symbol Info (BARU v2.0)

```
GET {BRIDGE_BASE_URL}/symbol-info/{symbol}
```

**Purpose:** Mendapatkan metadata detail simbol untuk kalkulasi trading

**Response:**
```json
{
  "symbol": "XAUUSD",
  "description": "Gold vs US Dollar",
  "point": 0.01,
  "digits": 2,
  "spread": 15,
  "trade_mode": 4,
  "trade_mode_description": "FULL",
  "volume_min": 0.01,
  "volume_max": 100.0,
  "volume_step": 0.01,
  "trade_contract_size": 100.0,
  "currency_base": "XAU",
  "currency_profit": "USD",
  "currency_margin": "USD",
  "bid": 5350.50,
  "ask": 5350.65,
  "swap_long": -25.50,
  "swap_short": 12.30,
  "session_open": null,
  "session_close": null
}
```

**Kapan digunakan:**
- ✅ **Sebelum kalkulasi position size** — ambil `point`, `trade_contract_size`
- ✅ **Validasi volume** — cek `volume_min`, `volume_max`, `volume_step`
- ✅ **Cek spread real-time** — `spread` field
- ✅ **Cek bid/ask terkini** — tanpa perlu panggil `/market-data`
- ✅ **Lihat swap rates** — penting untuk posisi overnight

**CRITICAL:** Panggil endpoint ini sebelum place order untuk memastikan:
1. `trade_mode_description` = "FULL" (trading allowed)
2. Volume sesuai `volume_step`
3. Spread dalam batas wajar

---

### 5. Positions

```
GET {BRIDGE_BASE_URL}/positions
```

**Purpose:** Mendapatkan daftar semua posisi terbuka

**Response:**
```json
[
  {
    "ticket": 12345678,
    "symbol": "XAUUSD",
    "type": "BUY",
    "volume": 0.10,
    "price_open": 2650.50,
    "price_current": 2655.00,
    "sl": 2640.00,
    "tp": 2670.00,
    "profit": 45.00,
    "swap": -2.50,
    "time": "2026-03-01T08:30:00+00:00",
    "comment": "Claudia-XAUUSD-H1-BUY-001"
  }
]
```

**Kapan digunakan:**
- ✅ Monitoring posisi terbuka
- ✅ Kill Switch check — apakah ada posisi aktif saat koneksi lost
- ✅ Evaluasi total exposure
- ✅ Keputusan trailing stop / breakeven
- ✅ Source validation — cek `comment` field apakah prefix `Claudia-*`

---

### 6. Place Market Order

```
POST {BRIDGE_BASE_URL}/order
```

**Purpose:** Eksekusi market order (BUY atau SELL) secara instan

**Request Body:**
```json
{
  "symbol": "XAUUSD",
  "type": "BUY",
  "volume": 0.10,
  "sl": 2640.00,
  "tp": 2670.00,
  "comment": "Claudia-XAUUSD-H1-BUY-001",
  "idempotency_key": "claudia-20260301-001"
}
```

**Kapan digunakan:**
- ✅ HANYA jika EMA20 sangat dekat (< 5 pips) dari current price
- ✅ HANYA setelah analisis lengkap + checklist terpenuhi
- ✅ Fallback jika limit order tidak praktis

**CRITICAL RULES:**
- ⚠️ **SELALU gunakan `idempotency_key`** → Mencegah order duplikat
- ⚠️ **SELALU set `sl` (Stop Loss)** → Tidak ada trade tanpa SL
- ⚠️ **Comment harus descriptif** → Format: `Claudia-{SYMBOL}-{TF}-{TYPE}-{SEQ}`
- ⚠️ **Verifikasi via `/positions`** setelah order untuk konfirmasi
- ⚠️ **Prefer `/order/pending`** di atas market order untuk entry yang lebih baik

---

### 7. Place Pending Order (BARU v2.0)

```
POST {BRIDGE_BASE_URL}/order/pending
```

**Purpose:** Memasang pending/limit order yang akan trigger saat harga mencapai level tertentu

**Request Body:**
```json
{
  "symbol": "XAUUSD",
  "type": "BUY_LIMIT",
  "volume": 0.10,
  "price": 5320.00,
  "sl": 5280.00,
  "tp": 5400.00,
  "comment": "Claudia-XAUUSD-H1-BUYLIMIT-001",
  "expiration": "2026-03-04T00:00:00+00:00",
  "idempotency_key": "claudia-pending-20260303-001"
}
```

**Order Types:**
| Type | Triggered When | Use Case |
|------|---------------|----------|
| `BUY_LIMIT` | Price turun ke level → buy | Pullback entry (PRIMARY) |
| `SELL_LIMIT` | Price naik ke level → sell | Pullback entry (PRIMARY) |
| `BUY_STOP` | Price naik melewati level → buy | Breakout entry |
| `SELL_STOP` | Price turun melewati level → sell | Breakout entry |

**Kapan digunakan:**
- ✅ **PRIMARY entry method** — lebih baik dari market order
- ✅ Entry di EMA20/EMA50 pullback zone (BUY_LIMIT / SELL_LIMIT)
- ✅ Breakout entry (BUY_STOP / SELL_STOP)
- ✅ Entry saat off-hours (pasang limit, trigger otomatis saat sesi aktif)

**Best Practice:**
- Set `expiration` → Cancel otomatis jika tidak trigger dalam 2-4 jam
- Jika sudah trigger → Cek `/positions` untuk konfirmasi posisi terbuka
- Jika setup berubah → Cancel via `DELETE /order/pending/{ticket}`
- Gunakan `idempotency_key` untuk mencegah duplikasi

---

### 8. List Pending Orders (BARU v2.0)

```
GET {BRIDGE_BASE_URL}/orders/pending
```

**Purpose:** Mendapatkan daftar semua pending order yang masih aktif

**Response:**
```json
[
  {
    "ticket": 11223344,
    "symbol": "XAUUSD",
    "type": "BUY_LIMIT",
    "volume": 0.10,
    "price_open": 5320.00,
    "sl": 5280.00,
    "tp": 5400.00,
    "time_setup": "2026-03-03T12:00:00+00:00",
    "expiration": "2026-03-04T00:00:00+00:00",
    "comment": "Claudia-XAUUSD-H1-BUYLIMIT-001"
  }
]
```

**Kapan digunakan:**
- ✅ Review pending orders sebelum memasang yang baru
- ✅ Cek apakah pending order masih valid dengan kondisi market terkini
- ✅ Housekeeping — cancel pending yang sudah tidak relevan

---

### 9. Cancel Pending Order (BARU v2.0)

```
DELETE {BRIDGE_BASE_URL}/order/pending/{ticket}
```

**Purpose:** Membatalkan pending order yang masih aktif

**Response:**
```json
{
  "status": "cancelled",
  "ticket": 11223344,
  "message": "Pending order 11223344 cancelled"
}
```

**Kapan digunakan:**
- ✅ Setup sudah tidak valid (market structure berubah)
- ✅ Pending order sudah lebih dari 2 jam tanpa trigger
- ✅ Kondisi news/macro berubah → cancel pending
- ✅ Ganti level entry → cancel lama, pasang baru

---

### 10. Close Position

```
POST {BRIDGE_BASE_URL}/close
```

**Purpose:** Menutup posisi berdasarkan ticket number (full close)

**Request Body:**
```json
{
  "ticket": 12345678
}
```

**Kapan digunakan:**
- ✅ Take profit manual (jika analisis menunjukkan reversal sebelum TP)
- ✅ Cut loss manual (jika kondisi berubah drastis)
- ✅ Emergency close atas perintah Tuan
- ✅ Close saat mencapai risk limit

---

### 11. Partial Close Position (BARU v2.0)

```
POST {BRIDGE_BASE_URL}/close/partial
```

**Purpose:** Menutup sebagian volume posisi, sisanya tetap running

**Request Body:**
```json
{
  "ticket": 12345678,
  "volume": 0.05
}
```

**Response:**
```json
{
  "status": "partial_closed",
  "ticket": 12345678,
  "volume_closed": 0.05,
  "volume_remaining": 0.05,
  "message": "Partially closed 0.05 lots, 0.05 remaining"
}
```

**Kapan digunakan:**
- ✅ Lock sebagian profit saat trade sudah ≥2.5× risk
- ✅ Reduce exposure saat mendekati high-impact news
- ✅ Scale out bertahap saat profit running

**Best Practice:**
- Close 50% saat profit ≥ 2.5× risk → trail SL sisa
- Pastikan `volume` sesuai dengan `volume_step` dari `/symbol-info`
- Setelah partial close → cek `/positions` untuk verifikasi sisa volume

---

### 12. Modify Position SL/TP

```
PATCH {BRIDGE_BASE_URL}/order/{ticket}
```

**Purpose:** Update Stop Loss / Take Profit untuk posisi yang sudah terbuka

**Request Body:**
```json
{
  "sl": 5290.00,
  "tp": 5400.00
}
```

**Kapan digunakan:**
- ✅ **Trailing stop** — move SL ke break-even atau sesuai profit
- ✅ Adjust TP berdasarkan perubahan kondisi market
- ✅ Emergency risk management — menambahkan SL pada posisi tanpa SL
- ✅ Part of Active Trade Management Protocol (lihat trading-config.md)

**CRITICAL NOTES:**
- ⚠️ **Fallback jika modify gagal:** Close posisi existing + buka posisi baru dengan SL/TP yang benar
- ⚠️ **JANGAN biarkan posisi tanpa SL** — ini adalah uncontrolled risk
- ⚠️ **Validasi comment field** sebelum modify — hanya posisi dengan prefix `Claudia-*` yang di-manage

---

### 13. Order History (BARU v2.0)

```
GET {BRIDGE_BASE_URL}/orders/history?days=30
```

**Purpose:** Mengambil riwayat trade yang sudah ditutup

**Query Parameters:**
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `days` | 30 | 1-365 | Jumlah hari ke belakang |

**Response:**
```json
{
  "total": 5,
  "deals": [
    {
      "ticket": 99887766,
      "order": 12345678,
      "symbol": "XAUUSD",
      "type": "BUY",
      "volume": 0.10,
      "price": 5350.00,
      "profit": 150.00,
      "swap": -5.20,
      "commission": -0.50,
      "fee": 0.0,
      "time": "2026-03-01T14:30:00+00:00",
      "comment": "Claudia-XAUUSD-H1-BUY-001"
    }
  ]
}
```

**Kapan digunakan:**
- ✅ **Post-trade analysis** — review profit/loss detail
- ✅ **Performance tracking** — update `performance-stats.md`
- ✅ **Pattern recognition** — identifikasi setup paling profitable
- ✅ **Swap/commission tracking** — faktor biaya total

**Best Practice:**
- Panggil `?days=7` untuk weekly review
- Filter berdasarkan `comment` prefix `Claudia-*` untuk hanya lihat trade sistem
- Gunakan data ini untuk update `memory/trade-journal.md` dan `memory/performance-stats.md`

---

## External Data Tools

### Web Browsing — Economic News

Karena Bridge API TIDAK menyediakan endpoint berita, Claudia harus menggunakan kemampuan web browsing untuk:

1. **Monitor berita ekonomi** dari sumber terpercaya:
   - ForexFactory economic calendar
   - Investing.com economic calendar
   - Bloomberg, Reuters (headlines)

2. **Data yang dicari:**
   - Jadwal rilis data ekonomi (NFP, CPI, FOMC, ECB, dll)
   - Keputusan suku bunga
   - Pernyataan bank sentral
   - Event geopolitik yang mempengaruhi market

3. **Frekuensi:** Minimum setiap 1 jam (dikonfigurasi di HEARTBEAT.md)

4. **Output:** Update `memory/macro-insights.md` dengan insight terbaru

---

## Fail-Safe Architecture

### Timeout Protection

- Setiap API call HARUS memiliki timeout maksimum
- Jika response tidak datang dalam waktu yang wajar → anggap API down
- Jangan retry tanpa batas — maksimum 3 retry dengan exponential backoff

### Idempotent Requests

- Setiap order (market dan pending) WAJIB menyertakan `idempotency_key` unik
- Format: `claudia-{YYYYMMDD}-{sequence_number}` (market) atau `claudia-pending-{YYYYMMDD}-{sequence_number}` (pending)
- Ini mencegah duplikasi order jika terjadi network retry

### Connection Validation

- SELALU panggil `/health` sebelum operasi trading
- JANGAN cache status koneksi — selalu validasi fresh
- Jika health check gagal → STOP semua trading activity

### Error Response Handling

Semua endpoint mengembalikan structured JSON. Jika menerima:
- `status: "error"` → Log error, jangan retry operasi yang sama
- HTTP 400 → Request tidak valid, cek parameter
- HTTP 404 → Resource tidak ditemukan (symbol, ticket)
- HTTP 429 → Rate limited, tunggu sebelum retry
- HTTP 500 → Server error, Bridge API mungkin bermasalah
- HTTP 503 → MT5 tidak terkoneksi
- Timeout → API mungkin offline, trigger koneksi lost procedure

---

## Pair Configuration

### Primary Focus

| Pair | Priority | Notes |
|---|---|---|
| **XAUUSD** | 🥇 PRIMARY | Fokus utama, analisis terdalam |
| EURUSD | 🥈 OPTIONAL | Analisis jika ada setup jelas |
| GBPUSD | 🥈 OPTIONAL | Analisis jika ada setup jelas |
| US100 / NASDAQ | 🥈 OPTIONAL | Analisis jika ada setup jelas |

### Pair-Specific Notes

- **XAUUSD:** High volatility, spread bisa melebar saat news. Cek spread via `/symbol-info/XAUUSD` sebelum entry.
- **EURUSD:** Pair paling liquid. Spread biasanya ketat.
- **GBPUSD:** Volatile terutama saat London session dan BOE events.
- **US100:** Index — perhatikan corporate earnings dan Fed announcements.

---

## QMD — Local Document Search

**QMD (Quick Markdown Search)** tersedia untuk search knowledge base lokal.

### CLI Location
```
/root/.bun/bin/qmd
```

### Collections Tersedia
- `openclaw_docs` — Dokumentasi OpenClaw
- `openclaw_workspace` — Workspace files (AGENTS.md, SOUL.md, dll)

### Usage
```bash
# Search keyword (BM25)
qmd search "trading strategy" -c openclaw_workspace

# Semantic search (natural language)
qmd query "cara setup telegram bot"

# Search dengan multiple types
qmd query $'lex: XAUUSD\nvec: gold trading strategy'

# List files
qmd ls openclaw_workspace

# Get specific document
qmd get qmd://openclaw_workspace/memory/macro-insights.md
```

### Kapan Digunakan
- Cari referensi dari dokumentasi lokal
- Search insight atau analysis yang pernah ditulis
- Temukan setup trading yang pernah di-log

### Query Types
| Type | Gunakan Untuk |
|------|---------------|
| `lex` | Keyword exact — nama pair, teknikal term |
| `vec` | Natural language — "bagaimana cara..." |
| `hyde` | Hypothetical answer (advanced) |

### Status
```bash
qmd status
```

### Reindex (Jika Ada Perubahan File)
```bash
# Quick reindex
/root/.openclaw/workspace/qmd-refresh.sh

# Atau manual:
qmd collection remove openclaw_workspace
qmd collection add /root/.openclaw/workspace --name openclaw_workspace
qmd embed
```
