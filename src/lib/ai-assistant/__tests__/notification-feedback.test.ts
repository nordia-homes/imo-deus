import { describe, expect, it } from 'vitest';
import { saveNotificationFeedback } from '../notification-feedback';

function fixture() {
  const notification = { type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', insightCondition: { kind: 'task', id: 't' }, isRead: false };
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['users/u/notifications/n', notification]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  let writes = 0;
  const db = { collection: ref, runTransaction: async (callback: any) => callback({ get: async (r: any) => ({ data: () => rows.get(r.path) }), set: (r: any, value: any) => rows.set(r.path, value), update: (r: any, patch: any) => { writes++; rows.set(r.path, { ...rows.get(r.path), ...patch }); } }) };
  return { rows, notification, writes: () => writes, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any };
}
const input = { notificationId: 'n', value: 'useful', expectedRevision: 0 };
describe('notification feedback', () => {
  const watchConditions = [
    { matchingCondition: { contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) } },
    { ownerWatchCondition: { listingId: 'p', search: { source: 'owners', transactionType: 'sale' } } },
  ];
  it.each(watchConditions)('saves watch feedback without changing ranking or business state: %j', async condition => {
    const f = fixture();
    f.rows.set('users/u/notifications/n', { ...f.notification, insightCondition: undefined, ...condition, withdrawnAt: '2026-10-07T10:00:00Z', isRead: true });
    const before = f.rows.get('users/u/notifications/n');
    const first = await saveNotificationFeedback(f.ctx, input);
    expect(await saveNotificationFeedback(f.ctx, input)).toEqual(first);
    expect(f.writes()).toBe(1);
    expect(f.rows.size).toBe(3); // Separate watch projection, never insight ranking.
    await expect(saveNotificationFeedback(f.ctx, { ...input, value: 'not_useful' })).rejects.toMatchObject({ status: 409 });
    const revised = await saveNotificationFeedback(f.ctx, { ...input, value: 'not_useful', expectedRevision: 1 });
    expect(f.rows.get('users/u/notifications/n')).toEqual({ ...before, feedback: revised.feedback });
    expect(revised.feedback).toMatchObject({ value: 'not_useful', revision: 2 });
  });
  it.each(watchConditions)('keeps watch votes isolated from other inboxes and agencies: %j', async condition => {
    const f = fixture();
    const watch = { ...f.notification, insightCondition: undefined, ...condition };
    f.rows.set('users/u/notifications/n', watch);
    f.rows.set('users/v/notifications/n', { ...watch, recipientId: 'v' });
    await saveNotificationFeedback(f.ctx, input);
    expect(f.rows.get('users/v/notifications/n').feedback).toBeUndefined();
    f.rows.set('users/u/notifications/n', { ...watch, agencyId: 'b' });
    await expect(saveNotificationFeedback(f.ctx, input)).rejects.toMatchObject({ status: 404 });
    expect(f.writes()).toBe(1);
  });
  it.each([
    { matchingCondition: { contactId: 'c', propertyId: 'p' } },
    { ownerWatchCondition: { listingId: '../p', search: { source: 'owners' } } },
    { ownerWatchCondition: { listingId: 'p', search: { source: 'crm' } } },
    { ...watchConditions[0], ...watchConditions[1] },
    { ...watchConditions[0], insightCondition: { kind: 'task', id: 't' } },
  ])('rejects malformed or ambiguous watch bindings: %j', async condition => {
    const f = fixture(); f.rows.set('users/u/notifications/n', { ...f.notification, insightCondition: undefined, ...condition });
    await expect(saveNotificationFeedback(f.ctx, input)).rejects.toMatchObject({ status: 404 }); expect(f.writes()).toBe(0);
  });
  it('persists an evaluation, deduplicates retries and allows an explicit revision', async () => {
    const f = fixture(); const first = await saveNotificationFeedback(f.ctx, input);
    expect(first.feedback).toMatchObject({ value: 'useful', revision: 1 });
    expect(await saveNotificationFeedback(f.ctx, input)).toEqual(first);
    expect(await saveNotificationFeedback(f.ctx, { ...input, expectedRevision: 1 })).toEqual(first);
    expect(f.writes()).toBe(1);
    expect((await saveNotificationFeedback(f.ctx, { ...input, value: 'not_useful', expectedRevision: 1 })).feedback.revision).toBe(2);
    expect(f.rows.get('users/u/notifications/n')).toMatchObject({ ...f.notification, feedback: { value: 'not_useful', revision: 2 } });
  });
  it('rejects stale contradictory or ABA revisions', async () => {
    const f = fixture(); await saveNotificationFeedback(f.ctx, input);
    await expect(saveNotificationFeedback(f.ctx, { ...input, value: 'not_useful' })).rejects.toMatchObject({ status: 409 });
    await saveNotificationFeedback(f.ctx, { ...input, value: 'not_useful', expectedRevision: 1 });
    await saveNotificationFeedback(f.ctx, { ...input, expectedRevision: 2 });
    await expect(saveNotificationFeedback(f.ctx, input)).rejects.toMatchObject({ status: 409 });
  });
  it('accepts feedback on a delivered alert after withdrawal without restoring it', async () => {
    const f = fixture(); f.rows.set('users/u/notifications/n', { ...f.notification, withdrawnAt: '2026-10-07T10:00:00Z', isRead: true });
    await saveNotificationFeedback(f.ctx, input);
    expect(f.rows.get('users/u/notifications/n')).toMatchObject({ withdrawnAt: '2026-10-07T10:00:00Z', isRead: true });
  });
  it.each([{ agencyId: 'b', role: 'agent' }, { agencyId: 'a', role: 'admin' }, undefined])('rejects changed membership %j', async member => {
    const f = fixture(); f.rows.set('users/u', member);
    await expect(saveNotificationFeedback(f.ctx, input)).rejects.toMatchObject({ status: 403 }); expect(f.writes()).toBe(0);
  });
  it.each([{ agencyId: 'b' }, { recipientId: 'v' }, { type: 'task' }, { automationId: undefined }, { insightCondition: undefined }, { insightCondition: { kind: 'invalid', id: 't' } }])('rejects incompatible alerts %j', async patch => {
    const f = fixture(); f.rows.set('users/u/notifications/n', { ...f.notification, ...patch });
    await expect(saveNotificationFeedback(f.ctx, input)).rejects.toMatchObject({ status: 404 }); expect(f.writes()).toBe(0);
  });
  it('does not access another recipient inbox', async () => {
    const f = fixture(); f.rows.set('users/v/notifications/other', { ...f.notification, recipientId: 'v' });
    await expect(saveNotificationFeedback(f.ctx, { ...input, notificationId: 'other' })).rejects.toMatchObject({ status: 404 }); expect(f.writes()).toBe(0);
  });
  it.each([{ ...input, uid: 'v' }, { ...input, value: 'maybe' }, { ...input, expectedRevision: -1 }, { ...input, notificationId: '../v' }, { notificationId: 'n', value: 'useful' }])('rejects invalid input %j', async value => {
    const f = fixture(); await expect(saveNotificationFeedback(f.ctx, value)).rejects.toThrow(); expect(f.writes()).toBe(0);
  });
});
