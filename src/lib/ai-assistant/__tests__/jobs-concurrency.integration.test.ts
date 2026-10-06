import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), referencesAllowed: async () => true }));
vi.mock('../workspace', () => ({ chatTurn: vi.fn(), runPlan: vi.fn(), getPlan: vi.fn() }));
import { chatTurn } from '../workspace';
import { drainAgentJobs, enqueueTurn } from '../jobs';
import type { AssistantContext } from '../access';

const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('worker claims on actual Firestore transactions', () => {
  let db: Firestore;
  const fixtures: { uid: string; agencyId: string; requestId: string }[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-worker-concurrency' });
  });
  afterAll(async () => {
    if (!db) return;
    for (const row of fixtures) {
      await db.collection('assistantAgentJobs').doc(row.requestId).delete();
      await db.collection('users').doc(row.uid).delete();
      await db.recursiveDelete(db.collection('agencies').doc(row.agencyId));
    }
    await db.terminate();
  });
  async function fixture() {
    const id = randomUUID(), row = { uid: id, agencyId: id, requestId: id }; fixtures.push(row);
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    const ctx = { ...row, role: 'agent', runtimeMode: 'real', adminDb: db } as unknown as AssistantContext;
    await enqueueTurn(ctx, { sessionId: id, requestId: id, prompt: 'Citire de test' });
    return row;
  }
  it('allows only one of two workers to invoke the turn', async () => {
    vi.mocked(chatTurn).mockReset();
    const row = await fixture();
    vi.mocked(chatTurn).mockResolvedValue({ message: { id: 'reply', text: 'confirmed', accessRefs: [] } } as any);
    await Promise.all([drainAgentJobs(db as any), drainAgentJobs(db as any)]);
    expect(chatTurn).toHaveBeenCalledTimes(1);
    expect((await db.collection('assistantAgentJobs').doc(row.requestId).get()).data()?.status).toBe('completed');
  }, 20000);
  it('rejects old progress after lease takeover without changing the new result', async () => {
    vi.mocked(chatTurn).mockReset();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
      let started!: () => void, resume!: () => void;
      const entered = new Promise<void>(resolve => { started = resolve; });
      const gate = new Promise<void>(resolve => { resume = resolve; });
      vi.mocked(chatTurn).mockImplementationOnce(async (_ctx, _input, progress) => {
        started(); await gate;
        await progress!({ type: 'PROGRESS_EVENT', stage: 'planning', text: 'old claim' } as any);
        throw new Error('must not continue');
      }).mockResolvedValueOnce({ message: { id: 'new-reply', text: 'new claim', accessRefs: [] } } as any);
      const first = drainAgentJobs(db as any);
      await entered;
      try {
        await ref.update({ leaseUntil: 0 });
        await drainAgentJobs(db as any);
      } finally { resume(); }
      await first;
      expect(chatTurn).toHaveBeenCalledTimes(2);
      const final = (await ref.get()).data()!;
      expect(final).toMatchObject({ status: 'completed', message: { id: 'new-reply', text: 'new claim' }, attempts: 2 });
      expect(final.events).not.toContainEqual(expect.objectContaining({ text: 'old claim' }));
    } finally { log.mockRestore(); }
  }, 20000);
});
