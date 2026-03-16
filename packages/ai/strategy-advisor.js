export function adviseStrategy({ goals = {}, metrics = {}, learning = {}, audienceSignals = {} }) {
  const goalCfg = goals.monthly_goals || {};
  const engagementGap = (goalCfg.engagement_rate || 0) - (metrics.engagement_rate || 0);
  const leadGap = (goalCfg.new_leads || 0) - (metrics.new_leads || 0);
  const postGap = (goalCfg.content_posts || 0) - (metrics.content_posts || 0);

  let primaryObjective = 'awareness';
  if (leadGap > 0) primaryObjective = 'lead_generation';
  if (engagementGap > 0.01 && engagementGap * 100 > leadGap / Math.max(goalCfg.new_leads || 1, 1)) primaryObjective = 'engagement_recovery';
  if ((metrics.conversion_rate || 0) < 0.05 && (metrics.new_leads || 0) > 0) primaryObjective = 'conversion_follow_up';

  const secondaryObjective = primaryObjective === 'lead_generation' ? 'engagement_recovery' : 'lead_generation';

  return {
    primaryObjective,
    secondaryObjective,
    strategyAdjustments: {
      focusThemes: audienceSignals.topPersonas?.slice(0, 2) || learning.risingThemes || [],
      ctaEmphasis: leadGap > 0 ? 'high' : 'balanced',
      contentFrequency: postGap > 0 ? 'increase' : 'steady',
      recommendedFormats: learning.topFormats || ['short_post', 'carousel'],
    },
    rationale: { leadGap, engagementGap, postGap },
  };
}
