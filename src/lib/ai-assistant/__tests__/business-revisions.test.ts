import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { bindBusinessRevisions } from '../business-revisions';
import type { AssistantContext } from '../access';
const ctx = {} as AssistantContext;
beforeEach(() => vi.mocked(getResource).mockReset());
it('binds floor-plan replacement and property editing to one shared snapshot', async () => {
  vi.mocked(getResource).mockResolvedValue({ updatedAt: '2026-10-06T10:00:00Z' });
  const actions = await bindBusinessRevisions(ctx, [{ kind: 'update_property', propertyId: 'p', patch: { price: 130000 } }, { kind: 'existing_operation', operation: 'file_apply', params: { uploadId: 'upload' }, query: {}, body: { destination: 'property_rlv', propertyId: 'p' } }]);
  expect(getResource).toHaveBeenCalledTimes(1);
  expect(actions[1]).toMatchObject({ body: { expectedUpdatedAt: '2026-10-06T10:00:00Z' } });
});
it('preserves supplied floor-plan revisions and defers new property references', async () => {
  const actions = await bindBusinessRevisions(ctx, [null, '2020-01-01T10:00:00Z', undefined].map((expectedUpdatedAt, index) => ({ kind: 'existing_operation' as const, operation: 'file_apply', params: { uploadId: 'upload' }, query: {}, body: { destination: 'property_rlv', propertyId: index === 2 ? '@step:1:propertyId' : 'p', ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}) } })));
  expect(getResource).not.toHaveBeenCalled();
  expect(actions[0]).toMatchObject({ body: { expectedUpdatedAt: null } });
  expect(actions[1]).toMatchObject({ body: { expectedUpdatedAt: '2020-01-01T10:00:00Z' } });
  expect(actions[2]).not.toHaveProperty('body.expectedUpdatedAt');
});
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

it('binds destructive and lifecycle commands to shared parent revisions', async () => {
  vi.mocked(getResource).mockResolvedValue({ updatedAt: '2026-10-06T10:00:00Z' });
  const actions = await bindBusinessRevisions(ctx, [
    { kind: 'update_offer', contactId: 'c', offerId: 'o', patch: { price: 120000 } },
    { kind: 'delete_offer', contactId: 'c', offerId: 'o' },
    { kind: 'assign_record', resource: 'contacts', id: 'c', agentId: null },
    { kind: 'archive_contact', contactId: 'c', archived: true },
    { kind: 'portal_action', contactId: 'c', action: 'deactivate' },
    { kind: 'activate_property', propertyId: 'p' },
    { kind: 'update_property_status', propertyId: 'p', status: 'Inactiv', notes: '' },
    { kind: 'contract_template_action', action: 'delete', templateId: 't' },
  ]);
  expect(getResource).toHaveBeenCalledTimes(3);
  expect(actions.every(action => 'expectedUpdatedAt' in action && action.expectedUpdatedAt === '2026-10-06T10:00:00Z')).toBe(true);
});
