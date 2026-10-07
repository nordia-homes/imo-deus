import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn() }));
vi.mock('../insight-feedback', () => ({ annotateInsightFeedback: vi.fn(async (_ctx: unknown, rows: unknown[]) => rows) }));
import { annotateInsightFeedback } from '../insight-feedback';
import { readResource } from '../access';
import { getInsights } from '../insights';
import type { AssistantContext } from '../access';
beforeEach(() => { vi.mocked(readResource).mockReset(); vi.mocked(annotateInsightFeedback).mockImplementation(async (_ctx, rows) => rows); });
it('applies feedback before the output limit and discloses bounded candidate coverage', async () => {
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => ({ rows: input.resource === 'tasks' ? Array.from({ length: 201 }, (_, i) => ({ id: `t${String(i).padStart(3, '0')}`, status: 'open', agentId: 'u', dueDate: '2020-01-01' })) : [], complete: true, nextCursor: null }));
  vi.mocked(annotateInsightFeedback).mockImplementation(async (_ctx, rows) => rows.map(row => row.taskId === 't199' ? { ...row, previousFeedback: 'useful', feedbackUpdatedAt: new Date().toISOString() } : row));
  const report = await getInsights({ uid: 'u' } as AssistantContext, 1);
  expect(report.rows[0]).toMatchObject({ taskId: 't199', priority: 80 });
  expect(report).toMatchObject({ actionableCount: 201, resultLimitReached: true, complete: true, feedbackRankingComplete: false, feedbackInspectedPriorities: 200 });
  expect(report.ranking).toContain('Personalizare parțială');
});
it.each(['resolved', 'spam', 'snoozed'])('excludes %s conversations even with stale needsReply', async status => {
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => ({ rows: input.resource === 'conversations' ? [{ id: 'c', status, needsReply: true, lastInboundAt: '2020-01-01' }] : [], complete: true, nextCursor: null }));
  expect((await getInsights({ uid: 'u' } as AssistantContext)).rows).toEqual([]);
});
it('finds an overdue task beyond the first UI page and reports output truncation separately', async () => {
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => {
    if (input.resource !== 'tasks') return { rows: [], complete: true, nextCursor: null };
    if (!input.cursor) return { rows: [{ id: 'first', status: 'completed' }], complete: false, nextCursor: 'page-two' };
    return { rows: [{ id: 'late1', status: 'open', agentId: 'u', dueDate: '2020-01-01' }, { id: 'late2', status: 'open', agentId: 'u', dueDate: '2020-01-02' }], complete: true, nextCursor: null };
  });
  const result = await getInsights({ uid: 'u' } as AssistantContext, 1);
  expect(result).toMatchObject({ complete: true, actionableCount: 2, resultLimitReached: true, inspectedRecords: 3 });
  expect(result.rows[0]).toMatchObject({ taskId: 'late1' });
  expect(readResource).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ resource: 'tasks', cursor: 'page-two' }));
});
it('ranks cross-module blockers before lower urgency and drops resolved conversations', async () => {
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => ({ rows: input.resource === 'sales' ? [{ id: 's', stage: 'blocked' }, { id: 'finished', stage: 'completed', nextActionAt: '2020-01-01' }] : input.resource === 'contacts' ? [{ id: 'c', status: 'Nou', createdAt: '2020-01-01' }] : input.resource === 'conversations' ? [{ id: 'replied', needsReply: true, lastInboundAt: '2020-01-01', lastOutboundAt: '2020-01-02' }, { id: 'pending', needsReply: true, lastInboundAt: '2020-01-01' }] : [], complete: true, nextCursor: null }));
  const report = await getInsights({ uid: 'u' } as AssistantContext, 2);
  expect(report.rows.map(row => row.id)).toEqual(['sale-s', 'reply-pending']);
  expect(report.actionableCount).toBe(3); expect(report.resultLimitReached).toBe(true);
  expect(report.sources).toContain('sales'); expect(report.coverage.conversations.complete).toBe(true);
  expect(report.rows.every(row => row.reason)).toBe(true);
});
it('detects a conflict once even when agent, client and property are all shared', async () => {
  const time = Date.now() + 86400000;
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => ({ rows: input.resource === 'viewings' ? ['a', 'b'].map((id, i) => ({ id, status: 'scheduled', agentId: 'u', contactId: 'c', propertyId: 'p', viewingDate: new Date(time + i * 60000).toISOString(), duration: 60 })) : [], complete: true, nextCursor: null }));
  const result = await getInsights({ uid: 'u' } as AssistantContext);
  expect(result.actionableCount).toBe(1); expect(result.rows[0]).toHaveProperty('viewingIds', ['a', 'b']);
});
