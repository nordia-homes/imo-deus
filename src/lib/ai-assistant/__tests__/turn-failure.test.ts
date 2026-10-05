import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), referencesAllowed: vi.fn(async () => true), actionReferences: () => [] }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { chatTurn } from '../workspace';
import { planTurn } from '../planner';
import { failureCategory } from '../failure';
function fixture() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }]]);
  function ref(path: string): any {
    return { id: path.split('/').at(-1), path, doc: (id: string) => ref(`${path}/${id}`), collection: (name: string) => ref(`${path}/${name}`), orderBy() { return this; }, limit() { return this; }, get: async () => ({ id: path.split('/').at(-1), exists: rows.has(path), data: () => rows.get(path), docs: [...rows].filter(([key]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1).map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value })), size: 1 }) };
  }
  const db: any = { collection: ref, runTransaction: async (callback: any) => {
    const writes: (() => void)[] = [];
    const tx = { get: (r: any) => { if (writes.length) throw new Error('Read after write'); return r.get(); }, create: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), set: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) };
    const result = await callback(tx); writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any };
}
afterEach(() => vi.restoreAllMocks());
describe('durable visible turn failures', () => {
  it('persists an honest failure reply and clears locks without retrying effects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(planTurn).mockRejectedValue(new Error('private provider payload'));
    const { ctx, rows } = fixture();
    const input = { sessionId: 's', requestId: 'r', prompt: 'Cerere' };
    const result = await chatTurn(ctx, input);
    expect(result.message.outputType).toBe('ERROR_EVENT');
    expect(result.message.text).not.toContain('private');
    expect(rows.get('agencies/a/assistantSessions/s/messages/r-assistant')).toEqual(result.message);
    expect(rows.get('agencies/a/assistantLocks/chat-u').busyUntil).toBe(0);
    expect((await chatTurn(ctx, input)).message).toEqual(result.message);
    expect(planTurn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(JSON.stringify({ event: 'jarvis_turn_failed', category: 'unexpected' }));
  });
  it('does not publish a reply after membership revocation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ctx, rows } = fixture();
    vi.mocked(planTurn).mockImplementationOnce(async () => { rows.set('users/u', { agencyId: 'b', role: 'agent' }); throw new Error('revoked'); });
    await expect(chatTurn(ctx, { sessionId: 's', requestId: 'r', prompt: 'Cerere' })).rejects.toThrow('revoked');
    expect(rows.has('agencies/a/assistantSessions/s/messages/r-assistant')).toBe(false);
  });
  it('logs only fixed error categories', () => { expect(failureCategory({ code: 9, message: 'secret' })).toBe('precondition'); expect(failureCategory({ status: 403 })).toBe('access'); expect(failureCategory(new Error('secret'))).toBe('unexpected'); });
});
