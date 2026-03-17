const CTA_CONFIG = {
  audit: {
    keyword: 'audit',
    trigger: 'comment',
    intent: 'medium',
    notify: true,
    pillar: 'automation_audit',
    requestedAsset: 'audit_followup',
    followUpSuggestion: 'Kirim follow-up audit singkat dalam 12 jam jika belum ada balasan.',
    initialResponse: 'Siap. Saya bisa breakdown 3 bottleneck automation yang paling layak dibenahi dulu.',
  },
  calendar: {
    keyword: 'calendar',
    trigger: 'comment',
    intent: 'low_medium',
    notify: false,
    pillar: 'content_planning',
    requestedAsset: 'content_calendar',
    followUpSuggestion: 'Jika user engage lagi, upgrade intent menjadi medium dan tawarkan breakdown 7 hari.',
    initialResponse: 'Siap. Saya bisa kirim struktur 7 hari konten problem-first yang lebih rapi.',
  },
  system: {
    keyword: 'system',
    trigger: 'dm_or_comment',
    intent: 'high',
    notify: true,
    pillar: 'ai_system',
    requestedAsset: 'system_example',
    followUpSuggestion: 'Naikkan ke INTEREST dan follow up cepat dengan contoh sistem atau breakdown workflow.',
    initialResponse: 'Siap. Saya bisa tunjukkan contoh sistem sederhana: trigger, action, follow-up.',
  },
  funnel: {
    keyword: 'funnel',
    trigger: 'comment',
    intent: 'medium',
    notify: true,
    pillar: 'content_funnel',
    requestedAsset: 'funnel_template',
    followUpSuggestion: 'Jika ada pertanyaan implementasi, upgrade ke high intent.',
    initialResponse: 'Siap. Saya bisa kirim template pembagian konten per stage funnel.',
  },
  career: {
    keyword: 'career',
    trigger: 'dm',
    intent: 'medium',
    notify: false,
    pillar: 'career_growth',
    requestedAsset: 'career_skill_map',
    followUpSuggestion: 'Jika user minta bantuan untuk konteks kerja/bisnis, upgrade ke high intent.',
    initialResponse: 'Siap. Saya bisa kirim 3 skill AI yang paling cepat jadi nilai jual.',
  },
};

const FIRST_48H_POSTS = [
  {
    theme: 'AI automation',
    hookType: 'problem_first',
    ctaKeyword: 'audit',
    hook: 'Masalahnya bukan kurang tools AI. Masalahnya workflow kamu masih manual.',
    body: 'Kalau tiap hari masih copy-paste, cek inbox satu-satu, dan nulis ulang konten dari nol, bottleneck-nya ada di sistem kerja, bukan effort.',
    cta: 'Comment audit kalau mau saya kasih 3 area automation yang paling cepat dibenahi.',
  },
  {
    theme: 'digital marketing',
    hookType: 'problem_first',
    ctaKeyword: 'calendar',
    hook: 'Kalau kontenmu sepi, jangan langsung salahkan algoritma.',
    body: 'Seringnya problem ada di topik yang terlalu umum, hook yang lemah, atau CTA yang tidak meminta aksi spesifik.',
    cta: 'Comment calendar kalau mau saya buatkan struktur 7 hari konten problem-first.',
  },
  {
    theme: 'AI automation',
    hookType: 'problem_first',
    ctaKeyword: 'system',
    hook: 'Banyak bisnis kecil gagal pakai AI karena mulai dari prompt, bukan dari proses.',
    body: 'Prompt bagus tidak akan menolong kalau alur lead, follow-up, dan publishing masih acak. Urutannya harus proses dulu, baru AI.',
    cta: 'DM system kalau mau contoh alur sederhana yang bisa dipakai minggu ini.',
  },
  {
    theme: 'career advice',
    hookType: 'problem_first',
    ctaKeyword: 'career',
    hook: 'Career advice paling useless adalah "belajar AI". Yang benar: belajar bikin hasil dengan AI.',
    body: 'Perusahaan tidak butuh orang yang tahu tools. Mereka butuh orang yang bisa hemat waktu, bikin sistem, dan mempercepat output.',
    cta: 'DM career kalau mau saya kirim 3 skill AI yang paling cepat jadi nilai jual.',
  },
];

