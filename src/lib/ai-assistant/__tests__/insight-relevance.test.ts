import { describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), canReadResource: (_ctx: any, _resource: string, row: any) => row.allowed !== false }));
import { insightStillRelevant } from '../insight-relevance';
import { createInsightNotification } from '../insight-notifications';
import { reconcileRuleNotifications } from '../notification-relevance';

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
