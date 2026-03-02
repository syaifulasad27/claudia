# TOOLS.md — Bridge API Reference & Tools

_Referensi lengkap semua tools yang tersedia untuk Claudia._

---

## Bridge API — MT5 Execution Gateway

### Connection Configuration

| Parameter | Value |
|---|---|
| **Base URL** | Dinamis — diberikan Tuan via Telegram (Ngrok URL) |
| **Authentication** | Header: `X-API-Key: [API_KEY]` |
| **Protocol** | HTTPS (via Ngrok tunnel) |
| **Availability** | TIDAK selalu online — hanya saat dijalankan manual |

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

### 4. Positions

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
    "time": "2026-03-01T08:30:00"
  }
]
```

**Kapan digunakan:**
- ✅ Monitoring posisi terbuka
- ✅ Kill Switch check — apakah ada posisi aktif saat koneksi lost
- ✅ Evaluasi total exposure
- ✅ Keputusan untuk menutup posisi

---

### 5. Place Order

```
POST {BRIDGE_BASE_URL}/order
```

**Purpose:** Eksekusi market order (BUY atau SELL)

**Request Body:**
```json
{
  "symbol": "XAUUSD",
  "order_type": "BUY",
  "volume": 0.10,
  "sl": 2640.00,
  "tp": 2670.00,
  "comment": "Claudia-XAUUSD-H1-BUY-001",
  "idempotency_key": "claudia-20260301-001"
}
```

**Kapan digunakan:**
- ✅ HANYA setelah analisis lengkap (multi-timeframe + macro)
- ✅ HANYA jika risk/reward acceptable
- ✅ HANYA jika margin sufficient

**CRITICAL RULES:**
- ⚠️ **SELALU gunakan `idempotency_key`** → Mencegah order duplikat
- ⚠️ **SELALU set `sl` (Stop Loss)** → Tidak ada trade tanpa SL
- ⚠️ **Comment harus descriptif** → Format: `Claudia-{SYMBOL}-{TF}-{TYPE}-{SEQ}`
- ⚠️ **Verifikasi via `/positions`** setelah order untuk konfirmasi

**Pre-Execution Checklist:**
```
□ Health check passed?
□ Account margin sufficient?
□ Spread acceptable?
□ Multi-timeframe analysis done?
□ Risk per trade calculated?
□ Drawdown will NOT exceed limit?
□ No revenge trading?
□ Setup is valid per strategy?
□ Idempotency key set?
□ SL and TP defined?
```

---

### 6. Close Position

```
POST {BRIDGE_BASE_URL}/close
```

**Purpose:** Menutup posisi berdasarkan ticket number

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

- Setiap order WAJIB menyertakan `idempotency_key` unik
- Format: `claudia-{YYYYMMDD}-{sequence_number}`
- Ini mencegah duplikasi order jika terjadi network retry

### Connection Validation

- SELALU panggil `/health` sebelum operasi trading
- JANGAN cache status koneksi — selalu validasi fresh
- Jika health check gagal → STOP semua trading activity

### Error Response Handling

Semua endpoint mengembalikan structured JSON. Jika menerima:
- `status: "error"` → Log error, jangan retry operasi yang sama
- HTTP 400 → Request tidak valid, cek parameter
- HTTP 500 → Server error, Bridge API mungkin bermasalah
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

- **XAUUSD:** High volatility, spread bisa melebar saat news. Cek spread sebelum entry.
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
