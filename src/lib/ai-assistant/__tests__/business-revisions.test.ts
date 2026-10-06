import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { bindBusinessRevisions } from '../business-revisions';
import type { AssistantContext } from '../access';
const ctx = {} as AssistantContext;
beforeEach(() => vi.mocked(getResource).mockReset());
it('binds contact/preferences/property plans to the displayed records, reading each target once', async () => {
  vi.mocked(getResource).mockResolvedValue({ updatedAt: '2026-10-06T10:00:00Z' });
  const actions = await bindBusinessRevisions(ctx, [{ kind: 'update_contact', contactId: 'c', patch: { name: 'Client' } }, { kind: 'update_preferences', contactId: 'c', preferences: { desiredRooms: 2 } }, { kind: 'update_property', propertyId: 'p', patch: { price: 130000 } }]);
  expect(getResource).toHaveBeenCalledTimes(2);
  expect(actions.every(action => 'expectedUpdatedAt' in action && action.expectedUpdatedAt === '2026-10-06T10:00:00Z')).toBe(true);
});
it('preserves explicit stale revisions, guards legacy records and leaves newly created step targets unresolved', async () => {
  vi.mocked(getResource).mockResolvedValue({ name: 'Legacy' });
  const actions = await bindBusinessRevisions(ctx, [{ kind: 'update_contact', contactId: 'c', expectedUpdatedAt: '2020-01-01T10:00:00Z', patch: { name: 'Client' } }, { kind: 'update_preferences', contactId: 'legacy', preferences: { desiredRooms: 2 } }, { kind: 'update_property', propertyId: '@step:1:propertyId', patch: { price: 100000 } }]);
  expect(actions[0]).toMatchObject({ expectedUpdatedAt: '2020-01-01T10:00:00Z' }); expect(actions[1]).toMatchObject({ expectedUpdatedAt: null }); expect(actions[2]).not.toHaveProperty('expectedUpdatedAt');
  expect(getResource).toHaveBeenCalledTimes(1);
});
