import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), getResource: vi.fn() }));
vi.mock('../operations', () => ({ operations: { message_send: {} }, isReadOperation: () => false, invokeOperation: vi.fn() }));
vi.mock('@/lib/matching-engine', () => ({ getDeterministicMatchedProperties: vi.fn() }));
vi.mock('@/lib/demo/guards', () => ({ isDemoAgencyId: () => false }));
vi.mock('@/lib/owner-listings/utils', () => ({ toPropertySeed: vi.fn() }));
import { executeAction } from '../actions';
import { invokeOperation } from '../operations';
import type { AssistantContext } from '../access';
import { OperationFailure } from '../operation-error';

function memory(initial: Record<string, any> = {}) {
  const records = new Map<string, any>(Object.entries({ 'users/u': { agencyId: 'a', role: 'agent' }, ...initial }));
  function ref(path: string): any {
    const filters: [string, string, any][] = [];
    const value: any = { path, id: path.split('/').at(-1), collection: (name: string) => ref(path + '/' + name), doc: (id: string) => ref(path + '/' + id), where: (field: string, op: string, expected: any) => { filters.push([field, op, expected]); return value; }, get: async () => snapshot(value), update: async (patch: any) => { records.set(path, { ...records.get(path), ...patch }); } };
    value.filters = filters; return value;
  }
  function snapshot(reference: any): any {
    if (reference.filters.length) {
      const docs = [...records].filter(([path, row]) => path.startsWith(reference.path + '/') && path.split('/').length === reference.path.split('/').length + 1 && reference.filters.every(([field, op, expected]: any) => op === '>=' ? row[field] >= expected : op === '<' ? row[field] < expected : row[field] === expected)).map(([path, row]) => ({ id: path.split('/').at(-1), data: () => structuredClone(row) }));
      return { docs, empty: !docs.length };
    }
    return { exists: records.has(reference.path), data: () => records.has(reference.path) ? structuredClone(records.get(reference.path)) : undefined };
  }
  const db = { collection: ref, runTransaction: async (callback: any) => {
    const writes: (() => void)[] = [];
    const tx = { get: async (r: any) => { if (writes.length) throw new Error('Firestore read after write'); return snapshot(r); }, create: (r: any, row: any) => writes.push(() => { if (records.has(r.path)) throw new Error('Duplicate create'); records.set(r.path, structuredClone(row)); }), set: (r: any, row: any, options?: any) => writes.push(() => records.set(r.path, { ...(options?.merge ? records.get(r.path) : {}), ...structuredClone(row) })), update: (r: any, patch: any) => writes.push(() => { if (!records.has(r.path)) throw new Error('Missing update'); records.set(r.path, { ...records.get(r.path), ...structuredClone(patch) }); }) };
    const result = await callback(tx); for (const write of writes) write(); return result;
  } };
  return { records, ctx: { adminDb: db, uid: 'u', agencyId: 'a', role: 'agent' } as unknown as AssistantContext };
}
describe('atomic CRM execution', () => {
  it('replays a confirmed action without creating a second contact', async () => {
    const { ctx, records } = memory();
    const action = { kind: 'create_contact' as const, name: 'Client', phone: '', email: '', contactType: 'Cumparator' as const };
    expect(await executeAction(ctx, action, 'p-0')).toEqual(await executeAction(ctx, action, 'p-0'));
    expect([...records.keys()].filter(key => key.includes('/contacts/'))).toHaveLength(1);
  });
  it('does not write anything when membership was revoked', async () => {
    const { ctx, records } = memory({ 'users/u': { agencyId: 'other', role: 'agent' } });
    await expect(executeAction(ctx, { kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00.000Z' }, 'p-0')).rejects.toThrow('Acces revocat');
    expect([...records.keys()]).toEqual(['users/u']);
  });
  it('rejects a role downgrade inside the write transaction', async () => {
    const { ctx, records } = memory();
    ctx.role = 'admin';
    await expect(executeAction(ctx, { kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00.000Z' }, 'p-0')).rejects.toThrow('Acces revocat');
    expect([...records.keys()]).toEqual(['users/u']);
  });
  it('rejects a conflicting viewing and leaves no partially saved action', async () => {
    const { ctx, records } = memory({ 'agencies/a/contacts/c': { name: 'Client' }, 'agencies/a/properties/p': { status: 'Activ', title: 'Apartament' }, 'agencies/a/viewings/old': { viewingDate: '2030-01-01T10:00:00.000Z', duration: 60, status: 'scheduled', agentId: 'u', contactId: 'other', propertyId: 'other' } });
    await expect(executeAction(ctx, { kind: 'schedule_viewing', contactId: 'c', propertyId: 'p', viewingDate: '2030-01-01T10:30:00.000Z', duration: 60, notes: '' }, 'p-0')).rejects.toThrow('suprapune');
    expect(records.has('agencies/a/viewings/p-0')).toBe(false);
    expect(records.has('agencies/a/assistantExecutions/p-0')).toBe(false);
  });
  it('preserves the client feedback when recommending an existing offer again', async () => {
    const feedback = { propertyId: 'p', clientFeedback: 'liked', comment: 'Vreau o vizionare' };
    const { ctx, records } = memory({ 'agencies/a/contacts/c': { name: 'Client', portalId: 'portal' }, 'agencies/a/properties/p': { status: 'Activ' }, 'portals/portal': { agencyId: 'a', contactId: 'c' }, 'portals/portal/recommendations/p': feedback });
    await executeAction(ctx, { kind: 'recommend_properties', contactId: 'c', propertyIds: ['p', 'p'] }, 'p-0');
    expect(records.get('portals/portal/recommendations/p')).toEqual(feedback);
    expect(records.get('agencies/a/contacts/c').recommendationHistory.p).toEqual(feedback);
  });
  it('never resends an external action after an ambiguous provider outcome', async () => {
    vi.mocked(invokeOperation).mockReset().mockRejectedValue(new Error('Provider timeout'));
    const { ctx, records } = memory();
    const action = { kind: 'existing_operation' as const, operation: 'message_send', params: {}, query: {}, body: {} };
    await expect(executeAction(ctx, action, 'p-0')).rejects.toThrow('Provider timeout');
    await expect(executeAction(ctx, action, 'p-0')).rejects.toThrow('verificată');
    expect(invokeOperation).toHaveBeenCalledTimes(1);
    expect(records.get('agencies/a/assistantExecutions/p-0').status).toBe('unknown');
  });
  it('preserves actual partial domain results for inspection without marking the action completed', async () => {
    vi.mocked(invokeOperation).mockReset().mockRejectedValue(new OperationFailure('Partial removal', 409, { complete: false, portals: [{ portal: 'storia', state: 'pending' }], accessToken: 'DO_NOT_STORE' }));
    const { ctx, records } = memory();
    await expect(executeAction(ctx, { kind: 'existing_operation', operation: 'message_send', params: {}, query: {}, body: {} }, 'p-0')).rejects.toThrow('Partial');
    expect(records.get('agencies/a/assistantExecutions/p-0')).toMatchObject({ status: 'unknown', result: { complete: false, portals: [{ state: 'pending' }] } });
    expect(records.get('agencies/a/assistantExecutions/p-0').result).not.toHaveProperty('accessToken');
  });
  it('keeps a successful HTTP response with unknown domain status unconfirmed and blocks replay', async () => {
    vi.mocked(invokeOperation).mockReset().mockResolvedValue({ status: 'unknown', messageId: 'm' });
    const { ctx, records } = memory(), action = { kind: 'existing_operation' as const, operation: 'message_send', params: {}, query: {}, body: {} };
    await expect(executeAction(ctx, action, 'p-0')).rejects.toThrow('incert'); await expect(executeAction(ctx, action, 'p-0')).rejects.toThrow('verificată');
    expect(invokeOperation).toHaveBeenCalledTimes(1); expect(records.get('agencies/a/assistantExecutions/p-0')).toMatchObject({ status: 'unknown', result: { status: 'unknown', messageId: 'm' } });
  });
});
