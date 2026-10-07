import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resource: vi.fn(), allowed: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(resource), getResource: mocks.resource, canReadResource: mocks.allowed }));
import { automationSchema } from '../contracts';
import { matchesRuleEvent, runEventRule, type EventRule } from '../event-rules';
const startedAt = '2026-10-05T10:00:00.000Z';
const rule = automationSchema.parse({ type: 'event_rule', nextRunAt: '2026-10-05T10:30:00.000Z', intervalMinutes: 30, maxRuns: 100, trigger: { resource: 'contacts', change: 'updated', changedFields: ['status'], statusFrom: 'Nou', statusTo: 'Contactat' }, effects: [{ kind: 'create_task', description: 'Follow-up', dueAfterMinutes: 60 }, { kind: 'notify', title: 'Client contactat' }] }) as EventRule;
const event = (id = 'e', patch: Record<string, any> = {}) => ({ id, source: 'firestore_change', capability: 'contacts.updated', occurredAt: '2026-10-05T10:10:00.000Z', recordedAt: '2026-10-05T10:11:00.000Z', entities: { contactId: 'c' }, changedFields: ['status'], ruleState: { before: { status: 'Nou' }, after: { status: 'Contactat' } }, ...patch });
function database(events: any[]) {
  const rows = new Map<string, any>(events.map(row => ['agencies/a/crmEvents/' + row.id, row])); rows.set('users/u', { agencyId: 'a', role: 'agent' }); rows.set('agencies/a/contacts/c', { status: 'Contactat' });
  function ref(path: string, filters: any[] = [], cursor?: [string, string]): any {
    return { path, id: path.split('/').at(-1), collection: (id: string) => ref(path + '/' + id), doc: (id: string) => ref(path + '/' + id), where: (key: string, _op: string, value: any) => ref(path, [...filters, [key, value]], cursor), orderBy: () => ref(path, filters, cursor), limit: () => ref(path, filters, cursor), startAfter: (at: string, id: string) => ref(path, filters, [at, id]), get: async () => {
      const docs = [...rows].filter(([key, value]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, minimum]) => value[field] >= minimum) && (!cursor || value.recordedAt > cursor[0] || value.recordedAt === cursor[0] && key.split('/').at(-1)! > cursor[1])).sort(([a, av], [b, bv]) => av.recordedAt?.localeCompare(bv.recordedAt) || a.localeCompare(b)).slice(0, 100).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value, ref: ref(key) }));
      return { exists: rows.has(path), data: () => rows.get(path), docs, size: docs.length };
    } };
  }
  return { rows, db: { collection: ref, runTransaction: async (callback: any) => callback({ get: (r: any) => r.get(), create: (r: any, data: any) => { if (rows.has(r.path)) throw new Error('Duplicate create'); rows.set(r.path, data); } }) } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.allowed.mockReturnValue(true); mocks.resource.mockResolvedValue({ status: 'Contactat' }); });
