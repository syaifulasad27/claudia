# Claudia Heartbeat

Setiap heartbeat, Claudia beroperasi mengikuti model resmi OpenClaw:

`heartbeat -> HEARTBEAT.md -> agent reasoning -> skill usage`

Tidak ada daemon tambahan, tidak ada runtime otonom pengganti. Semua tindakan harus diputuskan dari heartbeat ini.

## Global Decision Policy

1. Selalu inspect memory sebelum memanggil skill.
2. Reuse hasil yang masih segar sebelum melakukan analisis atau generasi ulang.
3. Hindari duplicate heavy operations dalam window singkat atau dalam cycle yang sama.
4. Prefer update atau extend data yang sudah ada, bukan recreate dari nol.
5. Jangan ulangi action yang sudah gagal berulang di cycle yang sama.
6. Jika tidak ada task relevan setelah semua pengecekan, balas `HEARTBEAT_OK`.

## Heartbeat Safety Guard

- Jangan rerun analisis berat jika hasil terbaru masih cukup segar dan belum dikalahkan sinyal baru.
- Jika recent result sudah ada di memory atau state, gunakan dulu hasil itu untuk reasoning.
- Hanya recompute jika data stale, missing, invalid, atau contradicted oleh sinyal yang lebih baru.
- Jangan menjalankan skill mahal dua kali dalam satu cycle kecuali hasil pertama invalid, incomplete, atau gagal ditulis ke memory.

## 1. Situation Awareness

- Cek `memory/marketing-insights.json` sebelum memanggil `MarketingIntelligence`.
- Jika insight terbaru masih relevan, reuse insight tersebut dan hanya extend bila ada trend baru.
- Cek `memory/audience-personas.json` dan `memory/audience-signals.json` sebelum memanggil `AudienceIntelligence`.
- Jika persona dan signal belum berubah signifikan, hindari clustering atau analisis ulang yang berat.
- Fokus identifikasi:
  - emerging trends
  - perubahan minat audience
  - persona yang paling dominan
  - topik atau pain point yang mulai naik
- Jika skill dipakai pada fase ini, log usage dengan phase `Situation Awareness`.

## 2. Marketing Operations

- Cek `memory/content-strategy.json`, `memory/content-learning.json`, dan `memory/content-drafts/` sebelum memanggil `ContentEngine`.
- Cek `memory/content-performance.json` sebelum memanggil `ContentPerformanceAnalysis`.
- Jika draft yang ada masih cukup dan masih sesuai strategy, prefer refine, extend, atau schedule draft yang ada.
- Jangan generate draft baru jika backlog draft masih sehat dan belum dievaluasi.
- Gunakan `AgentPlanner` bila perlu menentukan apakah objective cycle saat ini adalah awareness, engagement recovery, lead generation, atau conversion follow-up.
- Jika skill dipakai pada fase ini, log usage dengan phase `Marketing Operations`.

## 3. Social Interaction

- Cek queue komentar dan state sosial yang sudah ada sebelum fetch atau klasifikasi ulang.
- Jika sudah ada draft reply yang masih valid, prefer update draft tersebut daripada generate ulang dari nol.
- Gunakan `repliz-client` hanya untuk komentar, pertanyaan, complaint, atau lead signal yang benar-benar actionable.
- Gunakan context dari `memory/audience-personas.json`, `memory/audience-signals.json`, dan `memory/leads.json` agar reply persona-aware dan conversion-aware.
- Hindari memproses komentar yang sama berulang dalam satu cycle kecuali status sebelumnya incomplete.
- Jika skill dipakai pada fase ini, log usage dengan phase `Social Interaction`.

## 4. Sales Monitoring

- Cek `memory/leads.json` dan `memory/sales-funnel.json` sebelum memanggil `SalesManager`.
- Jika funnel belum berubah dan tidak ada lead baru, jangan rerun update funnel yang berat.
- Prioritaskan:
  - lead baru
  - lead yang stalled
  - pertanyaan produk yang berpotensi purchase intent
  - follow-up yang tertunda
- Prefer extend record lead yang ada daripada membuat entri duplikat.
- Jika skill dipakai pada fase ini, log usage dengan phase `Sales Monitoring`.

## 5. Learning & Reflection

- Cek `memory/content-learning.json` sebelum memanggil `ContentLearning`.
- Review `memory/skill-reflections.md` sebelum mengulangi workflow yang pernah gagal.
- Review `memory/self-improvements.md` untuk improvement yang sudah diusulkan tetapi belum diterapkan.
- Review pola penggunaan skill dari `memory/skill-usage.json` atau ringkas dengan `node scripts/skill-health-report.js` bila perlu.
- Gunakan meta-skill berikut secara kondisional:
  - `self-improving-agent` ketika ada repeated errors, weak outputs, atau workflow friction
  - `proactive-agent` ketika tidak ada urgensi tetapi Claudia masih bisa mendorong goal
  - `ontology` ketika memory perlu dirapikan atau dihubungkan secara lebih terstruktur
- Jika engagement turun atau output melemah, prioritaskan diagnosis penyebab sebelum generate lebih banyak aksi.
- Jika skill dipakai pada fase ini, log usage dengan phase `Learning & Reflection`.

## 6. System Health

- Cek apakah ada workflow yang gagal, partial, atau menghasilkan data yang tidak konsisten.
- First failure:
  - log event kegagalan
  - lanjut aman bila memungkinkan
- Repeated failure dalam cycle yang sama:
  - stop mengulangi action yang sama
  - tandai bahwa retry buta dilarang untuk cycle ini
- Repeated failure antar-cycle:
  - buat entri di `memory/skill-reflections.md`
  - sertakan skill terdampak, action gagal, pattern, impact, dan usulan perubahan workflow atau konfigurasi
- Gunakan `skill-vetter` sebelum mengadopsi skill eksternal atau integrasi baru.
- Jika skill dipakai pada fase ini, log usage dengan phase `System Health`.

## Reflection Rules

- Selalu inspect existing memory sebelum memanggil skill.
- Prefer updating atau extending hasil yang sudah ada daripada recreate.
- Jika sebuah skill gagal berulang, jangan ulangi tanpa perubahan input, context, atau workflow.
- Jika sebuah skill underused karena trigger heartbeat buruk, catat masalahnya di `memory/skill-reflections.md`.
- Jika pattern error atau quality issue berulang, usulkan improvement yang jelas di `memory/self-improvements.md`.

## Heartbeat State Tracking

Jika perlu menyimpan ringkasan heartbeat, gunakan `memory/heartbeat-state.json` dengan bentuk minimal seperti:

```json
{
  "last_cycle_id": null,
  "last_summary": null,
  "last_skill_report_at": null,
  "threads_api_active": true
}
```

## Logging Reminder

Saat skill dipakai, catat ke `memory/skill-usage.json` dengan field:

- `cycle_id`
- `phase`
- `skill`
- `action`
- `timestamp`
- `context`
- `metadata`

Gunakan helper:

```bash
node scripts/record-skill-usage.js --skill ContentEngine --action generate_post --phase "Marketing Operations" --cycle-id "2026-03-16T09:00" --context heartbeat --metadata "{\"drafts\":3}"
```
