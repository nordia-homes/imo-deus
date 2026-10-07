import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), getResource: vi.fn(), canReadResource: vi.fn(() => true) }));
vi.mock('../actions', () => ({ executeAction: vi.fn(async () => ({ taskId: 'task' })), matchContact: vi.fn() }));
vi.mock('../insights', () => ({ getInsights: vi.fn() }));
vi.mock('../search', async importOriginal => ({ ...await importOriginal<typeof import('../search')>(), searchProperties: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ getConversation: vi.fn() }));
vi.mock('@/lib/communications/outbound', () => ({ queueMessage: vi.fn() }));
vi.mock('../event-rules', () => ({ runEventRule: vi.fn() }));
import { drainAssistantAutomations } from '../automation-worker';
import { executeAction, matchContact } from '../actions';
import { matchingRevision } from '../matching-revision';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { getResource } from '../access';
import { runEventRule } from '../event-rules';
import { getInsights } from '../insights';
import * as insightNotifications from '../insight-notifications';
import { searchProperties } from '../search';
function database(automation: any, patch: any = {}) {
  const job = { id: 'job', agencyId: 'a', actorId: 'u', actorRole: 'agent', createdAt: '2026-01-01T00:00:00.000Z', status: 'active', nextRunAt: '2026-01-01T00:00:00.000Z', automation, ...patch };
  const rows = new Map<string, any>([['assistantAutomationJobs/job', job], ['agencies/a/assistantAutomations/job', { ...job }], ['users/u', { agencyId: 'a', role: 'agent' }]]);
  function ref(path: string, filters: any[] = [], limit = Infinity): any {
    return { path, id: path.split('/').at(-1), doc: (id: string) => ref(path + '/' + id), collection: (name: string) => ref(path + '/' + name), where: (key: string, op: string, value: any) => ref(path, [...filters, [key, op, value]], limit), orderBy: () => ref(path, filters, limit), limit: (value: number) => ref(path, filters, value), get: async () => ({ exists: rows.has(path), data: () => structuredClone(rows.get(path)), docs: [...rows].filter(([key, row]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, op, value]) => op === '<' ? row[field] < value : op === '<=' ? row[field] <= value : row[field] === value)).slice(0, limit).map(([key, row]) => ({ id: key.split('/').at(-1), ref: ref(key), data: () => structuredClone(row) })) }), update: async (value: any) => rows.set(path, { ...rows.get(path), ...value }) };
  }
  const db = { collection: ref, runTransaction: async (callback: any) => { const writes: (() => void)[] = []; const result = await callback({ get: (reference: any) => { if (writes.length) throw new Error('Read after write'); return reference.get(); }, update: (reference: any, value: any) => writes.push(() => rows.set(reference.path, { ...rows.get(reference.path), ...value })), create: (reference: any, value: any) => writes.push(() => rows.set(reference.path, value)) }); writes.forEach(write => write()); return result; } };
  return { db, rows };
}
it.each([false, true])('owner worker rechecks fresh listing state after search (changed: %s)', async changed => {
  const { db, rows } = database({ type: 'owner_watch', nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1, search: { scopeKey: 'brasov', priceMax: 120000 } });
  rows.set('ownerListings/p', { title: 'Live title', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale', price: '100000 EUR' });
  vi.mocked(searchProperties).mockImplementationOnce(async () => {
    if (changed) rows.set('ownerListings/p', { ...rows.get('ownerListings/p'), price: '200000 EUR' });
    return { rows: [{ id: 'p', title: 'Old title' }], nextCursor: 'continuation', complete: false } as any;
  });
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', scanCursor: 'continuation', lastResult: { partial: true, notificationResults: [{ status: changed ? 'skipped' : 'created' }] } });
  expect(rows.has('users/u/notifications/job-p')).toBe(!changed);
  if (!changed) expect(rows.get('users/u/notifications/job-p').body).toBe('Live title');
});
const followup = { type: 'followup_task', nextRunAt: '2026-01-01T00:00:00.000Z', contactId: 'c', description: 'Follow up', maxRuns: 1 };
const whatsapp = { type: 'whatsapp_template', nextRunAt: '2026-01-01T00:00:00.000Z', conversationId: 'conv', stopOnReply: true, template: { name: 'approved', language: 'ro', parameters: [] }, maxRuns: 1 };
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('approved automation execution', () => {
  it.each([false, true])('verifies matching sources after calculation and audits omission (changed: %s)', async changed => {
    const { db, rows } = database({ type: 'matching_watch', contactId: 'c', threshold: 80, limit: 5, nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1 });
    const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
    rows.set('agencies/a/contacts/c', contact); rows.set('agencies/a/properties/p', property);
    vi.mocked(matchContact).mockImplementationOnce(async () => {
      if (changed) rows.set('agencies/a/properties/p', { ...property, price: 180000 });
      return [{ id: 'p', title: 'Match', matchScore: 90, sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) }] as any;
    });
    await drainAssistantAutomations(db as any);
    expect(rows.has('users/u/notifications/job-p')).toBe(!changed);
    expect(rows.get('assistantAutomationJobs/job').lastResult.notificationResults[0]).toMatchObject(changed ? { status: 'skipped', reasonCode: 'state_changed' } : { status: 'created' });
    expect([...rows.entries()].find(([key]) => key.includes('/audit/'))?.[1].result.notificationResults).toHaveLength(1);
  });
  it.each([false, true])('defers a one-shot report without consuming its run and rereads current tasks (resolved: %s)', async resolved => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T19:30:00Z'));
    const { db, rows } = database({ type: 'insight_report', nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1, quietHours: { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' } });
    await drainAssistantAutomations(db as any);
    expect(getInsights).not.toHaveBeenCalled();
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'active', runCount: 0, nextRunAt: '2026-10-08T05:00:00.000Z', lastResult: { reasonCode: 'quiet_hours' } });
    vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
    rows.set('agencies/a/tasks/t', { status: resolved ? 'completed' : 'open', agentId: 'u', dueDate: '2020-01-01' });
    vi.mocked(getInsights).mockResolvedValueOnce({ rows: resolved ? [] : [{ id: 'task-t', taskId: 't', title: 'Overdue' }], complete: true } as any);
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', runCount: 1 });
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(resolved ? 0 : 1);
  });
  it('defers if quiet hours begin during report generation and honors stopAfter', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T18:59:59Z'));
    const { db, rows } = database({ type: 'insight_report', nextRunAt: '2020-01-01T00:00:00Z', stopAfter: '2026-10-07T20:00:00Z', maxRuns: 1, quietHours: { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' } });
    rows.set('agencies/a/tasks/t', { status: 'open', agentId: 'u', dueDate: '2020-01-01' });
    vi.mocked(getInsights).mockImplementationOnce(async () => { vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); return { rows: [{ id: 'task-t', taskId: 't', title: 'Overdue' }], complete: true } as any; });
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'active', runCount: 0, nextRunAt: '2026-10-07T20:00:00.000Z', lastResult: { reasonCode: 'quiet_hours' } });
    expect([...rows.keys()].filter(key => key.includes('/notifications/') || key.includes('/insightEffects/') || key.includes('/assistantNotificationState/'))).toHaveLength(0);
    vi.setSystemTime(new Date('2026-10-07T20:00:00Z'));
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', lastResult: { skipped: true } });
  });
  it('resumes a partially delivered report without repeating the first notification', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T18:59:59Z'));
    const { db, rows } = database({ type: 'insight_report', nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1, quietHours: { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' } });
    for (const id of ['a', 'b']) rows.set(`agencies/a/tasks/${id}`, { status: 'open', agentId: 'u', dueDate: '2020-01-01' });
    const report = { rows: ['a', 'b'].map(id => ({ id: `task-${id}`, taskId: id, title: 'Overdue' })), complete: true } as any;
    vi.mocked(getInsights).mockResolvedValueOnce(report).mockResolvedValueOnce(report);
    const original = insightNotifications.createInsightNotification;
    vi.spyOn(insightNotifications, 'createInsightNotification').mockImplementationOnce(async (...args) => {
      const result = await original(...args); vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); return result;
    });
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 0, status: 'active', lastResult: { reasonCode: 'quiet_hours' } });
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 1, status: 'completed' });
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(2);
  });
  it.each([false, true])('uses live task state and bounded notification IDs (resolved: %s)', async resolved => {
    const taskId = 't'.repeat(180);
    const { db, rows } = database({ type: 'insight_report', nextRunAt: '2020-01-01T00:00:00.000Z', maxRuns: 1, limit: 5 });
    rows.set(`agencies/a/tasks/${taskId}`, { status: resolved ? 'completed' : 'open', agentId: 'u', dueDate: '2020-01-01' });
    vi.mocked(getInsights).mockResolvedValueOnce({ rows: [{ id: `task-${taskId}`, taskId, title: 'Overdue' }], complete: true } as any);
    await drainAssistantAutomations(db as any);
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', lastResult: { notificationResults: [expect.objectContaining({ status: resolved ? 'skipped' : 'created' })] } });
    const notifications = [...rows].filter(([key]) => key.includes('/notifications/'));
    expect(notifications).toHaveLength(resolved ? 0 : 1);
    if (!resolved) expect(notifications[0][1].eventId).toMatch(/^insight-[a-f0-9]{64}$/);
  });
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

