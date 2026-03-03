# Implementation Plan: Dynamic Content Scheduler (@notesbyclaudia)

## 🎯 Konsep Utama
**"No Template Left Behind"** — Setiap konten dibuat FRESH dengan data real-time, tidak pakai template statis.

---

## 📅 Schedule Harian (3 Post)

| Waktu (WIB) | Topik | Data Source | Search Trigger |
|-------------|-------|-------------|----------------|
| **08:00** | Forex/Gold (XAUUSD) | Bridge API + MarketIntelligence | Technical analysis + overnight macro |
| **14:00** | Stocks/Macro/Geopolitik | MarketIntelligence + Web Search | IHSG/US Stocks + berita ekonomi hari itu |
| **20:00** | Tech/AI Updates | Web Search (AI news) | Rilis model AI/disrupsi tech terbaru |

---

## 🔧 Workflow Per Schedule

### Workflow 08:00 — Forex/Gold Focus

```
1. TRIGGER: Cron 08:00 WIB
   ↓
2. FETCH DATA:
   • Bridge API: /market-data (XAUUSD, D1/H1/M15)
   • Bridge API: /account (equity status)
   • TechnicalAnalysis: compute-confluence.js
   • MarketIntelligence: macro-insights.md (overnight)
   ↓
3. ANALISIS:
   • Confluence score saat ini
   • Key levels (support/resistance)
   • Macro events yang berdampak
   ↓
4. GENERATE CONTENT:
   • Hook: Refleksi setup hari ini
   • Style: Jaksel dialect, natural, no bullet points
   • Data: Price levels real-time
   ↓
5. POST ke Threads (via Repliz)
   ↓
6. LOG: Simpan ke posted/ dengan metadata lengkap
```

### Workflow 14:00 — Stocks/Macro/Geopolitik

```
1. TRIGGER: Cron 14:00 WIB
   ↓
2. FETCH DATA:
   • MarketIntelligence: Latest briefing (run skill)
   • Web Search: "IHSG hari ini" / "US stocks premarket"
   • Web Search: "NFP today" / "CPI release" (jika ada)
   • macro-insights.md: High-impact events
   ↓
3. ANALISIS:
   • Apa berita besar hari ini?
   • Dampak ke XAUUSD/forex?
   • Sentiment market (risk-on/off)
   ↓
4. GENERATE CONTENT:
   • Hook: Tanggapan berita hari ini
   • Style: Jaksel, sarkas ringan ke retail, elegan
   • Data: Angka real dari search (bukan tebak)
   ↓
5. POST ke Threads
   ↓
6. LOG + Update macro-insights
```

### Workflow 20:00 — Tech/AI Updates

```
1. TRIGGER: Cron 20:00 WIB
   ↓
2. FETCH DATA:
   • Web Search: "AI model release today"
   • Web Search: "OpenAI/Google/Anthropic update"
   • Web Search: "Tech disruption stock market"
   • (Opsional) MarketIntelligence jika ada tech news
   ↓
3. ANALISIS:
   • Ada rilis AI baru?
   • Dampak ke trading/market?
   • Perspektif sebagai trader/developer
   ↓
4. GENERATE CONTENT:
   • Hook: Opini tech dari sudut trader
   • Style: "Just vibes" tech talk
   • Tone: Eksploratif, tidak menggurui
   ↓
5. POST ke Threads
   ↓
6. LOG
```

---

## 🛡️ Safety Mechanisms

### 1. Anti-Halusinasi Check
**Rule:** Jika data fetch GAGAL atau return NULL → **SKIP POSTING**

```
IF (confluence_score === null || news_data === null):
   LOG: "Data unavailable, skipping post"
   EXIT
ELSE:
   PROCEED WITH POST
```

### 2. Duplicate Prevention
**Rule:** Jika topik sama dengan post 24 jam terakhir → **PIVOT TOPIC**

```
CHECK last 3 posts:
   IF (new_topic === recent_topic):
      SWITCH TO ALTERNATIVE TOPIC
      (e.g., Forex → Psychology → System Update)
```

