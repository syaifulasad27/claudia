# Learnings Log

Captured learnings, corrections, and discoveries. Review before major tasks.

---

## 2026-03-07 — User Rule Update (Self-Improvement Logging Mandatory)
- Trigger: Tuan instructed that every error/correction/missing-feature must be logged to `.learnings`.
- New mandatory behavior:
  - User correction -> `.learnings/LEARNINGS.md`
  - Tool/command failure -> `.learnings/ERRORS.md`
  - Missing capability request -> `.learnings/FEATURE_REQUESTS.md`
- Implementation note: treat this as non-optional workflow after each relevant event.

## 2026-03-07 — Learning Rule: Nightly Evaluation Reminder Must Be Logged
- User correction: the 21:00 WIB Threads evaluation workflow must also be explicitly logged in `.learnings` as an active recurring responsibility.
- Operational commitment: keep this nightly cron purpose visible in learning memory and treat missed/incorrect evaluation as a learning/error event.

## [2026-03-07T10:53:07.861Z] Auto-pipeline enabled
Self-improvement auto-log pipeline aktif untuk reply/monitor events

## 2026-03-07 — User Correction: Comment Replies Still Not Natural/Contextual Enough
- Feedback: Replies are still less natural and not sufficiently aligned with both comment context and original post context.
- Required adjustment:
  1) Build reply from BOTH post text + commenter intent (not generic template first).
  2) Prefer short, human phrasing for non-question comments.
  3) Avoid robotic transitions; mirror commenter wording lightly.
  4) Add a final contextual check before proposing approval draft.

## 2026-03-07 — User Directive: Record All Evaluations
- Instruction: Ensure all evaluations are consistently documented.
- Scope includes:
  - Daily content evaluation outputs (quant + qualitative + action plan)
  - User feedback/corrections on content quality
  - Reply-context quality issues and fixes
- Commitment: after each evaluation cycle, write concise record to `.learnings` and relevant daily memory log.

## 2026-03-07 — Progress Update: Next Step Implementation
- Implemented context-layer improvement for comments:
  - comment-fetcher now stores `postContext.url` + `threadContext` (existingReplyCount, latestReplyText, latestReplyAt)
  - stricter `ai_accusation` detector to reduce false positives
  - smart-reply-generator now consumes threadContext and shortens generic follow-up replies when thread already has replies
- Validation run:
  - comment-fetcher: success (no runtime error)
  - smart-reply-generator: success (no runtime error)

## 2026-03-11 — User Feedback: Fresh != Engaging
- Correction from Tuan: replacing with new text is not enough; content still not attractive.
- Required behavior update:
  1) Prioritize engagement strength (hook conflict + personal stakes + forced opinion) over mere non-duplication.
  2) Drafts must be tested against “comment trigger” criteria before scheduling.
  3) If engagement risk is high, propose stronger alternatives before posting.

## 2026-03-11 — Real-time Learning Mandate (User Directive)
- Instruction from Tuan: learning must happen continuously in real-time.
- Enforcement rule:
  1) Every correction/error/missing-feature event must be logged immediately (not batched).
  2) Before sending operational replies, check latest relevant `.learnings` entries.
  3) Treat repeated mistakes as escalation-level failures and report root cause + prevention update.

## 2026-03-12 — Core Behavior Mandate from Tuan
- Tuan menetapkan 4 core behavior permanen: skill-vetter, ontology, self-improving-agent, proactive-agent.
- Prioritas konflik yang wajib diikuti:
  1) instruksi user
  2) skill-vetter/keamanan
  3) objective tugas
  4) ontology
  5) self-improving-agent
  6) proactive-agent
- Operational mapping di workspace saat ini:
  - skill-vetter -> pre-check risiko sebelum perubahan sistem/cron/repo/otomasi
  - ontology -> MEMORY.md + memory/*.md (fakta stabil/pola terverifikasi)
  - self-improving-agent -> .learnings/* real-time per event
  - proactive-agent -> usulan next-step bernilai, non-intrusif, tanpa override user
- Rule enforcement: aktif langsung untuk semua tugas berikutnya.
