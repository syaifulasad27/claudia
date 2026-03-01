# HEARTBEAT.md — Periodic Task Checklist

_Setiap heartbeat, Claudia menjalankan task-task berikut secara otomatis._

---

## 📰 Economic News Monitoring (Minimum setiap 1 jam)

- [ ] Cek berita ekonomi terbaru via web browsing
- [ ] Identifikasi high-impact events (NFP, CPI, FOMC, ECB, dll)
- [ ] Evaluasi dampak terhadap pair utama: **XAUUSD**, EURUSD, GBPUSD, US100
- [ ] Update `memory/macro-insights.md` jika ada insight baru
- [ ] Jika ada event kritis dalam 30 menit → Notifikasi ke Tuan

---

## 📊 Position Monitoring (Jika Bridge API aktif)

- [ ] `GET {BRIDGE_BASE_URL}/health` — Cek koneksi masih hidup
- [ ] `GET {BRIDGE_BASE_URL}/positions` — Cek posisi terbuka
- [ ] Evaluasi floating P/L terhadap risk limits
- [ ] Jika drawdown mendekati limit → Alert ke Tuan
- [ ] Jika koneksi gagal + ada posisi terbuka → **TRIGGER KILL SWITCH** (lihat AGENTS.md)

---

## 📈 Performance Review (Setiap 4-6 jam)

- [ ] Review `memory/performance-stats.md`
- [ ] Cek apakah masih dalam koridor risk yang acceptable
- [ ] Evaluasi win rate dan risk/reward ratio trending
- [ ] Jika ada degradasi performa → Laporkan ke Tuan

---

## 🧠 Memory Maintenance (Setiap 24 jam)

- [ ] Review `memory/YYYY-MM-DD.md` files terbaru
- [ ] Distil insight penting ke `MEMORY.md`
- [ ] Cleanup data yang sudah expired dari `macro-insights.md`
- [ ] Review `mistake-prevention.md` — ada pattern baru?

---

## Heartbeat State Tracking

Track semua pengecekan di `memory/heartbeat-state.json`:

```json
{
  "lastChecks": {
    "economic_news": null,
    "position_monitor": null,
    "performance_review": null,
    "memory_maintenance": null
  },
  "bridge_api_url": null,
  "bridge_api_active": false
}
```

---

## Rules

1. **Jika tidak ada task yang relevan** → reply `HEARTBEAT_OK`
2. **Jangan check berita di jam 23:00-07:00 WIB** kecuali ada posisi terbuka
3. **Jangan spam Tuan** — batch notifications jika ada multiple updates
4. **News monitoring adalah CRITICAL** — ini satu-satunya cara Claudia dapat data makroekonomi karena Bridge API tidak menyediakan endpoint berita
5. **Desain modular** — ketika News Sub-Agent tersedia di masa depan, task monitoring berita akan dipindahkan ke sub-agent tersebut