### 3. Quality Threshold
**Rule:** Minimum confidence/data quality sebelum post

| Topik | Minimum Requirement |
|-------|---------------------|
| Forex | Confluence score tersedia + Price data valid |
| Macro | Berita terkonfirmasi dari 1+ source |
| Tech | News rilis dari source kredibel (TechCrunch, Ars, dll) |

---

## 📁 File Structure Updates

```
repliz-client/
├── scripts/
│   ├── content-generator.js      # NEW: Dynamic content creator
│   ├── smart-scheduler.js        # NEW: Cron handler with data fetch
│   └── repliz-client.js          # Existing (updated)
├── workflows/
│   ├── morning-forex.js          # NEW: 08:00 workflow
│   ├── afternoon-macro.js        # NEW: 14:00 workflow
│   └── evening-tech.js           # NEW: 20:00 workflow
├── config/
│   └── schedule-config.json      # NEW: Topic rotation rules
└── logs/
    └── content-generation.log    # NEW: Track what data was used
```

---

## 🔄 Phase Implementation

### Phase 1: Foundation (Week 1)
**Goal:** Setup workflows, test manual execution

- [ ] Buat `smart-scheduler.js` dengan cron trigger
- [ ] Buat 3 workflow files (morning, afternoon, evening)
- [ ] Test manual: Jalankan workflow 08:00 sekali, lihat output
- [ ] Verifikasi: Apakah data fetch berhasil? Konten natural?

**Deliverable:** 1 post manual per hari (total 7 post test)

---

### Phase 2: Automation (Week 2)
**Goal:** Cron aktif, posting auto tapi masih supervised

- [ ] Aktifkan cron: 08:00, 14:00, 20:00
- [ ] Setup notifikasi ke Telegram (preview sebelum post)
- [ ] Tuan approve/reject dalam 5 menit
- [ ] Jika no response → Auto-post (trust mode)

**Deliverable:** 21 post auto dengan supervision

---

### Phase 3: Full Auto (Week 3+)
**Goal:** Completely autonomous, daily reports only

- [ ] Remove approval step (Tuan trust Claudia)
- [ ] Daily summary report (09:00 WIB)
- [ ] Weekly analytics report (Minggu malam)
- [ ] Auto-reply ke komentar (dengan filter)

**Deliverable:** 3 post/hari autonomous + engagement

---

## 📊 Sample Content Generation Log

```json
{
  "timestamp": "2026-03-03T08:00:00Z",
  "slot": "morning",
  "data_sources": [
    "Bridge API: XAUUSD confluence=9",
    "MarketIntelligence: Geopolitical alert",
    "macro-insights.md: ECB speech today"
  ],
  "content_preview": "Jujurly hari ini setup XAU...",
  "posted": true,
  "post_id": "69a67c90...",
  "engagement": { "likes": 0, "replies": 0 }
}
```

---

## ⚠️ Important Rules (From SOUL.md)

1. **No Halusinasi:** Jika CPI/NFP hari ini → Search dulu angka real, jangan tebak
2. **No Template Staleness:** Jangan pakai template, generate fresh tiap kali
3. **No Overuse Emoji:** ☕ max 1x per 3 post (sudah ditegur Tuan)
4. **Jaksel Dialect:** Which is, Jujurly, Basically, Make sense
5. **Anti-Bot Format:** No bullet points, paragraph natural mengalir

---

## 🚀 Next Action Required

Tuan pilih mode start:

**A. Conservative (Recommended)**
- Saya buat 3 workflow files
- Test 1x manual tiap workflow (lihat output)
- Tuan review konten yang di-generate
- Jika OK → Aktifkan cron Phase 2

**B. Fast Track**
- Langsung aktifkan semua cron (3x/hari)
- Tuan supervise via Telegram preview
- Auto-post setelah 5 menit jika no veto

**C. Custom**
- Tuan tentukan sendiri urutan dan speed

---

**Menunggu approval plan ini sebelum eksekusi, Tuan.**