const watchQuiet = { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' };
it.each(['owner_watch', 'matching_watch'] as const)('defers %s before reading data and preserves progress until stopAfter', async type => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T19:00:00Z'));
  const { db, rows } = database({ type, nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1, stopAfter: '2026-10-07T20:00:00Z', quietHours: watchQuiet, ...(type === 'owner_watch' ? { search: {} } : { contactId: 'c' }) }, { scanCursor: 'saved-page' });
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'active', runCount: 0, nextRunAt: '2026-10-07T20:00:00.000Z', lastResult: { reasonCode: 'quiet_hours' }, ...(type === 'owner_watch' ? { scanCursor: 'saved-page' } : {}) });
  expect(searchProperties).not.toHaveBeenCalled(); expect(matchContact).not.toHaveBeenCalled();
  vi.setSystemTime(new Date('2026-10-07T20:00:00Z'));
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', lastResult: { skipped: true } });
});
it.each(['owner_watch', 'matching_watch'] as const)('resumes %s mid-page without losing or repeating notifications and rechecks sources', async type => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-07T18:59:59Z'));
  const { db, rows } = database({ type, nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1, quietHours: watchQuiet, ...(type === 'owner_watch' ? { search: { scopeKey: 'brasov' } } : { contactId: 'c' }) }, { scanCursor: 'saved-page' });
  const contact = { status: 'Nou', budget: 150000 }; rows.set('agencies/a/contacts/c', contact);
  const cards = ['a', 'b', 'c'].map(id => {
    const source = { title: id, status: 'Activ', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale', price: '100000 EUR' };
    rows.set(type === 'owner_watch' ? `ownerListings/${id}` : `agencies/a/properties/${id}`, source);
    return { id, title: id, matchScore: 90, sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(source) };
  });
  if (type === 'owner_watch') vi.mocked(searchProperties).mockResolvedValue({ rows: cards, nextCursor: 'next-page', complete: false } as any);
  else vi.mocked(matchContact).mockResolvedValue(cards as any);
  const originalTransaction = db.runTransaction;
  let crossed = false;
  db.runTransaction = async callback => {
    const result = await originalTransaction(callback);
    if (!crossed && rows.has('users/u/notifications/job-a')) { crossed = true; vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); }
    return result;
  };
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 0, status: 'active', lastResult: { reasonCode: 'quiet_hours' }, ...(type === 'owner_watch' ? { scanCursor: 'saved-page' } : {}) });
  expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toEqual(['users/u/notifications/job-a']);
  rows.delete(type === 'owner_watch' ? 'ownerListings/b' : 'agencies/a/properties/b');
  vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 1, status: 'completed', ...(type === 'owner_watch' ? { scanCursor: 'next-page' } : {}) });
  expect([...rows.keys()].filter(key => key.includes('/notifications/')).sort()).toEqual(['users/u/notifications/job-a', 'users/u/notifications/job-c']);
  if (type === 'owner_watch') expect(vi.mocked(searchProperties).mock.calls.at(-1)?.[1].cursor).toBe('saved-page');
});

