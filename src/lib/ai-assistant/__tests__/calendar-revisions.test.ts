import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { bindCalendarRevisions } from '../calendar-revisions';
import type { AssistantContext } from '../access';
const ctx = {} as AssistantContext;
beforeEach(() => { vi.mocked(getResource).mockReset(); });
it('accepts equal ISO instants without refreshing a genuinely stale revision', async () => {
  vi.mocked(getResource).mockResolvedValue({ updatedAt: '2026-10-06T08:00:00.000Z' });
  const actions = await bindCalendarRevisions(ctx, [
    { kind: 'update_task', taskId: 't', status: 'open', expectedUpdatedAt: '2026-10-06T11:00:00+03:00' },
    { kind: 'update_task', taskId: 't', status: 'open', expectedUpdatedAt: '2026-10-06T07:00:00Z' },
  ]);
  expect(actions[0]).toHaveProperty('expectedUpdatedAt', '2026-10-06T08:00:00.000Z');
  expect(actions[1]).toHaveProperty('expectedUpdatedAt', '2026-10-06T07:00:00Z');
});
it('freezes existing task/viewing revisions once per target when preparing a plan', async () => {
  vi.mocked(getResource).mockResolvedValue({ updatedAt: '2026-10-06T08:00:00Z' });
  const actions = await bindCalendarRevisions(ctx, [
    { kind: 'update_task', taskId: 't', status: 'completed' },
    { kind: 'delete_task', taskId: 't' },
    { kind: 'update_viewing', viewingId: 'v', status: 'cancelled' },
  ]);
  expect(getResource).toHaveBeenCalledTimes(2);
  expect(actions.every(action => 'expectedUpdatedAt' in action && action.expectedUpdatedAt === '2026-10-06T08:00:00Z')).toBe(true);
});
it('preserves the revision displayed in an old form instead of silently refreshing it', async () => {
  const actions = await bindCalendarRevisions(ctx, [{ kind: 'delete_task', taskId: 't', expectedUpdatedAt: null }]);
  expect(actions[0]).toMatchObject({ expectedUpdatedAt: null });
  expect(getResource).not.toHaveBeenCalled();
});
it('guards legacy rows with null and does not read step references before creation', async () => {
  vi.mocked(getResource).mockResolvedValue({ description: 'Legacy task' });
  const actions = await bindCalendarRevisions(ctx, [{ kind: 'delete_task', taskId: 't' }, { kind: 'delete_task', taskId: '@step:1:taskId' }]);
  expect(actions[0]).toMatchObject({ expectedUpdatedAt: null });
  expect(actions[1]).not.toHaveProperty('expectedUpdatedAt');
  expect(getResource).toHaveBeenCalledTimes(1);
});
it('does not prepare a revision for an inaccessible record', async () => {
  vi.mocked(getResource).mockRejectedValue(new Error('Acces revocat'));
  await expect(bindCalendarRevisions(ctx, [{ kind: 'delete_viewing', viewingId: 'v' }])).rejects.toThrow('revocat');
});
