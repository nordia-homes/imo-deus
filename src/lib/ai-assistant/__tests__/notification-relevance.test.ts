import { describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({
  collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`),
  canReadResource: (_ctx: any, _resource: string, row: any) => row.allowed !== false,
}));
import { reconcileRuleNotifications } from '../notification-relevance';

function fixture() {
  const notification = { type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', sourceEventId: 'e', ruleCondition: { resource: 'contacts', id: 'c', status: 'Contactat' }, isRead: false, title: 'Client contactat' };
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['users/u/notifications/n', notification], ['agencies/a/contacts/c', { status: 'Contactat' }]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (callback: any) => callback({
    get: async (r: any) => ({ exists: rows.has(r.path), data: () => rows.get(r.path) }),
    update: (r: any, patch: any) => rows.set(r.path, { ...rows.get(r.path), ...patch }),
  }) };
  return { rows, notification, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any };
}
describe('rule notification relevance', () => {
  it.each(['state_changed', 'entity_deleted', 'access_revoked'])('withdraws once for %s and preserves the original notification', async reason => {
    const { rows, notification, ctx } = fixture();
    if (reason === 'entity_deleted') rows.delete('agencies/a/contacts/c');
    else rows.set('agencies/a/contacts/c', { status: reason === 'state_changed' ? 'Câștigat' : 'Contactat', allowed: reason !== 'access_revoked' });
    expect(await reconcileRuleNotifications(ctx, { ids: ['n', 'n'] })).toEqual({ checked: 1, withdrawn: 1 });
    const saved = rows.get('users/u/notifications/n');
    expect(saved).toMatchObject({ ...notification, isRead: true, withdrawalReason: reason, withdrawnAt: expect.any(String) });
    rows.set('agencies/a/contacts/c', { status: 'Contactat' });
    expect(await reconcileRuleNotifications(ctx, { ids: ['n'] })).toEqual({ checked: 1, withdrawn: 0 });
    expect(rows.get('users/u/notifications/n')).toEqual(saved);
  });
  it.each([{}, { type: 'task' }, { recipientId: 'other' }, { agencyId: 'other' }, { ruleCondition: undefined }, { ruleCondition: { resource: 'users', id: 'c', status: 'Contactat' } }, { automationId: undefined }, { sourceEventId: undefined }])('preserves relevant, legacy or incompatible notifications: %j', async patch => {
    const { rows, notification, ctx } = fixture();
    rows.set('users/u/notifications/n', { ...notification, ...patch });
    if (Object.keys(patch).length) rows.delete('agencies/a/contacts/c');
    expect((await reconcileRuleNotifications(ctx, { ids: ['n', 'missing'] })).withdrawn).toBe(0);
    expect(rows.get('users/u/notifications/n').withdrawnAt).toBeUndefined();
  });
  it.each([{ agencyId: 'other', role: 'agent' }, { agencyId: 'a', role: 'admin' }, undefined])('refuses changed membership: %j', async member => {
    const { rows, ctx } = fixture(); rows.set('users/u', member);
    await expect(reconcileRuleNotifications(ctx, { ids: ['n'] })).rejects.toMatchObject({ status: 403 });
    expect(rows.get('users/u/notifications/n').withdrawnAt).toBeUndefined();
  });
  it.each([{ ids: [] }, { ids: ['../other/n'] }, { ids: Array(101).fill('n') }, { ids: ['n'], agencyId: 'other' }])('rejects unsafe or unbounded input: %j', async input => {
    await expect(reconcileRuleNotifications(fixture().ctx, input)).rejects.toThrow();
  });
});
