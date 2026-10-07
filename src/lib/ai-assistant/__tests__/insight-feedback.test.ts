import { describe, expect, it } from 'vitest';
import { annotateInsightFeedback, insightFeedbackRef } from '../insight-feedback';
import { saveNotificationFeedback } from '../notification-feedback';

function fixture() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: async (r: any) => { if (writes.length) throw new Error('Read after write'); return { exists: rows.has(r.path), data: () => rows.get(r.path) }; }, set: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) });
    writes.forEach(fn => fn()); return result;
  } };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any;
  const alert = { type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', insightCondition: { kind: 'task', id: 't' } };
  rows.set('users/u/notifications/n1', alert); rows.set('users/u/notifications/n2', alert);
  return { ctx, rows };
}
describe('feedback context on current priorities', () => {
  it('annotates the current priority without changing order, score or count', async () => {
    const { ctx } = fixture(); await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    const cards = [{ taskId: 't', id: 'task-t', priority: 80 }, { taskId: 'other', id: 'task-other', priority: 80 }];
    const result = await annotateInsightFeedback(ctx, cards);
    expect(result).toHaveLength(2); expect(result.map(row => row.id)).toEqual(cards.map(row => row.id));
    expect(result[0]).toMatchObject({ priority: 80, previousFeedback: 'not_useful', feedbackNote: expect.stringContaining('Problema este încă activă') });
    expect(result[1]).toEqual(cards[1]); expect(cards[0]).not.toHaveProperty('previousFeedback');
  });
  it('keeps the newest committed evaluation across alerts and does not project a retry again', async () => {
    const { ctx } = fixture();
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    await saveNotificationFeedback(ctx, { notificationId: 'n2', value: 'useful', expectedRevision: 0 });
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 0 });
    expect((await annotateInsightFeedback(ctx, [{ taskId: 't' }]))[0]).toHaveProperty('previousFeedback', 'useful');
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'useful', expectedRevision: 1 });
    await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'not_useful', expectedRevision: 2 });
    expect((await annotateInsightFeedback(ctx, [{ taskId: 't' }]))[0]).toHaveProperty('previousFeedback', 'not_useful');
  });
  it('canonicalizes conflict pairs and separates actors, agencies and kinds', () => {
    const { ctx } = fixture(); const condition = { kind: 'conflict' as const, id: 'a', otherId: 'b' };
    const original = insightFeedbackRef(ctx, condition).path;
    expect(insightFeedbackRef(ctx, { ...condition, id: 'b', otherId: 'a' }).path).toBe(original);
    expect(insightFeedbackRef({ ...ctx, uid: 'v' }, condition).path).not.toBe(original);
    expect(insightFeedbackRef({ ...ctx, agencyId: 'b' }, condition).path).not.toBe(original);
    expect(insightFeedbackRef(ctx, { kind: 'task', id: 'a' }).path).not.toBe(original);
  });
  it('does not expose evaluations from another actor or agency', async () => {
    const { ctx, rows } = fixture(); await saveNotificationFeedback(ctx, { notificationId: 'n1', value: 'useful', expectedRevision: 0 });
    rows.set('users/v', { agencyId: 'a', role: 'agent' });
    expect((await annotateInsightFeedback({ ...ctx, uid: 'v' }, [{ taskId: 't' }]))[0]).not.toHaveProperty('previousFeedback');
    rows.set('users/u', { agencyId: 'b', role: 'agent' });
    expect((await annotateInsightFeedback({ ...ctx, agencyId: 'b' }, [{ taskId: 't' }]))[0]).not.toHaveProperty('previousFeedback');
    await expect(annotateInsightFeedback(ctx, [{ taskId: 't' }])).rejects.toMatchObject({ status: 403 });
  });
  it('rejects invalid projected evidence', async () => {
    const { ctx, rows } = fixture(); rows.set(insightFeedbackRef(ctx, { kind: 'task', id: 't' }).path, { actorId: 'other', feedback: {} });
    await expect(annotateInsightFeedback(ctx, [{ taskId: 't' }])).rejects.toThrow();
  });
});