it.each(['owner_watch', 'matching_watch'].flatMap(type => ['resume', 'stop', 'quiet'].map(mode => [type, mode])))('preserves %s progress after a shared cap (%s)', async (type, mode) => {
  vi.useFakeTimers({ toFake: ['Date'] }); const now = Date.parse('2026-10-07T12:00:00Z'); vi.setSystemTime(now);
  const { db, rows } = database({ type, nextRunAt: '2020-01-01T00:00:00Z', maxRuns: 1,
    ...(mode === 'stop' ? { stopAfter: new Date(now + 22 * 3600000).toISOString() } : {}),
    ...(mode === 'quiet' ? { quietHours: { timezone: 'UTC', start: '10:00', end: '12:00' } } : {}),
    ...(type === 'owner_watch' ? { search: { scopeKey: 'brasov' } } : { contactId: 'c' }) }, { scanCursor: 'saved-page' });
  rows.set(`agencies/a/assistantNotificationState/budget-${createHash('sha256').update('u').digest('hex')}`, { actorId: 'u', deliveries: Array(9).fill(now - 3600000) });
  const contact = { status: 'Nou', budget: 150000 }; rows.set('agencies/a/contacts/c', contact);
  const cards = ['a', 'b', 'c'].map(id => {
    const source = { title: id, status: 'Activ', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale', price: '100000 EUR' };
    rows.set(type === 'owner_watch' ? `ownerListings/${id}` : `agencies/a/properties/${id}`, source);
    return { id, title: id, matchScore: 90, sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(source) };
  });
  if (type === 'owner_watch') vi.mocked(searchProperties).mockResolvedValue({ rows: cards, nextCursor: 'next-page', complete: false } as any);
  else vi.mocked(matchContact).mockResolvedValue(cards as any);
  await drainAssistantAutomations(db as any);
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 0, status: 'active', nextRunAt: new Date(now + (mode === 'stop' ? 22 : 23) * 3600000).toISOString(), lastResult: { reasonCode: 'notification_cap' }, ...(type === 'owner_watch' ? { scanCursor: 'saved-page' } : {}) });
  expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toEqual(['users/u/notifications/job-a']);
  rows.delete(type === 'owner_watch' ? 'ownerListings/b' : 'agencies/a/properties/b');
  vi.setSystemTime(now + (mode === 'stop' ? 22 : 23) * 3600000);
  await drainAssistantAutomations(db as any);
  if (mode === 'quiet') {
    expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ runCount: 0, status: 'active', lastResult: { reasonCode: 'quiet_hours' }, ...(type === 'owner_watch' ? { scanCursor: 'saved-page' } : {}) });
    vi.setSystemTime(now + 24 * 3600000); await drainAssistantAutomations(db as any);
  }
  expect(rows.get('assistantAutomationJobs/job')).toMatchObject({ status: 'completed', runCount: 1 });
  expect([...rows.keys()].filter(key => key.includes('/notifications/')).sort()).toEqual(mode === 'stop' ? ['users/u/notifications/job-a'] : ['users/u/notifications/job-a', 'users/u/notifications/job-c']);
  if (type === 'owner_watch' && mode !== 'stop') expect(vi.mocked(searchProperties).mock.calls.at(-1)?.[1].cursor).toBe('saved-page');
});
