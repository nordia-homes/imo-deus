import { expect, it, vi } from 'vitest';
import { bindAgencyRevisions } from '../agency-revisions';
import type { AssistantContext } from '../access';
it('binds all agency steps to one snapshot while preserving explicit stale or null revisions', async () => {
  const get = vi.fn(async () => ({ exists: true, data: () => ({ updatedAt: '2026-10-06T10:00:00.000Z' }) }));
  const ctx = { agencyId: 'a', adminDb: { collection: () => ({ doc: () => ({ get }) }) } } as unknown as AssistantContext;
  const result = await bindAgencyRevisions(ctx, [{ kind: 'update_agency', patch: { themePreset: 'forest' } }, { kind: 'update_agency', patch: { name: 'Agency' } }, { kind: 'update_agency', patch: { name: 'Old' }, expectedUpdatedAt: null }]);
  expect(get).toHaveBeenCalledTimes(1);
  expect(result[0]).toMatchObject({ expectedUpdatedAt: '2026-10-06T10:00:00.000Z' });
  expect(result[1]).toMatchObject({ expectedUpdatedAt: '2026-10-06T10:00:00.000Z' });
  expect(result[2]).toMatchObject({ expectedUpdatedAt: null });
});
it('does not read agency data for unrelated commands or an already fixed revision', async () => {
  const ctx = {} as AssistantContext;
  expect(await bindAgencyRevisions(ctx, [{ kind: 'update_agency', patch: { name: 'Agency' }, expectedUpdatedAt: null }])).toHaveLength(1);
  expect(await bindAgencyRevisions(ctx, [{ kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01' }])).toHaveLength(1);
});