describe('event rules: filtering, delayed delivery and idempotency', () => {
  it('accepts only matching projected transitions after rule creation', () => {
    expect(matchesRuleEvent(rule, event(), startedAt)).toBe(true);
    for (const patch of [{ source: 'ai_assistant' }, { capability: 'contacts.created' }, { occurredAt: '2026-10-05T09:00:00.000Z' }, { changedFields: ['budget'] }, { ruleState: { before: { status: 'Contactat' }, after: { status: 'Contactat' } } }]) expect(matchesRuleEvent(rule, event('e', patch), startedAt)).toBe(false);
  });
  it('deduplicates an event and derives a stable task deadline from its original time', async () => {
    const { db, rows } = database([event()]), execute = vi.fn(async () => ({ taskId: 't' })), ctx = { adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any, claim = { id: 'rule', createdAt: startedAt };
    const first = await runEventRule(ctx, claim, rule, execute, async () => {});
    await runEventRule(ctx, claim, rule, execute, async () => {});
    expect(execute).toHaveBeenCalledTimes(1); expect((execute.mock.calls as unknown[][])[0][1]).toMatchObject({ contactId: 'c', dueDate: '2026-10-05T11:10:00.000Z' });
    expect(first).toMatchObject({ handled: 1, eventCount: 1, eventCursor: { id: 'e' } });
    expect([...rows.keys()].filter(key => key.includes('/events/'))).toHaveLength(1); expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(1);
  });
  it('picks up a late projection after the persisted cursor without replaying old corpus', async () => {
    const { db } = database([event('late', { recordedAt: '2026-10-05T12:00:00.000Z' }), event('historical', { occurredAt: '2026-10-05T09:00:00.000Z', recordedAt: '2026-10-05T13:00:00.000Z' })]), execute = vi.fn(async () => ({}));
    const result = await runEventRule({ adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any, { id: 'r', createdAt: startedAt, eventCursor: { recordedAt: '2026-10-05T11:00:00.000Z', id: 'old' } }, rule, execute, async () => {});
    expect(execute).toHaveBeenCalledTimes(1); expect(result.eventCursor.id).toBe('historical');
  });
  it('skips revoked or now irrelevant records and enforces the event cap', async () => {
    const { db } = database([event('a'), event('b')]), execute = vi.fn(async () => ({})), ctx = { adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any;
    mocks.resource.mockResolvedValue({ status: 'Câștigat' }); await runEventRule(ctx, { id: 'r', createdAt: startedAt }, rule, execute, async () => {}); expect(execute).not.toHaveBeenCalled();
    mocks.resource.mockRejectedValue(Object.assign(new Error('Revoked'), { status: 403 })); expect((await runEventRule(ctx, { id: 'r', createdAt: startedAt }, rule, execute, async () => {})).inaccessible).toBe(2);
    mocks.resource.mockResolvedValue({ status: 'Contactat' }); expect((await runEventRule(ctx, { id: 'r', createdAt: startedAt }, { ...rule, maxEvents: 1 }, execute, async () => {})).limitReached).toBe(true); expect(execute).toHaveBeenCalledTimes(1);
  });
  it('does not accept sends, arbitrary endpoints or recursive effects in a rule', () => {
    expect(automationSchema.safeParse({ ...rule, effects: [{ kind: 'existing_operation', operation: 'send' }] }).success).toBe(false);
    expect(automationSchema.safeParse({ ...rule, trigger: { resource: 'tasks', change: 'created' } }).success).toBe(false);
  });
  it.each(['Câștigat', undefined])('records a skipped notification when live status becomes %s', async status => {
    const { db, rows } = database([event()]);
    rows.set('agencies/a/contacts/c', { status });
    const ctx = { adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any;
    await runEventRule(ctx, { id: 'r', createdAt: startedAt }, { ...rule, effects: [rule.effects[1]] }, vi.fn(), async () => {});
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(0);
    const receipt = [...rows].find(([key]) => key.includes('/events/') && !key.includes('/effects/'))![1];
    expect(receipt.effects).toEqual([{ status: 'skipped', reasonCode: 'state_changed', entityId: 'c' }]);
  });
  it('keeps a committed skip after interruption even if the old status returns', async () => {
    const { db, rows } = database([event()]);
    const ctx = { adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any;
    const notificationFirst = { ...rule, effects: [rule.effects[1], rule.effects[0]] };
    rows.set('agencies/a/contacts/c', { status: 'Câștigat' });
    let checks = 0;
    await expect(runEventRule(ctx, { id: 'r', createdAt: startedAt }, notificationFirst, vi.fn(), async () => {
      if (++checks === 3) throw new Error('Interrupted');
    })).rejects.toThrow('Interrupted');
    rows.set('agencies/a/contacts/c', { status: 'Contactat' });
    await runEventRule(ctx, { id: 'r', createdAt: startedAt }, notificationFirst, vi.fn(async () => ({ taskId: 't' })), async () => {});
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(0);
    const receipt = [...rows].find(([key]) => key.includes('/events/') && !key.includes('/effects/'))![1];
    expect(receipt.effects[0]).toMatchObject({ status: 'skipped', reasonCode: 'state_changed' });
  });
  it('allows status changes for rules without a status condition', async () => {
    const { db, rows } = database([event()]);
    rows.set('agencies/a/contacts/c', { status: 'Câștigat' });
    await runEventRule({ adminDb: db, agencyId: 'a', uid: 'u', role: 'agent' } as any, { id: 'r', createdAt: startedAt },
      { ...rule, trigger: { resource: 'contacts', change: 'updated' }, effects: [rule.effects[1]] }, vi.fn(), async () => {});
    expect([...rows.keys()].filter(key => key.includes('/notifications/'))).toHaveLength(1);
  });
});
