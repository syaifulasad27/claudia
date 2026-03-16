function buildHooks(theme, persona) {
  return [
    `Kenapa ${theme} penting buat ${persona}?`,
    `${persona}: 3 langkah praktis untuk ${theme}`,
    `Kalau kamu masih bingung soal ${theme}, mulai dari sini`,
  ];
}

export function writeContent({ strategy = {}, persona = {}, opportunity = {}, learning = {} }) {
  const theme = opportunity.theme || strategy.core_topics?.[0] || 'digital marketing';
  const personaName = persona.persona || 'audience utama';
  const hooks = buildHooks(theme, personaName);
  const winningCta = learning.topCtaStyles?.[0] || 'Ajak diskusi via komentar atau DM.';
  const post = {
    type: 'short_post',
    theme,
    persona: personaName,
    hook: hooks[0],
    body: `${personaName} biasanya struggle di ${persona.pain_points?.[0] || theme}. Fokus konten ini adalah langkah yang realistis, singkat, dan bisa langsung dicoba hari ini.`,
    cta: winningCta,
    variants: {
      hooks,
      ctas: [winningCta, 'Tulis pertanyaanmu di komentar.', 'Kalau mau template-nya, DM saya.'],
    },
  };

  return {
    posts: [post],
    carousel: {
      title: `${theme} untuk ${personaName}`,
      slides: ['Masalah utama', 'Kenapa ini sering gagal', 'Framework sederhana', 'Contoh praktis', 'CTA'],
    },
    salesCopy: {
      headline: `${theme} yang lebih terukur untuk ${personaName}`,
      bullets: [
        `Menjawab pain point: ${persona.pain_points?.[0] || theme}`,
        'Fokus pada hasil dan langkah praktis',
        'Cocok untuk funnel awareness sampai conversion',
      ],
      cta: winningCta,
    },
  };
}
