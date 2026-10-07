import { describe, expect, it } from 'vitest';
import { annotateWatchFeedback, watchFeedbackRef } from '../watch-feedback';
import { saveNotificationFeedback } from '../notification-feedback';

function fixture(kind: 'owner' | 'matching') {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: async (r: any) => { if (writes.length) throw new Error('Read after write'); return { exists: rows.has(r.path), data: () => rows.get(r.path) }; }, set: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) });
    writes.forEach(fn => fn()); return result;
  } };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any;
  const condition = kind === 'owner' ? { ownerWatchCondition: { listingId: 'p', search: { source: 'owners' } } } : { matchingCondition: { contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) } };
  const alert = { type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', ...condition };
  rows.set('users/u/notifications/n1', alert); rows.set('users/u/notifications/n2', alert);
  const contactId = kind === 'matching' ? 'c' : undefined;
  return { ctx, rows, contactId };
}
describe.each(['owner', 'matching'] as const)('%s historical alert context', kind => {
  it('preserves canonical rows, order, scores and reasons even for a negative vote', async () => {
    const { ctx, contactId } = fixture(kind);
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    const cards = [{ id: 'p', matchScore: 99, reasoning: 'canonical' }, { id: 'q', matchScore: 70, reasoning: 'other' }];
    const result = await annotateWatchFeedback(ctx, cards, contactId);
    expect(result.map(({ id, matchScore, reasoning }) => ({ id, matchScore, reasoning }))).toEqual(cards);
    expect(result[0]).toMatchObject({ previousAlertFeedback: 'not_useful', alertFeedbackUpdatedAt: expect.any(String), feedbackNote: expect.stringContaining('nu evaluează oferta actuală') });
    expect(result[0]).not.toHaveProperty('feedbackOrder'); expect(cards[0]).not.toHaveProperty('feedbackNote');
    expect(result[1]).toEqual(cards[1]);
  });
  it('keeps the latest committed vote across alerts when an older request retries', async () => {
    const { ctx, contactId } = fixture(kind);
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    await saveNotificationFeedback(ctx, { notificationId: 'n2', value: 'useful', expectedRevision: 0 });
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    expect((await annotateWatchFeedback(ctx, [{ id: 'p' }], contactId))[0]).toHaveProperty('previousAlertFeedback', 'useful');
  });
  it('isolates actors, agencies, watch kinds and contact-property pairs', async () => {
    const { ctx, rows, contactId } = fixture(kind);
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'useful', expectedRevision: 0 });
    rows.set('users/v', { agencyId: 'a', role: 'agent' });
    expect((await annotateWatchFeedback({ ...ctx, uid: 'v' }, [{ id: 'p' }], contactId))[0]).not.toHaveProperty('feedbackNote');
    expect((await annotateWatchFeedback(ctx, [{ id: 'p' }], kind === 'owner' ? 'c' : undefined))[0]).not.toHaveProperty('feedbackNote');
    expect((await annotateWatchFeedback(ctx, [{ id: 'p' }], 'different-contact'))[0]).not.toHaveProperty('feedbackNote');
    rows.set('users/u', { agencyId: 'b', role: 'agent' });
    expect((await annotateWatchFeedback({ ...ctx, agencyId: 'b' }, [{ id: 'p' }], contactId))[0]).not.toHaveProperty('feedbackNote');
    await expect(annotateWatchFeedback(ctx, [{ id: 'p' }], contactId)).rejects.toMatchObject({ status: 403 });
  });
  it('rejects a projection with an incompatible actor or malformed vote', async () => {
    const { ctx, rows, contactId } = fixture(kind);
    const path = watchFeedbackRef(ctx, kind === 'owner' ? ['owner', 'p'] : ['matching', 'c', 'p']).path;
    rows.set(path, { actorId: 'v', feedback: {} });
    await expect(annotateWatchFeedback(ctx, [{ id: 'p' }], contactId)).rejects.toThrow();
    rows.set(path, { actorId: 'u', feedback: { value: 'useful', revision: 0, updatedAt: 'invalid' } });
    await expect(annotateWatchFeedback(ctx, [{ id: 'p' }], contactId)).rejects.toThrow();
  });
});
