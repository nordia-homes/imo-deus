import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${name}`) }));
vi.mock('../insights', () => ({ getInsights: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ getConversation: vi.fn() }));
vi.mock('@/lib/communications/outbound', () => ({ queueMessage: vi.fn() }));
import { getInsights } from '../insights';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { deliverDailyBrief } from '../daily-brief';
import { briefSettingsSchema } from '../daily-brief-contract';
import { readBriefDelivery } from '../brief-delivery';

function database() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent', phone: '+40722123456' }]]);
  function ref(path: string): any {
    return { path, doc: (id: string) => ref(`${path}/${id}`), collection: (id: string) => ref(`${path}/${id}`),
      get: async () => ({ exists: rows.has(path), data: () => rows.get(path) }),
      update: async (data: any) => rows.set(path, { ...rows.get(path), ...data }) };
  }
  const db: any = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({ get: (r: any) => { if (writes.length) throw new Error('Read after write'); return r.get(); },
      create: (r: any, data: any) => writes.push(() => { if (rows.has(r.path)) throw new Error('Duplicate'); rows.set(r.path, data); }),
      set: (r: any, data: any) => writes.push(() => rows.set(r.path, data)) });
    writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any };
}
const settings = briefSettingsSchema.parse({ timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5] });
const now = new Date('2026-10-06T06:00:00Z');
const whatsapp = { ...settings, deliveryChannel: 'whatsapp' as const, conversationId: 'own', templateName: 'daily' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getInsights).mockResolvedValue({ rows: [{ title: 'Sarcină restantă' }], complete: true } as any);
  vi.mocked(getConversation).mockResolvedValue({ id: 'own', agencyId: 'a', channel: 'whatsapp', connectionId: 'connection', externalParticipantId: '40722123456', phone: '+40722123456', assigneeId: 'u', collaboratorIds: [] } as any);
});
async function queuedBrief(crash = false) {
  const fixture = database();
  const conversation = await getConversation(fixture.ctx.adminDb, fixture.ctx, 'own');
  fixture.rows.set('agencies/a/conversations/own', conversation);
  let receipt: any;
  vi.mocked(queueMessage).mockImplementationOnce(async (_db, _actor, _id, input: any) => {
    receipt = [...fixture.rows].find(([key]) => key.includes('/assistantArtifacts/'))![1];
    expect(input.personalRecipient).toMatchObject({ role: 'agent', recipientRevision: receipt.delivery.recipientRevision });
    expect(receipt).toMatchObject({ status: 'prepared', delivery: { requestId: input.requestId, template: input.template } });
    fixture.rows.set(`communicationOutboundJobs/${receipt.delivery.messageId}`, { agencyId: 'a', uid: 'u', conversationId: 'own', connectionId: 'connection', recipientRevision: receipt.delivery.recipientRevision, input: { ...input, text: '' } });
    fixture.rows.set(`agencies/a/conversations/own/messages/${receipt.delivery.messageId}`, { agencyId: 'a', conversationId: 'own', authorId: 'u', direction: 'sent', origin: 'imodeus', status: 'queued' });
    if (crash) throw new Error('Response lost after queue commit');
    return { messageId: receipt.delivery.messageId, status: 'queued' };
  });
  if (crash) await expect(deliverDailyBrief(fixture.ctx, whatsapp, now)).rejects.toThrow('nu se retrimite');
  else expect(await deliverDailyBrief(fixture.ctx, whatsapp, now)).toMatchObject({ status: 'queued', completionSatisfied: false });
  const receiptPath = [...fixture.rows.keys()].find(key => key.includes('/assistantArtifacts/'))!;
  return { ...fixture, receiptId: receiptPath.split('brief-')[1], receipt: fixture.rows.get(receiptPath), job: fixture.rows.get(`communicationOutboundJobs/${receipt.delivery.messageId}`), message: fixture.rows.get(`agencies/a/conversations/own/messages/${receipt.delivery.messageId}`), conversation };
}
it.each(['queued', 'sending', 'accepted', 'delivered', 'read', 'failed', 'unknown'])('reads the verified brief message status %s without sending again', async status => {
  const f = await queuedBrief(); Object.assign(f.message, { status, externalId: 'provider-receipt' });
  expect(await deliverDailyBrief(f.ctx, whatsapp, now)).toMatchObject({ deduplicated: true, status, completionSatisfied: ['delivered', 'read'].includes(status) });
  expect(queueMessage).toHaveBeenCalledTimes(1);
});
it.each(['foreign-job', 'changed-template', 'changed-recipient', 'revoked-role', 'foreign-message', 'no-external-id', 'legacy', 'foreign-receipt'])('does not claim brief delivery after %s', async change => {
  const f = await queuedBrief(); Object.assign(f.message, { status: 'delivered', externalId: 'provider-receipt' });
  if (change === 'foreign-job') f.job.agencyId = 'other';
  if (change === 'changed-template') f.job.input.template = { ...f.job.input.template, parameters: ['Changed'] };
  if (change === 'changed-recipient') f.conversation.externalParticipantId = 'other';
  if (change === 'revoked-role') f.rows.get('users/u').role = 'admin';
  if (change === 'foreign-message') f.message.authorId = 'other';
  if (change === 'no-external-id') delete f.message.externalId;
  if (change === 'legacy') delete f.receipt.delivery;
  if (change === 'foreign-receipt') f.receipt.actorId = 'other';
  expect(await readBriefDelivery(f.ctx, f.receiptId)).toMatchObject({ status: 'unknown', completionSatisfied: false });
  expect(queueMessage).toHaveBeenCalledTimes(1);
});
it('recovers a committed queue receipt after a lost response through a read only', async () => {
  const f = await queuedBrief(true); Object.assign(f.message, { status: 'delivered', externalId: 'provider-receipt' });
  expect(await deliverDailyBrief(f.ctx, whatsapp, now)).toMatchObject({ deduplicated: true, status: 'delivered', completionSatisfied: true });
  expect(queueMessage).toHaveBeenCalledTimes(1);
});
it('atomically delivers one app notification per local day', async () => {
  const { ctx, rows } = database();
  expect(await deliverDailyBrief(ctx, settings, now)).toMatchObject({ status: 'delivered' });
  expect(await deliverDailyBrief(ctx, settings, now)).toMatchObject({ deduplicated: true });
  expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(1);
  expect(getInsights).toHaveBeenCalledTimes(1);
  expect(queueMessage).not.toHaveBeenCalled();
});
it('produces no notification when there are no priorities', async () => {
  vi.mocked(getInsights).mockResolvedValue({ rows: [], complete: true } as any);
  const { ctx, rows } = database();
  expect(await deliverDailyBrief(ctx, settings, now)).toMatchObject({ empty: true });
  expect(rows.size).toBe(1);
});
it.each(['app', 'whatsapp'] as const)('does not replay a missed local day through %s', async deliveryChannel => {
  const { ctx, rows } = database();
  expect(await deliverDailyBrief(ctx, { ...whatsapp, deliveryChannel }, now, '2026-10-05T05:30:00Z')).toMatchObject({ deferred: true, reasonCode: 'missed_local_day', scheduledDate: '2026-10-05', currentDate: '2026-10-06' });
  expect(rows.size).toBe(1);
  expect(getInsights).not.toHaveBeenCalled(); expect(getConversation).not.toHaveBeenCalled(); expect(queueMessage).not.toHaveBeenCalled();
});
it('allows same-local-day catch-up across UTC midnight', async () => {
  const { ctx } = database();
  const local = { ...settings, timezone: 'America/Los_Angeles', deliveryTime: '16:00', daysOfWeek: [1, 2, 3, 4, 5, 6, 0] };
  expect(await deliverDailyBrief(ctx, local, new Date('2026-10-07T01:00:00Z'), '2026-10-06T23:00:00Z')).toMatchObject({ status: 'delivered' });
});
it('rejects a missed local day even when UTC dates match', async () => {
  const { ctx } = database();
  const local = { ...settings, deliveryTime: '00:00', quietStart: '00:00', quietEnd: '00:00' };
  expect(await deliverDailyBrief(ctx, local, new Date('2026-10-06T22:00:00Z'), '2026-10-06T05:30:00Z')).toMatchObject({ reasonCode: 'missed_local_day' });
  expect(getInsights).not.toHaveBeenCalled();
});
it('does not deliver before the scheduled instant or during quiet hours', async () => {
  const { ctx } = database();
  expect(await deliverDailyBrief(ctx, settings, now, '2026-10-06T07:00:00Z')).toMatchObject({ reasonCode: 'not_due' });
  expect(await deliverDailyBrief(ctx, settings, new Date('2026-10-06T20:00:00Z'), '2026-10-06T05:30:00Z')).toMatchObject({ deferred: true });
  expect(getInsights).not.toHaveBeenCalled(); expect(queueMessage).not.toHaveBeenCalled();
});
it.each(['invalid', '2026-10-06', '2026-10-06T08:30:00'])('fails closed for an invalid scheduled instant: %s', async scheduledFor => {
  const { ctx } = database();
  await expect(deliverDailyBrief(ctx, settings, now, scheduledFor)).rejects.toThrow('invalidă');
  expect(getInsights).not.toHaveBeenCalled();
});
it('blocks revoked membership before any notification write', async () => {
  const { ctx, rows } = database(); rows.set('users/u', { agencyId: 'other', role: 'agent' });
  await expect(deliverDailyBrief(ctx, settings, now)).rejects.toThrow('Acces revocat');
  expect(rows.size).toBe(1);
});
it('never sends a personal brief to a client conversation', async () => {
  const { ctx, rows } = database();
  vi.mocked(getConversation).mockResolvedValue({ channel: 'whatsapp', phone: '+40722123456', externalParticipantId: '40722999999' } as any);
  await expect(deliverDailyBrief(ctx, whatsapp, now)).rejects.toThrow('numărul tău');
  expect(queueMessage).not.toHaveBeenCalled(); expect(rows.size).toBe(1);
});
it('does not retry an ambiguous external send', async () => {
  const { ctx } = database(); vi.mocked(queueMessage).mockRejectedValue(new Error('provider failed after acceptance'));
  await expect(deliverDailyBrief(ctx, whatsapp, now)).rejects.toThrow('nu se retrimite');
  expect(await deliverDailyBrief(ctx, whatsapp, now)).toMatchObject({ deduplicated: true, status: 'unknown' });
  expect(queueMessage).toHaveBeenCalledTimes(1);
});
