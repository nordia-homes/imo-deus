import { expect, it } from 'vitest';
import { socialPerformanceMetrics, socialPerformanceRequest } from '../social-performance';
it('recognizes comparison without consuming publishing commands', () => {
  expect(socialPerformanceRequest('Compară performanța postărilor disponibile.')).toBe(true);
  expect(socialPerformanceRequest('Publică postarea.')).toBe(false);
});
it('preserves zero while treating missing, negative and invalid counts as unknown', () => {
  expect(socialPerformanceMetrics('messenger', { likes: { summary: { total_count: 0 } }, comments: { summary: { total_count: -1 } }, shares: { count: '10' } })).toEqual({ likes: 0, comments: null, shares: null });
  expect(socialPerformanceMetrics('instagram', { like_count: 12, comments_count: 3, shares: { count: 900 } })).toEqual({ likes: 12, comments: 3, shares: null });
  expect(socialPerformanceMetrics('instagram', { like_count: 1.5, comments_count: Infinity })).toEqual({ likes: null, comments: null, shares: null });
});