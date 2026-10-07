import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), getResource: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn(async () => ({ taskId: 'task' })), matchContact: vi.fn() }));
vi.mock('../insights', () => ({ getInsights: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ getConversation: vi.fn() }));
vi.mock('@/lib/communications/outbound', () => ({ queueMessage: vi.fn() }));
vi.mock('../event-rules', () => ({ runEventRule: vi.fn() }));
import { drainAssistantAutomations } from '../automation-worker';
import { executeAction } from '../actions';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { getResource } from '../access';
import { runEventRule } from '../event-rules';
import { getInsights } from '../insights';
function database(automation: any, patch: any = {}) {
  const job = { id: 'job', agencyId: 'a', actorId: 'u', actorRole: 'agent', createdAt: '2026-01-01T00:00:00.000Z', status: 'active', nextRunAt: '2026-01-01T00:00:00.000Z', automation, ...patch };
  const rows = new Map<string, any>([['assistantAutomationJobs/job', job], ['agencies/a/assistantAutomations/job', { ...job }], ['users/u', { agencyId: 'a', role: 'agent' }]]);
  function ref(path: string, filters: any[] = [], limit = Infinity): any {
    return { path, id: path.split('/').at(-1), doc: (id: string) => ref(path + '/' + id), collection: (name: string) => ref(path + '/' + name), where: (key: string, op: string, value: any) => ref(path, [...filters, [key, op, value]], limit), orderBy: () => ref(path, filters, limit), limit: (value: number) => ref(path, filters, value), get: async () => ({ exists: rows.has(path), data: () => structuredClone(rows.get(path)), docs: [...rows].filter(([key, row]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, op, value]) => op === '<' ? row[field] < value : op === '<=' ? row[field] <= value : row[field] === value)).slice(0, limit).map(([key, row]) => ({ id: key.split('/').at(-1), ref: ref(key), data: () => structuredClone(row) })) }), update: async (value: any) => rows.set(path, { ...rows.get(path), ...value }) };
  }
  const db = { collection: ref, runTransaction: async (callback: any) => { const writes: (() => void)[] = []; const result = await callback({ get: (reference: any) => { if (writes.length) throw new Error('Read after write'); return reference.get(); }, update: (reference: any, value: any) => writes.push(() => rows.set(reference.path, { ...rows.get(reference.path), ...value })), create: (reference: any, value: any) => writes.push(() => rows.set(reference.path, value)) }); writes.forEach(write => write()); return result; } };
  return { db, rows };
}
const followup = { type: 'followup_task', nextRunAt: '2026-01-01T00:00:00.000Z', contactId: 'c', description: 'Follow up', maxRuns: 1 };
const whatsapp = { type: 'whatsapp_template', nextRunAt: '2026-01-01T00:00:00.000Z', conversationId: 'conv', stopOnReply: true, template: { name: 'approved', language: 'ro', parameters: [] }, maxRuns: 1 };
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('approved automation execution', () => {
  it('keeps the receipt visible after an ambiguous brief delivery without retrying it', async () => {
    const brief = await import('../daily-brief');
    const receiptId = 'a'.repeat(64);
    const send = vi.spyOn(brief, 'deliverDailyBrief').mockRejectedValueOnce(Object.assign(new Error('Livrare incertă'), { briefReceiptId: receiptId }));
    const { db, rows } = database({ type: 'daily_sales_brief', nextRunAt: '2026-01-01T00:00:00.000Z', timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5], maxRuns: 10 });
    await drainAssistantAutomations(db as any); await drainAssistantAutomations(db as any);
    expect(send).toHaveBeenCalledTimes(1);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'unknown', lastResult: { receiptId, status: 'unknown' } });
    expect(rows.get('agencies/a/assistantAutomations/job')).toMatchObject({ status: 'unknown', lastResult: { receiptId } });
    expect([...rows].filter(([key]) => key.includes('/audit/')).map(([, value]) => value)).toEqual([expect.objectContaining({ result: expect.objectContaining({ receiptId }) })]);
  });
  it('records a missed brief day and schedules the next local slot without delivering catch-up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-06T06:00:00Z'));
    const due = '2026-10-05T05:30:00.000Z';
    const { db, rows } = database({ type: 'daily_sales_brief', nextRunAt: due, timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5], maxRuns: 10 }, { nextRunAt: due });
    expect(await drainAssistantAutomations(db as any)).toMatchObject({ processed: 1, results: [{ status: 'active' }] });
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'active', runCount: 1, nextRunAt: '2026-10-07T05:30:00.000Z', lastResult: { deferred: true, reasonCode: 'missed_local_day', scheduledFor: due } });
    expect(rows.get('agencies/a/assistantAutomations/job')).toMatchObject({ status: 'active', nextRunAt: '2026-10-07T05:30:00.000Z' });
    expect([...rows].filter(([key]) => key.includes('/audit/')).map(([, value]) => value)).toEqual([expect.objectContaining({ result: expect.objectContaining({ reasonCode: 'missed_local_day' }) })]);
    expect(await drainAssistantAutomations(db as any)).toMatchObject({ processed: 0 });
    expect(getInsights).not.toHaveBeenCalled(); expect(queueMessage).not.toHaveBeenCalled();
  });
  it('persists event-rule cursor and stops at the event limit', async () => {
    const { db, rows } = database({ type: 'event_rule', nextRunAt: '2026-01-01T00:00:00.000Z', intervalMinutes: 30, maxRuns: 10, trigger: { resource: 'contacts', change: 'updated' }, effects: [{ kind: 'notify', title: 'Client actualizat' }] });
    vi.mocked(runEventRule).mockImplementationOnce(async (_ctx, _claim, _rule, _execute, assertLease) => { await assertLease(); return { eventCursor: { recordedAt: '2026-01-01T00:01:00Z', id: 'e' }, eventCount: 100, limitReached: true, handled: 100, inaccessible: 0, scanned: 100, complete: false, note: '' }; });
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', nextRunAt: null, eventCount: 100, eventCursor: { id: 'e' } });
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('stops on deadline or contact status and records the skipped run', async () => {
    vi.mocked(getResource).mockResolvedValue({ status: 'Câștigat' });
    const { db, rows } = database({ ...followup, stopOnContactStatuses: ['Câștigat'] });
    await drainAssistantAutomations(db as any);
    expect(executeAction).not.toHaveBeenCalled();
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', lastResult: { skipped: true } });
    expect([...rows.keys()].some(key => key.startsWith('agencies/a/assistantAutomations/job/audit/'))).toBe(true);
    const expired = database({ ...followup, stopAfter: '2026-01-01T00:00:00.000Z' });
    await drainAssistantAutomations(expired.db as any);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('runs one follow-up through the existing idempotent action and never repeats a completed run', async () => {
    const { db, rows } = database(followup); await drainAssistantAutomations(db as any); await drainAssistantAutomations(db as any);
    expect(executeAction).toHaveBeenCalledTimes(1); expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', runCount: 1 });
  });
  it('blocks revoked membership before any CRM action', async () => {
    const { db, rows } = database(followup); rows.set('users/u', { agencyId: 'other', role: 'agent' }); await drainAssistantAutomations(db as any);
    expect(executeAction).not.toHaveBeenCalled(); expect(rows.get('assistantAutomationJobs/job').status).toBe('blocked');
  });
  it('stops WhatsApp follow-up after the recipient replies', async () => {
    vi.mocked(getConversation).mockResolvedValue({ lastInboundAt: '2026-02-01T00:00:00.000Z' } as any);
    const { db, rows } = database(whatsapp); await drainAssistantAutomations(db as any);
    expect(queueMessage).not.toHaveBeenCalled(); expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', lastResult: { skipped: true } });
  });
  it('persists a request ID before queueing and keeps unknown delivery unknown', async () => {
    vi.mocked(getConversation).mockResolvedValue({} as any);
    const { db, rows } = database(whatsapp);
    vi.mocked(queueMessage).mockImplementationOnce(async (_db, _ctx, _conversation, input) => { expect(rows.get('assistantAutomationJobs/job').requestId).toBe((input as { requestId: string }).requestId); expect(input).toMatchObject({ stopOnReplySince: '2026-01-01T00:00:00.000Z' }); return { status: 'unknown' } as any; });
    await drainAssistantAutomations(db as any); await drainAssistantAutomations(db as any);
    expect(queueMessage).toHaveBeenCalledTimes(1); expect(rows.get('assistantAutomationJobs/job').status).toBe('unknown');
  });
  it('never replays an interrupted ambiguous automation', async () => {
    const { db, rows } = database(whatsapp, { status: 'running', leaseUntil: 0 }); await drainAssistantAutomations(db as any);
    expect(queueMessage).not.toHaveBeenCalled(); expect(rows.get('assistantAutomationJobs/job').status).toBe('unknown');
  });
  it.each(['bad', undefined])('blocks a follow-up with invalid activation time %s', async createdAt => {
    vi.mocked(getConversation).mockResolvedValue({} as any);
    const { db, rows } = database(whatsapp, { createdAt }); await drainAssistantAutomations(db as any);
    expect(queueMessage).not.toHaveBeenCalled(); expect(rows.get('assistantAutomationJobs/job').status).toBe('blocked');
  });
  it('compares reply instants across timezone offsets', async () => {
    vi.mocked(getConversation).mockResolvedValue({ lastInboundAt: '2026-01-01T00:30:00Z' } as any);
    const { db, rows } = database(whatsapp, { createdAt: '2026-01-01T02:00:00+02:00' }); await drainAssistantAutomations(db as any);
    expect(queueMessage).not.toHaveBeenCalled(); expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ lastResult: { skipped: true } });
  });
  it('honors the global automation kill switch', async () => {
    vi.stubEnv('JARVIS_AUTOMATIONS', 'false'); const { db } = database(followup);
    expect(await drainAssistantAutomations(db as any)).toMatchObject({ disabled: true, processed: 0 }); expect(executeAction).not.toHaveBeenCalled();
  });
});
