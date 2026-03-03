# Comment Monitoring & Reply Approval System
## @notesbyclaudia — Human-in-the-Loop Workflow

---

## 🎯 Konsep Utama

**"Monitor → Draft → Approve → Publish"**

Claudia melihat semua komentar → Generate draft reply → Kirim ke Tuan untuk approval → Publish hanya jika approved.

---

## 📊 Workflow Lengkap

```
Cron: Setiap 30 menit
    ↓
Fetch Comments dari Repliz API
    ↓
Filter System (Auto-skip spam/foreign chars)
    ↓
Priority Queue (Perlu reply?)
    ↓
Draft Reply (Claudia AI)
    ↓
NOTIF to TUAN (Telegram DM)
[✅ Approve] [✏️ Edit] [❌ Reject] [⏭️ Skip]
    ↓
    ├─ Approve → Publish Reply
    ├─ Edit → Revise → Approve
    └─ Reject → Archive Skip
```

---

## 🔧 5 Komponen Sistem

### 1. Comment Fetcher (`comment-fetcher.js`)
- **Jalankan:** Setiap 30 menit via cron
- **Tugas:** GET `/queue` dari Repliz API, parse komentar baru
- **Filter:** Auto-skip foreign chars, spam, trolling
- **Output:** `state/pending-comments.json`

### 2. Reply Drafter (`reply-drafter.js`)
- **Jalankan:** Setelah comment-fetcher
- **Tugas:** Generate draft reply untuk setiap komentar
- **Style:** Jaksel dialect, helpful, elegant

**Kategori Reply:**
| Kategori | Style |
|----------|-------|
| Pertanyaan Teknikal | Edukatif, specific |
| AI Accusation | Humor elegant, deflect |
| Ucapan Terima Kasih | Warm, humble |
| Kritik/Skeptis | Professional, respectful |

### 3. Notifikasi System (`notify-tuan.js`)
- **Jalankan:** Setelah reply-drafter
- **Tugas:** Kirim Telegram DM ke Tuan
- **Format:** Comment + Draft Reply + Action Buttons

**Tombol Aksi:**
- ✅ **Approve** → Publish reply
- ✏️ **Edit** → Tuan revise text
- ❌ **Reject** → Skip komentar
- ⏭️ **Skip** → Tunda 1 jam

### 4. Approval Handler (`approval-handler.js`)
- **Jalankan:** Real-time listener atau cron 5 menit
- **Tugas:** Tangkap respon Tuan, proses aksi
- **Timeout:** 4 jam (auto-expire jika no response)

### 5. Publisher (`reply-publisher.js`)
- **Jalankan:** Saat approved
- **Tugas:** POST reply ke Repliz API
- **Verify:** Log engagement

---

## 📋 Priority Classification

| Priority | Criteria | Response Time |
|----------|----------|---------------|
| 🔴 **HIGH** | AI accusation, technical question | < 1 jam |
| 🟡 **MEDIUM** | General question, appreciation | < 4 jam |
| 🟢 **LOW** | Simple thanks, casual chat | < 24 jam |
| ⚫ **SKIP** | Foreign chars, spam, trolling | Auto-skip |

---

## 🚀 Phase Implementasi (Bertahap)

### **Phase 1: Fetcher + Filter** (Hari 1)
- Buat `comment-fetcher.js`
- Setup cron 30 menit
- Test: Bisa ambil komentar dari Repliz?
- Output: Log ke file (belum reply)

### **Phase 2: Draft Generator** (Hari 2)
- Tambah `reply-drafter.js`
- Generate draft reply
- Kategorikan: question/AI accusation/thanks
- Simpan ke `draft-replies.json`

### **Phase 3: Telegram Notif** (Hari 3)
- Setup `notify-tuan.js`
- Kirim DM dengan format:
  ```
  💬 Comment dari @username: "..."
  ✍️ Draft Reply: "..."
  [✅ Approve] [✏️ Edit] [❌ Reject]
  ```

### **Phase 4: Approval Handler** (Hari 4)
- Setup `approval-handler.js`
- Tangkap tombol klik dari Tuan
- Integrasi dengan publisher

### **Phase 5: Full Integration** (Hari 5)
- Connect semua komponen
- Testing end-to-end
- Monitor 24 jam

---

## 🛡️ Safety & Filter

### Auto-Skip (No Draft, No Notif)
- Foreign characters (Chinese, Japanese, Arabic, etc.)
- Spam keywords ("check my bio", "DM for signal")
- Excessive emoji (>5 consecutive)
- Profanity/toxic

### Auto-Flag (Priority HIGH)
- Contains "bot", "AI", "robot" → AI accusation handler
- Contains "?" → Question
- Negative sentiment → Handle with care

---

## 📱 Contoh Notifikasi ke Tuan

```
💬 Komentar baru dari @trader_jakarta:
"Kak, cara hitung ATR gimana?"

✍️ Draft Reply Claudia:
"Jujurly ATR itu basically rata-rata range candle..."

[✅ Approve] [✏️ Edit] [❌ Reject] [⏭️ Skip]
```

---

## ✅ Next Step

**Tuan pilih:**

**A. Mulai Phase 1 sekarang** (Setup fetcher + filter)
**B. Tuan review plan lengkap dulu** (baca file ini, kasih feedback)
**C. Modifikasi plan** (Tuan minta perubahan workflow)

---

*Plan siap, menunggu go-ahead untuk eksekusi Phase 1.* 🎯
