# Agent Observability

Claudia menggunakan observability berbasis memory agar penggunaan skill bisa diaudit tanpa keluar dari model OpenClaw.

## Skill Usage Logging

Skill usage dicatat ke `memory/skill-usage.json`.

Setiap event memakai schema:

```json
{
  "cycle_id": "2026-03-16T09:00",
  "phase": "Marketing Operations",
  "skill": "ContentEngine",
  "action": "generate_post",
  "timestamp": "2026-03-16T09:00:10.000Z",
  "context": "heartbeat",
  "metadata": {
    "drafts": 3
  }
}
```

## Record Skill Usage

Gunakan helper:

```bash
node scripts/record-skill-usage.js --skill ContentEngine --action generate_post --phase "Marketing Operations" --cycle-id "2026-03-16T09:00" --context heartbeat --metadata "{\"drafts\":3}"
```

Untuk PowerShell, lebih aman gunakan single quotes di sekitar JSON metadata:

```powershell
node scripts/record-skill-usage.js --skill ContentEngine --action generate_post --phase "Marketing Operations" --cycle-id "2026-03-16T09:00" --context heartbeat --metadata '{"drafts":3}'
```

Jika file log belum ada, script akan membuatnya dengan aman.

## Skill Health Report

Untuk audit cepat:

```bash
node scripts/skill-health-report.js
```

Report akan merangkum:

- usage per skill
- most used skills
- rarely used skills
- unused skills
- phases with no skill activity
- repeated failures jika disimpan di metadata/status

## HEARTBEAT and Autonomy

Autonomi resmi Claudia tetap mengikuti filosofi OpenClaw:

`heartbeat -> HEARTBEAT.md -> agent reasoning -> skill usage`

Tidak ada daemon atau runtime custom tambahan. `HEARTBEAT.md` adalah sumber aturan operasional, sedangkan script hanya alat bantu yang dipanggil agent saat reasoning.

## Memory-First Reasoning

Claudia harus memeriksa memory sebelum memanggil skill:

- cek `memory/marketing-insights.json` sebelum `MarketingIntelligence`
- cek `memory/content-drafts/` sebelum `ContentEngine`
- cek `memory/leads.json` dan `memory/sales-funnel.json` sebelum `SalesManager`

Preferensi utama:

1. inspect existing memory
2. extend/update if still relevant
3. regenerate only if data stale, missing, or contradicted

## Reflection and Meta-Skills

Meta-skill seperti `self-improving-agent`, `proactive-agent`, `skill-vetter`, dan `ontology` tidak dijalankan sebagai background process. Mereka diaktifkan oleh reasoning agent saat heartbeat reflection phase mendeteksi kebutuhan.

Refleksi disimpan di:

- `memory/skill-reflections.md`
- `memory/self-improvements.md`

Jika sebuah skill gagal berulang:

1. catat pattern-nya
2. hentikan blind retry dalam cycle yang sama
3. usulkan perubahan workflow atau trigger
