export function analyzeTrends({ insights = [], audienceSignals = {}, contentPerformance = {} }) {
  const prioritized = insights
    .map((item) => ({
      theme: item.theme,
      score: (item.opportunityScore || 0) + (audienceSignals.topicFrequencies?.[item.theme] || 0),
      rationale: item.rationale,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    prioritizedThemes: prioritized.slice(0, 5),
    opportunities: prioritized.slice(0, 3),
    risks: contentPerformance.lowPerformingThemes || [],
    recommendedAngle: prioritized[0]?.theme || 'audience education',
  };
}
