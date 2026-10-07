export const FEEDBACK_CANDIDATE_LIMIT = 200;
const FEEDBACK_MAX_AGE_MS = 30 * 86400000;

// Feedback only breaks ties within an existing, non-critical urgency score.
export function rankInsightFeedback(rows: Record<string, unknown>[], now = Date.now()) {
  const ranked = rows.map<Record<string, unknown> & { feedbackOrder: number }>(row => {
    const at = Date.parse(String(row.feedbackUpdatedAt || ''));
    const eligible = Number(row.priority) < 90 && Number.isFinite(at) && at <= now && at > now - FEEDBACK_MAX_AGE_MS;
    const feedbackOrder = eligible && row.previousFeedback === 'useful' ? 1 : eligible && row.previousFeedback === 'not_useful' ? -1 : 0;
    const explanation = !row.previousFeedback ? null : Number(row.priority) >= 90
      ? 'Evaluarea nu schimbă ordinea incidentelor urgente.'
      : !eligible ? 'Evaluarea nu schimbă ordinea: numai feedbackul din ultimele 30 de zile este folosit.'
        : 'La aceeași urgență, prioritățile evaluate utile apar înaintea celor neevaluate, apoi cele evaluate neutile. Problema rămâne activă.';
    return { ...row, feedbackOrder, ...(explanation ? { feedbackNote: `Evaluare anterioară: ${row.previousFeedback === 'useful' ? 'utilă' : 'neutilă'}. ${explanation}` } : {}) };
  });
  return ranked.sort((a, b) => Number(b.priority) - Number(a.priority) || b.feedbackOrder - a.feedbackOrder || String(a.id).localeCompare(String(b.id)));
}
