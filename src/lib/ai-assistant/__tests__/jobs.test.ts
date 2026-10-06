import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${name}`), referencesAllowed: vi.fn(async () => true) }));
vi.mock('../workspace', () => ({ chatTurn: vi.fn(async () => ({ message: { id: 'reply', text: 'Confirmed fixture', accessRefs: [] } })), runPlan: vi.fn(async () => ({ status: 'unknown' })), getPlan: vi.fn(async () => ({ data: { status: 'pending' } })) }));
import { enqueueTurn, readJob, drainAgentJobs } from '../jobs';
import { chatTurn, runPlan } from '../workspace';
import type { AssistantContext } from '../access';
function database(initial: Record<string, any> = {}) {
  const rows = new Map<string, any>(Object.entries({ 'users/u': { agencyId: 'a', role: 'agent' }, ...initial }));
  function ref(path: string, filters: any[] = [], cap = Infinity): any {
    const value = { path, id: path.split('/').at(-1), doc: (id: string) => ref(path + '/' + id), collection: (name: string) => ref(path + '/' + name), where: (key: string, op: string, expected: any) => ref(path, [...filters, [key, op, expected]], cap), limit: (limit: number) => ref(path, filters, limit), orderBy: () => ref(path, filters, cap), get: async () => {
      const docs = [...rows].filter(([key, row]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, op, expected]) => op === '<' ? row[field] < expected : row[field] === expected)).slice(0, cap).map(([key, row]) => ({ id: key.split('/').at(-1), ref: ref(key), data: () => structuredClone(row) }));
      return { exists: rows.has(path), data: () => structuredClone(rows.get(path)), docs, size: docs.length };
    }, update: async (patch: any) => rows.set(path, { ...rows.get(path), ...patch }) }; return value;
  }
  const db = { collection: ref, runTransaction: async (work: any) => { const writes: (() => void)[] = []; const tx = { get: (reference: any) => { if (writes.length) throw new Error('Read after write'); return reference.get(); }, set: (reference: any, value: any) => writes.push(() => rows.set(reference.path, value)), create: (reference: any, value: any) => writes.push(() => { if (rows.has(reference.path)) throw new Error('duplicate'); rows.set(reference.path, value); }), update: (reference: any, value: any) => writes.push(() => rows.set(reference.path, { ...rows.get(reference.path), ...value })) }; const result = await work(tx); writes.forEach(write => write()); return result; } };
  return { rows, db, ctx: { agencyId: 'a', uid: 'u', role: 'agent', runtimeMode: 'real', adminDb: db } as unknown as AssistantContext };
}
const input = { sessionId: 'session', requestId: 'request', prompt: 'Read authorized data' };
afterEach(() => vi.clearAllMocks());
describe('durable tenant-scoped jobs', () => {
  it('delivers an early turn exception as a conversation error while the job stays failed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(chatTurn).mockRejectedValueOnce(new Error('private provider payload'));
    const { ctx, db, rows } = database(); await enqueueTurn(ctx, input); await drainAgentJobs(db as any);
    expect(rows.get('assistantAgentJobs/request')).toMatchObject({ status: 'failed', planStatus: 'failed', message: { outputType: 'ERROR_EVENT' } });
    expect(rows.get('agencies/a/assistantSessions/session/messages/request-assistant').text).not.toContain('private');
    expect(chatTurn).toHaveBeenCalledTimes(1); log.mockRestore();
  });
  it('keeps a delivered failure reply separate from business success', async () => {
    vi.mocked(chatTurn).mockResolvedValueOnce({ message: { id: 'reply', text: 'Not confirmed', outputType: 'ERROR_EVENT' } } as any);
    const { ctx, db, rows } = database(); await enqueueTurn(ctx, input); await drainAgentJobs(db as any);
    expect(rows.get('assistantAgentJobs/request')).toMatchObject({ status: 'completed', planStatus: 'failed', message: { outputType: 'ERROR_EVENT' } });
    expect(await readJob(ctx, 'request')).toMatchObject({ status: 'completed', businessStatus: 'failed' });
  });
  it('enqueues idempotently and stores no bearer tokens', async () => { const { ctx, rows } = database(); await enqueueTurn(ctx, input); await enqueueTurn(ctx, input); expect(rows.get('assistantAgentJobs/request')).toMatchObject({ status: 'pending', userId: 'u', agencyId: 'a', attempts: 0 }); expect(rows.get('assistantAgentJobs/request')).not.toHaveProperty('authorization'); expect(rows.size).toBe(3); });
  it('rejects another owner session and a second pending command', async () => { const { ctx } = database({ 'agencies/a/assistantSessions/other': { ownerId: 'other' } }); await expect(enqueueTurn(ctx, { ...input, sessionId: 'other' })).rejects.toThrow(); await enqueueTurn(ctx, input); await expect(enqueueTurn(ctx, { ...input, requestId: 'second' })).rejects.toThrow('deja'); });
  it('does not expose another actor or tenant job', async () => { const { ctx } = database({ 'assistantAgentJobs/request': { agencyId: 'b', userId: 'u', status: 'pending' } }); await expect(readJob(ctx, 'request')).rejects.toThrow('inaccesibil'); });
  it('rejects revoked membership before reading results', async () => { const { ctx } = database({ 'users/u': { agencyId: 'b', role: 'agent' } }); await expect(readJob(ctx, 'request')).rejects.toThrow('revocat'); });
  it('runs a saved turn without a browser or persisted bearer and commits its final state', async () => { const { ctx, db, rows } = database(); await enqueueTurn(ctx, input); expect(await drainAgentJobs(db as any)).toMatchObject({ processed: 1 }); expect(chatTurn).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'a', uid: 'u', authorization: '' }), input, expect.any(Function)); expect(rows.get('assistantAgentJobs/request').status).toBe('completed'); });
  it('blocks a job after role changes without invoking the model', async () => { const { ctx, db, rows } = database(); await enqueueTurn(ctx, input); rows.set('users/u', { agencyId: 'a', role: 'admin' }); await drainAgentJobs(db as any); expect(chatTurn).not.toHaveBeenCalled(); expect(rows.get('assistantAgentJobs/request').status).toBe('failed'); });
  it('never replays an interrupted confirmed plan automatically', async () => { const { db, rows } = database({ 'assistantAgentJobs/plan': { jobType: 'plan', planId: 'plan', agencyId: 'a', userId: 'u', role: 'agent', status: 'running', leaseUntil: 0, attempts: 1 } }); await drainAgentJobs(db as any); expect(runPlan).not.toHaveBeenCalled(); expect(rows.get('assistantAgentJobs/plan').status).toBe('failed'); });
  it('keeps execution completion separate from uncertain external action status', async () => { const { db, rows } = database({ 'assistantAgentJobs/plan': { jobType: 'plan', planId: 'plan', agencyId: 'a', userId: 'u', role: 'agent', status: 'pending', attempts: 0, createdAt: '' } }); await drainAgentJobs(db as any); expect(rows.get('assistantAgentJobs/plan')).toMatchObject({ status: 'completed', planStatus: 'unknown' }); expect(runPlan).toHaveBeenCalledTimes(1); });
  it('requeues a checkpoint instead of reporting a partial batch as completed', async () => {
    vi.mocked(runPlan).mockResolvedValueOnce({ status: 'pending', results: Array.from({ length: 10 }, (_, i) => ({ step: i + 1 })) } as any);
    const { db, rows } = database({ 'assistantAgentJobs/plan': { jobType: 'plan', planId: 'plan', agencyId: 'a', userId: 'u', role: 'agent', status: 'pending', attempts: 0, createdAt: '' } });
    await drainAgentJobs(db as any);
    expect(rows.get('assistantAgentJobs/plan')).toMatchObject({ status: 'pending', planStatus: 'pending', confirmedSteps: 10 });
    expect(rows.get('assistantAgentJobs/plan')).not.toHaveProperty('completedAt');
    expect(runPlan).toHaveBeenCalledWith(expect.anything(), 'plan', false, 10);
  });
});
