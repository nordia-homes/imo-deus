import { describe, expect, it } from 'vitest';
import { rankInsightFeedback } from '../insight-ranking';
const now = Date.parse('2026-10-07T10:00:00Z');
const card = (id: string, priority: number, previousFeedback?: string, at = now) => ({ id, priority, previousFeedback, feedbackUpdatedAt: new Date(at).toISOString() });
describe('bounded feedback tie-breaking', () => {
  it('reorders equal urgency without changing scores or dropping rows', () => {
    const rows = [card('a', 80, 'not_useful'), card('b', 80), card('c', 80, 'useful')];
    const result = rankInsightFeedback(rows, now);
    expect(result.map(row => row.id)).toEqual(['c', 'b', 'a']);
    expect(result.every(row => row.priority === 80)).toBe(true);
    expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
    expect(result[0].feedbackNote).toContain('Problema rămâne activă');
  });
  it('never promotes a lower urgency above a higher urgency', () => {
    expect(rankInsightFeedback([card('a', 70, 'useful'), card('b', 80, 'not_useful'), card('c', 85, 'not_useful')], now).map(row => row.id)).toEqual(['c', 'b', 'a']);
  });
  it.each([90, 95, 100])('ignores feedback for protected urgency %s', priority => {
    const result = rankInsightFeedback([card('b', priority, 'useful'), card('a', priority, 'not_useful')], now);
    expect(result.map(row => row.id)).toEqual(['a', 'b']);
    expect(result.every(row => row.feedbackOrder === 0)).toBe(true);
    expect(result[0].feedbackNote).toContain('incidentelor urgente');
  });
  it('expires exactly at 30 days, rejecting future or invalid dates as ranking evidence', () => {
    const cutoff = now - 30 * 86400000;
    const result = rankInsightFeedback([card('d', 80, 'useful', cutoff), card('c', 80, 'useful', cutoff + 1), card('b', 80, 'useful', now + 1), { ...card('a', 80, 'not_useful'), feedbackUpdatedAt: 'invalid' }], now);
    expect(result.map(row => row.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(result.find(row => row.id === 'd')?.feedbackNote).toContain('30 de zile');
  });
  it('keeps deterministic ID order with equal feedback and treats unknown values as neutral', () => {
    expect(rankInsightFeedback([card('b', 80, 'useful'), card('a', 80, 'useful'), card('c', 80, 'unknown')], now).map(row => row.id)).toEqual(['a', 'b', 'c']);
  });
});
