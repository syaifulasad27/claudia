# Improvement Plan: Context-Aware Reply Sub-Agent

## 🎯 Problem Analysis

### Current Issue:
- **Komentar:** "Kapan open posisi kak?"
- **Reply Claudia:** Generic ("trading itu simple tapi nggak gampang...")
- **Expected:** Jawab tentang kriteria entry, timing, atau konfirmasi teknikal

### Root Cause:
Reply generator tidak:
1. **Parse intent spesifik** dari komentar
2. **Ambil data kontekstual** (price saat ini, setup terbaru)
3. **Generate jawaban yang relevan** dengan pertanyaan

---

## 🏗️ Sub-Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN CLAUDIA                          │
│              (Orchestrator & Monitor)                    │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│  Post    │  │   Comment    │  │   Context    │
│  Agent   │  │   Parser     │  │   Fetcher    │
│          │  │   Agent      │  │   Agent      │
└────┬─────┘  └──────┬───────┘  └──────┬───────┘
     │               │                  │
     │               ▼                  │
     │        ┌──────────────┐          │
     │        │  Intent      │          │
     │        │  Detection   │          │
     │        │  (NLP)       │          │
     │        └──────┬───────┘          │
     │               │                  │
     └───────────────┼──────────────────┘
                     ▼
        ┌────────────────────────┐
        │   Reply Generator      │
        │   Sub-Agent            │
        │                        │
        │  Input: Intent + Data  │
        │  Output: Contextual    │
        │         Reply          │
        └──────────┬─────────────┘
                   │
                   ▼
        ┌────────────────────────┐
        │   Approval Queue       │
        │   (Human-in-the-loop)  │
        └────────────────────────┘
```

---

## 🤖 Sub-Agent Specifications

### Agent 1: Comment Parser Agent
**Tugas:** Parse komentar, extract intent dan entities

**Input:** Raw comment text
**Output:** Structured intent

```javascript
{
  intent: "asking_entry_timing", // asking_price, asking_strategy, appreciation, criticism, etc
  entities: {
    topic: "entry",      // entry, exit, sl, tp, analysis
    pair: "XAUUSD",      // if mentioned
    timeframe: "H1"      // if mentioned
  },
  sentiment: "neutral",  // positive, negative, neutral
  urgency: "high"        // high, medium, low
}
```

**Contoh Parse:**
| Komentar | Intent | Entities |
|----------|--------|----------|
| "Kapan open posisi kak?" | `asking_entry_timing` | {topic: "entry"} |
| "SL di berapa?" | `asking_sl_placement` | {topic: "sl"} |
| "XAUUSD hari ini gimana?" | `asking_analysis` | {topic: "analysis", pair: "XAUUSD"} |
| "Mantap kak!" | `appreciation` | {} |

---

### Agent 2: Context Fetcher Agent
**Tugas:** Ambil data relevan dari memory/API berdasarkan intent

**Input:** Intent dari Parser Agent
**Output:** Context data

```javascript
{
  currentPrice: 5335.50,
  confluenceScore: 9,
  setup: "BULLISH",
  keyLevels: {
    support: 5335,
    resistance: 5425
  },
  recentPost: "Setup XAUUSD di 5335...",
  timestamp: "2026-03-03T08:00:00Z"
}
```

**Data Sources:**
- `memory/macro-insights.md` (latest)
- Bridge API (if online)
- `state/confluence-XAUUSD.json`
- Recent posts context

---

### Agent 3: Reply Generator Agent
**Tugas:** Generate reply yang kontekstual dan spesifik

**Input:** Intent + Context + Persona guidelines
**Output:** Draft reply

**Rules:**
1. **Jawab langsung pertanyaan** — tidak generic
2. **Sertakan data spesifik** dari context
3. **Tone sesuai persona** — Jaksel minimal, natural
4. **Panjang max 2 kalimat** — concise

**Contoh Output:**

| Intent | Context | Reply |
|--------|---------|-------|
| `asking_entry_timing` | Price 5335, EMA20 support | "Untuk entry, tunggu pullback ke 5335 (EMA20) dengan konfirmasi bullish candle. Basically setup bagus tapi sabar nunggu zona optimal." |
| `asking_sl_placement` | ATR 30 | "SL taruh di 5290 (45 pips), which is 1.5x ATR saat ini. Jangan dipendekin, nanti kena noise." |
| `appreciation` | - | "Thanks! Senang bisa bermanfaat. Keep grinding 💪" |

---

## 📋 Implementation Phases

### Phase 1: Comment Parser (Day 1-2)
- [ ] Buat `agents/comment-parser.js`
- [ ] Define intent taxonomy (10-15 intents)
- [ ] Test parse accuracy
- [ ] Integrate dengan fetcher

### Phase 2: Context Fetcher (Day 3-4)
- [ ] Buat `agents/context-fetcher.js`
- [ ] Connect ke macro-insights, confluence data
- [ ] Cache recent data untuk quick access
- [ ] Test context relevance

### Phase 3: Reply Generator (Day 5-6)
- [ ] Buat `agents/reply-generator.js`
- [ ] Template system per intent
- [ ] Integrate Parser + Fetcher + Generator
- [ ] Test end-to-end

### Phase 4: Integration (Day 7)
- [ ] Replace old reply-drafter dengan Sub-Agent system
- [ ] Full workflow test
- [ ] Monitor dan adjust

---

## 🎯 Success Metrics

| Metric | Before | After Target |
|--------|--------|--------------|
| Context relevance | 30% | 90% |
| Direct answer rate | 20% | 85% |
| Tuan edit rate | 50% | <20% |
| Engagement (reply likes) | Low | High |

---

## 🚀 Next Step

**Tuan pilih:**

**A. Mulai Phase 1** (Comment Parser Agent)
**B. Review plan dulu** (modifikasi jika perlu)
**C. Contoh demo** (Saya generate beberapa contoh reply dengan system baru)

*Menunggu instruksi untuk eksekusi.* 🎯
