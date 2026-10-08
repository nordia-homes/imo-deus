import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: vi.fn() }));
vi.mock('../access', () => ({ getResource: vi.fn(), collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), referencesAllowed: vi.fn(async () => true), actionReferences: () => [] }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { chatTurn } from '../workspace';
import { planTurn } from '../planner';
import { getResource } from '../access';
import { failureCategory } from '../failure';
import { saveWorkerTurnFailure } from '../worker-failure';
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
  it('passes the authorized current page to planning and preserves its provenance in history', async () => {
    const { ctx, rows } = fixture();
    vi.mocked(getResource).mockResolvedValueOnce({ id: 'andrei', name: 'Andrei' });
    vi.mocked(planTurn).mockResolvedValueOnce({ text: 'Citire confirmată.', cards: [], actions: [], accessRefs: [{ resource: 'contacts', id: 'andrei' }], metrics: { status: 'success', elapsedMs: 0, tools: [], models: [] } });
    await chatTurn(ctx, { sessionId: 's', requestId: 'r', prompt: 'Clientul deschis acum.', currentRecord: { resource: 'contacts', id: 'andrei' } });
    expect(planTurn).toHaveBeenCalledWith(ctx, 'Clientul deschis acum.', expect.arrayContaining([expect.objectContaining({ id: 'current-page-context', accessRefs: [{ resource: 'contacts', id: 'andrei' }] })]), expect.anything());
    expect(rows.get('agencies/a/assistantSessions/s/messages/r-user')).toMatchObject({ text: 'Clientul deschis acum.', cards: [{ source: 'contacts', rows: [{ id: 'andrei', name: 'Andrei' }] }], accessRefs: [{ resource: 'contacts', id: 'andrei' }] });
  });
  const workerInput = { sessionId: 's', requestId: 'r', prompt: 'Cerere' };
  const workerJob = { ...workerInput, userId: 'u', agencyId: 'a', role: 'agent', jobType: 'turn', status: 'running', claimId: 'claim' };
  it('publishes an early worker failure without clearing another active conversation lock', async () => {
    const { ctx, rows } = fixture();
    rows.set('assistantAgentJobs/r', workerJob);
    rows.set('agencies/a/assistantSessions/s', { ownerId: 'u', busyUntil: 9999999999999, turnId: 'other' });
    rows.set('agencies/a/assistantLocks/chat-u', { busyUntil: 9999999999999, turnId: 'other' });
    const message = await saveWorkerTurnFailure(ctx, workerInput, 'claim');
    expect(message?.outputType).toBe('ERROR_EVENT');
    expect(rows.get('agencies/a/assistantSessions/s/messages/r-assistant')).toEqual(message);
    expect(rows.get('agencies/a/assistantSessions/s').turnId).toBe('other');
    expect(rows.get('agencies/a/assistantLocks/chat-u').busyUntil).toBe(9999999999999);
    expect(await saveWorkerTurnFailure(ctx, workerInput, 'claim')).toBeNull();
  });
  it('refuses an expired worker claim, revoked member, foreign session and substituted prompt', async () => {
    const { ctx, rows } = fixture(); rows.set('assistantAgentJobs/r', workerJob);
    expect(await saveWorkerTurnFailure(ctx, workerInput, 'old-claim')).toBeNull();
    expect(await saveWorkerTurnFailure(ctx, { ...workerInput, prompt: 'Substituit' }, 'claim')).toBeNull();
    rows.set('users/u', { agencyId: 'b', role: 'agent' }); expect(await saveWorkerTurnFailure(ctx, workerInput, 'claim')).toBeNull();
    rows.set('users/u', { agencyId: 'a', role: 'agent' }); rows.set('agencies/a/assistantSessions/s', { ownerId: 'other' }); expect(await saveWorkerTurnFailure(ctx, workerInput, 'claim')).toBeNull();
    expect([...rows.keys()].some(key => key.includes('/messages/'))).toBe(false);
  });
  it('creates a missing own conversation for the failed queued request but never replaces a confirmed reply', async () => {
    const { ctx, rows } = fixture(); rows.set('assistantAgentJobs/r', workerJob);
    expect((await saveWorkerTurnFailure(ctx, workerInput, 'claim'))?.outputType).toBe('ERROR_EVENT');
    expect(rows.get('agencies/a/assistantSessions/s')).toMatchObject({ ownerId: 'u', busyUntil: 0 });
    rows.set('agencies/a/assistantSessions/s/messages/r-assistant', { role: 'assistant', text: 'Rezultat confirmat' });
    expect(await saveWorkerTurnFailure(ctx, workerInput, 'claim')).toBeNull();
    expect(rows.get('agencies/a/assistantSessions/s/messages/r-assistant').text).toBe('Rezultat confirmat');
  });
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
