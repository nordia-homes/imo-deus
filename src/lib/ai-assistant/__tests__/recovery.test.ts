import { describe, expect, it, vi } from 'vitest';
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.collection(name), referencesAllowed: vi.fn(async () => true), actionReferences: () => [] }));
import { inspectPlan } from '../workspace';
import { executeAction } from '../actions';
import type { AssistantContext } from '../access';

function fixture(status: string, ledger?: Record<string, unknown>, recent = false) {
  const plan: any = { ownerId: 'u', sessionId: 'session', status, startedAt: new Date(Date.now() - (recent ? 0 : 20 * 60000)).toISOString(), actions: [{ kind: 'create_contact', name: 'Client', phone: '', email: '', contactType: 'Cumparator' }] };
  const planRef = { id: 'p', get: async () => ({ exists: true, data: () => structuredClone(plan), id: 'p' }) };
  const ctx = { uid: 'u', collection: (name: string) => ({ doc: () => name === 'assistantPlans' ? planRef : { get: async () => ({ exists: !!ledger, data: () => ledger }) } }), adminDb: { runTransaction: async (callback: any) => callback({ get: (ref: any) => ref.get(), update: (_: any, patch: any) => Object.assign(plan, patch) }) } } as unknown as AssistantContext;
  return { ctx, plan };
}
describe('interrupted plan recovery', () => {
  it('keeps a recent running plan intact', async () => {
    const { ctx, plan } = fixture('running', undefined, true);
    expect((await inspectPlan(ctx, 'p')).status).toBe('running');
    expect(plan).not.toHaveProperty('inspectedAt');
  });
  it('restores completed results from confirmed ledgers without executing actions', async () => {
    const { ctx, plan } = fixture('running', { status: 'completed', result: { contactId: 'c' } });
    expect((await inspectPlan(ctx, 'p')).status).toBe('completed');
    expect(plan.results[0].result.contactId).toBe('c');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('allows explicit recovery of an internal interruption without a confirmed write', async () => {
    const { ctx } = fixture('running');
    expect((await inspectPlan(ctx, 'p')).status).toBe('failed');
  });
  it('preserves an ambiguous external outcome and never resends it', async () => {
    const { ctx } = fixture('unknown', { status: 'unknown' });
    expect((await inspectPlan(ctx, 'p')).status).toBe('unknown');
    expect(executeAction).not.toHaveBeenCalled();
  });
});
