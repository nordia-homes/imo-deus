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
  vi.mocked(getConversation).mockResolvedValue({ channel: 'whatsapp', phone: '+40722123456' } as any);
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
it('blocks revoked membership before any notification write', async () => {
  const { ctx, rows } = database(); rows.set('users/u', { agencyId: 'other', role: 'agent' });
  await expect(deliverDailyBrief(ctx, settings, now)).rejects.toThrow('Acces revocat');
  expect(rows.size).toBe(1);
});
it('never sends a personal brief to a client conversation', async () => {
  const { ctx, rows } = database();
  vi.mocked(getConversation).mockResolvedValue({ channel: 'whatsapp', phone: '+40722999999' } as any);
  await expect(deliverDailyBrief(ctx, whatsapp, now)).rejects.toThrow('numărul tău');
  expect(queueMessage).not.toHaveBeenCalled(); expect(rows.size).toBe(1);
});
it('does not retry an ambiguous external send', async () => {
  const { ctx } = database(); vi.mocked(queueMessage).mockRejectedValue(new Error('provider failed after acceptance'));
  await expect(deliverDailyBrief(ctx, whatsapp, now)).rejects.toThrow('nu se retrimite');
  expect(await deliverDailyBrief(ctx, whatsapp, now)).toMatchObject({ deduplicated: true, status: 'unknown' });
  expect(queueMessage).toHaveBeenCalledTimes(1);
});