const GROWTH_TARGETS = {
  windowHours: 48,
  postsPublishedMin: 4,
  postsPublishedMax: 6,
  publishSuccessRate: 0.9,
  impressionsProxy: 200,
  outboundReplyProxy: 20,
  engagementRate: 0.02,
  comments: 5,
  leads: 2,
  ctaResponseRate: 0.3,
  dailyOutreachMinimum: 10,
  dailyRelevantPosts: 15,
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildContentText(post = {}) {
  const segments = [post.hook, post.body, post.cta].map(cleanText).filter(Boolean);
  return segments.join('\n\n');
}

function inferHookType(post = {}) {
  return post.hookType || (/masalah|gagal|sepi|manual/i.test(post.hook || '') ? 'problem_first' : 'educational');
}

function inferCtaKeyword(text = '') {
  const lower = cleanText(text).toLowerCase();
  return Object.keys(CTA_CONFIG).find((keyword) => lower.includes(keyword)) || null;
}

function inferIntentFromKeyword(keyword, channel = 'comment') {
  const config = CTA_CONFIG[keyword];
  if (!config) return channel === 'dm' ? 'medium' : 'low';
  return config.intent;
}

function mapIntentToStage(intent = 'low') {
  switch (intent) {
    case 'high':
      return 'INTEREST';
    case 'medium':
      return 'INTEREST';
    case 'low_medium':
      return 'AWARENESS';
    default:
      return 'AWARENESS';
  }
}

function normalizeScheduledPost(post = {}) {
  const content = cleanText(post.content || post.description || buildContentText(post.metadata || {}) || post.text || '');
  const scheduledFor = post.scheduledFor || post.scheduleAt || post.scheduledAt || null;
  const metadata = {
    ...(post.metadata || {}),
    topic: post.metadata?.topic || post.theme || post.metadata?.theme || null,
    hookType: post.metadata?.hookType || inferHookType(post.metadata || post),
    ctaKeyword: post.metadata?.ctaKeyword || post.ctaKeyword || inferCtaKeyword(post.content || post.description || ''),
  };

  return {
    ...post,
    id: post.id || post.draftId || `scheduled-${Date.now()}`,
    type: post.type || 'text',
    content,
    scheduledFor,
    status: post.status || 'pending',
    metadata,
  };
}

function getBestPostingTimes(performance = {}) {
  const slots = performance.bestPostingTimes || [];
  if (Array.isArray(slots) && slots.length > 0) return slots;
  return ['08:00 WIB', '12:30 WIB', '19:00 WIB'];
}

function parseSlotToDate(slot, dayOffset = 0, now = new Date()) {
  const match = String(slot).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const candidate = new Date(now);
  candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
  candidate.setUTCHours(Number(match[1]) - 7, Number(match[2]), 0, 0);
  return candidate;
}

function pickNextScheduleTime(existingQueue = [], performance = {}, now = new Date()) {
  const occupied = new Set(
    existingQueue
      .map((item) => normalizeScheduledPost(item).scheduledFor)
      .filter(Boolean)
      .map((value) => new Date(value).toISOString())
  );

  for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
    for (const slot of getBestPostingTimes(performance)) {
      const candidate = parseSlotToDate(slot, dayOffset, now);
      if (!candidate) continue;
      if (candidate.getTime() <= now.getTime() + 5 * 60 * 1000) continue;
      const iso = candidate.toISOString();
      if (!occupied.has(iso)) return iso;
    }
  }

  return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
}

function buildLeadFromSignal({ comment, keyword, existingLead, detectedAt = new Date().toISOString() }) {
  const config = CTA_CONFIG[keyword] || {};
  const channel = comment.channel || 'comment';
  const intent = inferIntentFromKeyword(keyword, channel);
  const stage = mapIntentToStage(intent);

  return {
    ...(existingLead || {}),
    id: existingLead?.id || comment.id,
    sourcePlatform: 'threads',
    sourceCommentId: comment.id,
    username: comment.username,
    message: comment.text,
    keyword,
    classification: comment.category || comment.classification || 'keyword_trigger',
    stage,
    followUpSuggestion: config.followUpSuggestion || 'Balas dengan langkah berikut yang konkret.',
    status: existingLead?.status || 'new',
    persona: existingLead?.persona || comment.persona || 'general_audience',
    intent,
    leadScore: existingLead?.leadScore || (intent === 'high' ? 0.9 : intent === 'medium' ? 0.72 : 0.55),
    createdAt: existingLead?.createdAt || detectedAt,
    updatedAt: detectedAt,
    channel,
    sourcePostId: comment.postId || null,
    sourceTopic: comment.postContext?.topic || comment.postContext?.title || null,
    lastActionAt: detectedAt,
    requestedAsset: config.requestedAsset || null,
    notify: Boolean(config.notify),
    initialResponse: config.initialResponse || null,
    pillar: config.pillar || null,
    followUpStatus: existingLead?.followUpStatus || 'pending',
  };
}

function classifyPostOutcome(post = {}, targets = GROWTH_TARGETS) {
  const comments = post.comments || 0;
  const leads = post.leadsCreated || 0;
  const engagementRate = post.engagementRate || 0;
  const impressions = post.impressions || post.impressionsProxy || 0;

  if (comments >= 2 || leads >= 1 || engagementRate >= targets.engagementRate) return 'keep';
  if (impressions > 0 || post.engagementEvents > 0) return 'tweak';
  return 'kill';
}

export {
  CTA_CONFIG,
  FIRST_48H_POSTS,
  GROWTH_TARGETS,
  buildContentText,
  buildLeadFromSignal,
  classifyPostOutcome,
  getBestPostingTimes,
  inferCtaKeyword,
  inferHookType,
  mapIntentToStage,
  normalizeScheduledPost,
  pickNextScheduleTime,
};
