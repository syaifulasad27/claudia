# Skill Reflections

File ini digunakan Claudia untuk refleksi kualitas skill selama heartbeat OpenClaw.

## Kapan memperbarui file ini

- Saat sebuah skill gagal berulang
- Saat output skill terasa lemah, tidak relevan, atau tidak membantu objective
- Saat HEARTBEAT menunjukkan sebuah skill underused karena trigger-nya buruk
- Saat workflow perlu diubah agar skill lebih efektif

## Aturan refleksi

1. Catat skill yang bermasalah dan action yang gagal.
2. Jangan ulangi action yang sama secara buta di cycle yang sama jika sudah gagal berulang.
3. Jika failure berulang antar-cycle, usulkan perubahan workflow, trigger, input memory, atau kualitas data.
4. Jika output lemah, jelaskan apakah masalahnya ada di:
   - trigger HEARTBEAT
   - kualitas input memory
   - kontrak output skill
   - strategy/prompt/reasoning

## Template Entry

```markdown
## [ISO_DATE] Skill Reflection
- Skill:
- Action:
- Failure Pattern / Weak Output:
- Impact:
- Suggested Improvement:
- Next Heartbeat Rule:
```
