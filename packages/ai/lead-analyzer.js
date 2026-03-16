const purchaseMatchers = /(price|harga|biaya|paket|join|daftar|demo|consult|konsultasi|jasa|service|beli|order)/i;
const comparisonMatchers = /(vs|banding|compare|lebih bagus|beda)/i;
const skepticalMatchers = /(scam|yakin|beneran|worth it|apakah berhasil)/i;

export function analyzeLead({ commentText = '', persona = {}, pastInteractions = [] }) {
  const text = String(commentText || '');
  const intent = purchaseMatchers.test(text)
    ? 'purchase_intent'
    : comparisonMatchers.test(text)
      ? 'comparison_intent'
      : skepticalMatchers.test(text)
        ? 'skeptical_intent'
        : 'learning_intent';

  const leadScore = purchaseMatchers.test(text) ? 0.88 : comparisonMatchers.test(text) ? 0.68 : 0.35;
  const recommendedStage = leadScore >= 0.8 ? 'CONSIDERATION' : leadScore >= 0.55 ? 'INTEREST' : 'AWARENESS';

  return {
    leadScore,
    intent,
    personaMatch: persona.persona || 'general_audience',
    recommendedStage,
    followUpSuggestion: leadScore >= 0.8
      ? 'Tawarkan langkah berikut yang konkret: demo, DM, atau link penawaran.'
      : 'Beri edukasi singkat lalu ajak diskusi lebih lanjut.',
    priorInteractionCount: pastInteractions.length,
  };
}
