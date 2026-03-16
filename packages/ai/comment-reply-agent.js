export function draftReply({ comment = {}, persona = {}, leadAnalysis = {}, productContext = {}, salesContext = {} }) {
  const baseName = persona.persona || 'teman';
  const productLabel = productContext.name || 'layanan ini';
  const stage = leadAnalysis.recommendedStage || 'AWARENESS';
  let reply = '';

  switch (comment.classification) {
    case 'product_question':
      reply = `Pertanyaan bagus. Untuk ${baseName}, fokus utamanya biasanya hasil yang ingin dicapai dulu, baru pilih format ${productLabel} yang paling relevan.`;
      break;
    case 'potential_lead':
      reply = `Masuk banget. Dari kebutuhanmu, sepertinya kamu sudah dekat ke tahap ${stage.toLowerCase()}. Kalau mau, saya bisa bantu arahkan opsi yang paling realistis.`;
      break;
    case 'complaint':
      reply = 'Terima kasih sudah jujur menyampaikan ini. Saya tangkap concern-nya dan lebih baik kita luruskan poin yang paling mengganggu dulu tanpa muter-muter.';
      break;
    case 'spam':
      reply = '';
      break;
    default:
      reply = `Setuju, dan itu memang nyambung ke problem yang sering dialami ${baseName}. Yang paling penting sekarang adalah langkah praktis yang bisa langsung dipakai.`;
      break;
  }

  const cta = comment.classification === 'complaint'
    ? 'Kalau kamu mau, jelaskan detailnya dan saya bantu jawab setepat mungkin.'
    : leadAnalysis.leadScore >= 0.8
      ? 'Kalau mau breakdown yang lebih spesifik, lanjut lewat DM juga boleh.'
      : 'Kalau ada bagian yang ingin didalami, tulis di komentar ya.';

  return {
    reply: `${reply} ${cta}`.trim(),
    cta,
    escalationFlags: {
      complaint: comment.classification === 'complaint',
      highIntentLead: leadAnalysis.leadScore >= 0.8,
    },
    funnelStage: salesContext.stage || leadAnalysis.recommendedStage || 'AWARENESS',
  };
}
