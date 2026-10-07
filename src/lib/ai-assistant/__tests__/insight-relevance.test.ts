import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), canReadResource: (_ctx: any, _resource: string, row: any) => row.allowed !== false }));
import { insightStillRelevant } from '../insight-relevance';
import { createInsightNotification } from '../insight-notifications';
import { reconcileRuleNotifications } from '../notification-relevance';
afterEach(() => { vi.useRealTimers(); });

const upcoming = new Date(Date.now() + 86400000).toISOString();
const cases = [
  { kind: 'lead', resource: 'contacts', card: { contactId: 'c' }, live: { status: 'Nou', createdAt: '2020-01-01' }, resolved: { interactionHistory: [{}] } },
  { kind: 'task', resource: 'tasks', card: { taskId: 'c' }, live: { status: 'open', agentId: 'u', dueDate: '2020-01-01' }, resolved: { status: 'completed' } },
  { kind: 'sale', resource: 'sales', card: { saleId: 'c' }, live: { stage: 'blocked' }, resolved: { stage: 'completed' } },
  { kind: 'reply', resource: 'conversations', card: { conversationId: 'c' }, live: { status: 'open', needsReply: true, lastInboundAt: '2020-01-01' }, resolved: { status: 'resolved' } },
  { kind: 'meta', resource: 'metaCampaignDrafts', card: { draftId: 'c', source: 'metaCampaignDrafts' }, live: { status: 'failed' }, resolved: { status: 'published' } },
  { kind: 'tiktok', resource: 'tiktokPostDrafts', card: { draftId: 'c', source: 'tiktokPostDrafts' }, live: { status: 'published', manualReviewRequired: true }, resolved: { manualReviewRequired: false } },
  { kind: 'call', resource: 'aiOutreachCalls', card: { callId: 'c' }, live: { providerErrorCode: 'vapi_create_unknown' }, resolved: { providerErrorCode: null } },
  { kind: 'conflict', resource: 'viewings', card: { viewingIds: ['c', 'd'] }, live: { status: 'scheduled', agentId: 'u', viewingDate: upcoming, duration: 60 }, resolved: { status: 'cancelled' } },
] as const;
function fixture(testCase: typeof cases[number]) {
  const path = `agencies/a/${testCase.resource}/c`;
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], [path, { ...testCase.live }], [`agencies/a/${testCase.resource}/d`, { ...testCase.live }]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (callback: any) => {
    const writes: (() => void)[] = [];
    const result = await callback({ get: async (r: any) => { if (writes.length) throw new Error('Read after write'); return { exists: rows.has(r.path), data: () => rows.get(r.path) }; }, create: (r: any, value: any) => writes.push(() => { if (rows.has(r.path)) throw new Error('Duplicate'); rows.set(r.path, value); }), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) });
    writes.forEach(write => write()); return result;
  } };
  return { rows, path, ctx: { uid: 'u', role: 'agent', agencyId: 'a', adminDb: db } as any, card: { id: 'card', title: 'Priority', ...testCase.card } };
}
describe('shared insight conditions and transactional delivery', () => {
  it('rechecks quiet hours after transaction reads and leaves the effect resumable', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T18:59:59Z'));
    const { ctx, rows, card } = fixture(cases[1]);
    const original = ctx.adminDb.runTransaction;
    let crossed = false;
    ctx.adminDb.runTransaction = (callback: any) => original((tx: any) => callback({ ...tx, get: async (ref: any) => {
      const result = await tx.get(ref);
      if (!crossed && ref.path.includes('/assistantNotificationState/')) { crossed = true; vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); }
      return result;
    } }));
    const hours = { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' };
    expect(await createInsightNotification(ctx, 'r', 'n', card, undefined, 60, hours)).toMatchObject({ status: 'deferred', reasonCode: 'quiet_hours' });
    expect([...rows.keys()].filter(key => key.includes('/notifications/') || key.includes('/insightEffects/') || key.includes('/assistantNotificationState/'))).toHaveLength(0);
    vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
    expect(await createInsightNotification(ctx, 'r', 'n', card, undefined, 60, hours)).toMatchObject({ status: 'created' });
  });
  it('shares the cooldown across reports without extending it on suppressed runs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const { ctx, rows, card } = fixture(cases[1]);
    await createInsightNotification(ctx, 'report-one', 'n1', card, undefined, 60);
    vi.setSystemTime(new Date('2026-10-07T10:30:00Z'));
    expect(await createInsightNotification(ctx, 'report-two', 'n2', card, undefined, 60)).toMatchObject({ status: 'skipped', reasonCode: 'cooldown', nextEligibleAt: '2026-10-07T11:00:00.000Z' });
    vi.setSystemTime(new Date('2026-10-07T11:00:00Z'));
    expect(await createInsightNotification(ctx, 'report-two', 'n3', card, undefined, 60)).toMatchObject({ status: 'created' });
    expect(await createInsightNotification(ctx, 'report-two', 'n2', card, undefined, 60)).toMatchObject({ status: 'skipped', reasonCode: 'cooldown' });
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(2);
  });
  it('defaults to a day and applies an explicitly changed cooldown to the last delivery', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    const { ctx, card } = fixture(cases[1]);
    await createInsightNotification(ctx, 'r', 'n1', card);
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    expect(await createInsightNotification(ctx, 'r', 'n2', card)).toMatchObject({ reasonCode: 'cooldown', nextEligibleAt: '2026-10-08T10:00:00.000Z' });
    expect(await createInsightNotification(ctx, 'r', 'n3', card, undefined, 30)).toMatchObject({ status: 'created' });
  });
  it('canonicalizes a viewing pair and isolates different priorities', async () => {
    const { ctx, rows, card } = fixture(cases[7]);
    await createInsightNotification(ctx, 'r1', 'n1', card);
    expect(await createInsightNotification(ctx, 'r2', 'n2', { ...card, viewingIds: ['d', 'c'] })).toMatchObject({ reasonCode: 'cooldown' });
    rows.set('agencies/a/tasks/c', { status: 'open', agentId: 'u', dueDate: '2020-01-01' });
    expect(await createInsightNotification(ctx, 'r2', 'n3', { id: 'task-c', title: 'Task', taskId: 'c' })).toMatchObject({ status: 'created' });
  });
  it('keeps cooldowns separate for different actors and agencies', async () => {
    const { ctx, rows, card } = fixture(cases[0]);
    await createInsightNotification(ctx, 'r', 'n1', card);
    rows.set('users/v', { agencyId: 'a', role: 'agent' });
    expect(await createInsightNotification({ ...ctx, uid: 'v' }, 'r', 'n2', card)).toMatchObject({ status: 'created' });
    rows.set('users/u', { agencyId: 'b', role: 'agent' }); rows.set('agencies/b/contacts/c', { ...cases[0].live });
    expect(await createInsightNotification({ ...ctx, agencyId: 'b' }, 'r', 'n3', card)).toMatchObject({ status: 'created' });
  });
  it('does not start a cooldown for a resolved or inaccessible priority', async () => {
    const { ctx, rows, path, card } = fixture(cases[1]);
    rows.set(path, { ...cases[1].live, status: 'completed' });
    await createInsightNotification(ctx, 'r', 'n1', card);
    expect([...rows.keys()].filter(key => key.includes('/assistantNotificationState/'))).toHaveLength(0);
    rows.set(path, { ...cases[1].live });
    expect(await createInsightNotification(ctx, 'r', 'n2', card)).toMatchObject({ status: 'created' });
  });
  it('refuses malformed cooldown state instead of sending another alert', async () => {
    const { ctx, rows, card } = fixture(cases[1]);
    await createInsightNotification(ctx, 'r', 'n1', card);
    const key = [...rows.keys()].find(key => key.includes('/assistantNotificationState/'))!;
    rows.set(key, { lastNotifiedAt: 'invalid' });
    await expect(createInsightNotification(ctx, 'r', 'n2', card)).rejects.toThrow('Istoricul');
    expect(rows.has('users/u/notifications/n2')).toBe(false);
  });
  it('preserves a legacy delivery when resuming with the new bounded identifier', async () => {
    const { ctx, rows, card } = fixture(cases[0]);
    rows.set('users/u/notifications/legacy', { title: 'Already delivered', agencyId: 'a', recipientId: 'u' });
    expect(await createInsightNotification(ctx, 'r', 'new-id', card, 'legacy')).toEqual({ status: 'existing', notificationId: 'legacy' });
    expect(rows.has('users/u/notifications/new-id')).toBe(false);
    expect(rows.get('users/u/notifications/legacy')).toMatchObject({ title: 'Already delivered' });
  });
  it.each(cases)('creates once and withdraws resolved $kind alerts', async testCase => {
    const { ctx, rows, path, card } = fixture(testCase);
    await createInsightNotification(ctx, 'r', 'n', card);
    await createInsightNotification(ctx, 'r', 'n', card);
    expect(rows.get('users/u/notifications/n')).toMatchObject({ title: 'Priority', insightCondition: { kind: testCase.kind, id: 'c' } });
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(0);
    rows.set(path, { ...testCase.live, ...testCase.resolved });
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(1);
    expect(rows.get('users/u/notifications/n')).toMatchObject({ withdrawalReason: 'state_changed', isRead: true });
  });
  it.each(cases)('persists omission of a $kind alert resolved after report generation', async testCase => {
    const { ctx, rows, path, card } = fixture(testCase);
    rows.set(path, { ...testCase.live, ...testCase.resolved });
    expect(await createInsightNotification(ctx, 'r', 'n', card)).toMatchObject({ status: 'skipped', reasonCode: 'state_changed' });
    rows.set(path, { ...testCase.live });
    expect(await createInsightNotification(ctx, 'r', 'n', card)).toMatchObject({ status: 'skipped' });
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
  it.each(['resolved', 'spam', 'snoozed', 'closed'])('does not report an old inbound message in a %s conversation', status => {
    expect(insightStillRelevant('reply', [{ status, needsReply: true, lastInboundAt: '2020-01-01' }], 'u', Date.now())).toBe(false);
  });
  it.each([{ agentId: 'other' }, { dueDate: '2099-01-01' }, { dueDate: 'invalid' }])('withdraws a task after reassignment or changed deadline: %j', patch => {
    expect(insightStillRelevant('task', [{ status: 'open', agentId: 'u', dueDate: '2020-01-01', ...patch }], 'u', Date.now())).toBe(false);
  });
  it('rejects a former viewing conflict when participants or the time change', () => {
    const viewing = { status: 'scheduled', agentId: 'u', viewingDate: upcoming, duration: 60 };
    expect(insightStillRelevant('conflict', [viewing, { ...viewing, agentId: 'other' }], 'u', Date.now())).toBe(false);
    expect(insightStillRelevant('conflict', [viewing, { ...viewing, viewingDate: new Date(Date.parse(upcoming) + 3600000).toISOString() }], 'u', Date.now())).toBe(false);
  });
  it.each(['deleted', 'access'])('does not create alerts after entity %s changes', async change => {
    const { ctx, rows, path, card } = fixture(cases[2]);
    if (change === 'deleted') rows.delete(path); else rows.set(path, { ...cases[2].live, allowed: false });
    expect(await createInsightNotification(ctx, 'r', 'n', card)).toMatchObject({ status: 'skipped', reasonCode: change === 'deleted' ? 'entity_deleted' : 'access_revoked' });
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
  it('refuses changed membership and unbound cards before notification creation', async () => {
    const { ctx, rows, card } = fixture(cases[0]); rows.set('users/u', { agencyId: 'other', role: 'agent' });
    await expect(createInsightNotification(ctx, 'r', 'n', card)).rejects.toThrow('Permisiunile');
    await expect(createInsightNotification(ctx, 'r', 'n', { id: 'unknown' })).rejects.toThrow();
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
});
