import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../plan-outcomes', () => ({ readPlanOutcomes: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.collection(name), referencesAllowed: vi.fn(async () => true), actionReferences: () => [] }));
import { controlPlan, inspectPlan, runPlan } from '../workspace';
import { approvalEnvelope } from '../approval';
import { executeAction } from '../actions';
import { readPlanOutcomes } from '../plan-outcomes';
import { summarizeOutcome } from '../outcome';
import type { AssistantContext } from '../access';

function fixture(status: string, ledger?: Record<string, unknown>, recent = false) {
  const plan: any = { ownerId: 'u', sessionId: 'session', status, startedAt: new Date(Date.now() - (recent ? 0 : 20 * 60000)).toISOString(), actions: [{ kind: 'create_contact', name: 'Client', phone: '', email: '', contactType: 'Cumparator' }] };
  const planRef = { id: 'p', get: async () => ({ exists: true, updateTime: { seconds: 100, nanoseconds: 1 }, data: () => structuredClone(plan), id: 'p' }) };
  const member: any = { agencyId: 'a', role: 'agent' };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', collection: (name: string) => ({ doc: () => name === 'assistantPlans' ? planRef : { get: async () => ({ exists: !!ledger, data: () => ledger }) } }), adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => member }) }) }), runTransaction: async (callback: any) => callback({ get: (ref: any) => ref.get(), update: (_: any, patch: any) => Object.assign(plan, patch) }) } } as unknown as AssistantContext;
  return { ctx, plan, member };
}
describe('interrupted plan recovery', () => {
  it.each(['pause', 'cancel', 'both'].flatMap(command => ['completed', 'missing', 'unknown'].map(receipt => ({ command, receipt }))))('preserves $command with a $receipt receipt during recovery', async ({ command, receipt }) => {
    const { ctx, plan } = fixture('running', receipt === 'missing' ? undefined : { status: receipt, result: { contactId: 'c' } });
    if (command !== 'cancel') plan.pauseRequestedAt = new Date().toISOString();
    if (command !== 'pause') plan.cancelRequestedAt = new Date().toISOString();
    const status = receipt === 'unknown' ? 'unknown' : command === 'pause' ? 'paused' : 'cancelled';
    expect(await inspectPlan(ctx, 'p')).toMatchObject({ status });
    expect(plan.status).toBe(status);
    expect(plan.results).toHaveLength(receipt === 'completed' ? 1 : 0);
    if (receipt !== 'unknown') expect(plan.waitUntil).toBe(0);
    else await expect(controlPlan(ctx, 'p', 'resume')).rejects.toThrow('nu este în pauză');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it.each(['running', 'unknown', 'completed'])('refuses stale membership before inspecting a %s plan', async status => {
    const { ctx, plan, member } = fixture(status);
    member.agencyId = 'other';
    await expect(inspectPlan(ctx, 'p')).rejects.toMatchObject({ status: 403 });
    expect(plan).not.toHaveProperty('inspectedAt');
    expect(executeAction).not.toHaveBeenCalled();
  });
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

function executionFixture() {
  const actions = Array.from({ length: 3 }, (_, index) => ({ kind: 'create_task' as const, description: 'Task ' + index, dueDate: '2027-01-01' }));
  const plan: any = { ownerId: 'u', sessionId: 's', status: 'pending', actions, expiresAt: Date.now() + 3600000, approval: approvalEnvelope('u', 'a', 'p', actions, Date.now() + 3600000) };
  const member = { agencyId: 'a', role: 'agent' };
  const planRef: any = { id: 'p', get: async () => ({ exists: true, id: 'p', data: () => structuredClone(plan) }), update: async (patch: any) => Object.assign(plan, patch) };
  const sessionRef: any = { get: async () => ({ exists: true, data: () => ({ ownerId: 'u' }) }), collection: () => ({ doc: () => ({}) }) };
  const db: any = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => member }) }) }),
    runTransaction: async (work: any) => work({ get: (ref: any) => ref.get(), update: (_: any, patch: any) => Object.assign(plan, patch), set: vi.fn() }),
    batch: () => ({ update: (_: any, patch: any) => Object.assign(plan, patch), set: vi.fn(), commit: async () => undefined }),
  };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db, collection: (name: string) => ({ doc: () => name === 'assistantPlans' ? planRef : sessionRef }) } as unknown as AssistantContext;
  return { ctx, plan };
}
afterEach(() => vi.clearAllMocks());
describe('durable batch checkpoints and controls', () => {
  it.each(['pause', 'cancel', 'both'].flatMap(command => ['ready', 'waiting', 'unknown'].map(outcome => ({ command, outcome }))))('honors $command during $outcome verification before the next step', async ({ command, outcome }) => {
    const { ctx, plan } = executionFixture();
    plan.goal = { schemaVersion: 1 };
    vi.mocked(executeAction).mockResolvedValue({ taskId: 'first' });
    vi.mocked(readPlanOutcomes).mockImplementation(async () => {
      if (command !== 'cancel') await controlPlan(ctx, 'p', 'pause');
      if (command !== 'pause') await runPlan(ctx, 'p', true);
      const rows = [{ step: 1, executionState: outcome === 'ready' ? 'succeeded' : outcome === 'waiting' ? 'queued' : 'unknown', completionSatisfied: outcome === 'ready', watchable: outcome === 'waiting' }];
      return { rows, outcome: summarizeOutcome('running', 3, rows as any), pollAfterMs: outcome === 'waiting' ? 15000 : null } as any;
    });
    const status = command === 'pause' ? 'paused' : 'cancelled';
    expect(await runPlan(ctx, 'p')).toMatchObject({ status });
    expect(plan.status).toBe(status);
    expect(plan.results).toHaveLength(1);
    expect(plan.waitUntil).toBe(0);
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it.each(['pause', 'cancel', 'both'] as const)('preserves %s requested during the last action', async command => {
    const { ctx, plan } = executionFixture();
    let calls = 0;
    vi.mocked(executeAction).mockImplementation(async () => {
      calls++;
      if (calls === 3) {
        if (command !== 'cancel') await controlPlan(ctx, 'p', 'pause');
        if (command !== 'pause') await runPlan(ctx, 'p', true);
      }
      return { taskId: `task-${calls}` };
    });
    const status = command === 'pause' ? 'paused' : 'cancelled';
    expect(await runPlan(ctx, 'p')).toMatchObject({ status });
    expect(plan.status).toBe(status);
    expect(plan.results).toHaveLength(3);
    expect(plan.results[2].result).toEqual({ taskId: 'task-3' });
    expect(await runPlan(ctx, 'p')).toMatchObject({ status });
    if (command === 'pause') {
      await controlPlan(ctx, 'p', 'resume');
      expect(await runPlan(ctx, 'p')).toMatchObject({ status: 'completed' });
    }
    expect(executeAction).toHaveBeenCalledTimes(3);
  });
  it('resumes render-to-draft with the verified asset without rerendering or rewriting its receipt', async () => {
    const { ctx, plan } = executionFixture();
    plan.goal = { schemaVersion: 1 };
    plan.actions = [
      { kind: 'existing_operation', operation: 'tiktok_studio_render', params: { projectId: 'project' }, query: {}, body: { expectedVersion: 1 } },
      { kind: 'existing_operation', operation: 'tiktok_post_draft', params: {}, query: {}, body: { assetId: '@step:1:assetId' } },
    ];
    plan.approval = approvalEnvelope('u', 'a', 'p', plan.actions, plan.expiresAt);
    vi.mocked(executeAction).mockResolvedValueOnce({ jobId: 'render', executionState: 'queued' }).mockResolvedValueOnce({ draftId: 'draft' });
    vi.mocked(readPlanOutcomes).mockResolvedValueOnce({ outcome: summarizeOutcome('running', 2, [{ step: 1, executionState: 'queued', watchable: true }]), pollAfterMs: 15000 } as any);
    expect((await runPlan(ctx, 'p')).status).toBe('pending');
    const rows = [{ step: 1, executionState: 'succeeded', completionSatisfied: true, outputs: { assetId: 'rendered-asset' } }];
    plan.waitUntil = Date.now() - 1;
    vi.mocked(readPlanOutcomes).mockResolvedValue({ rows, outcome: summarizeOutcome('running', 2, rows), pollAfterMs: null } as any);
    expect((await runPlan(ctx, 'p')).status).toBe('completed');
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect(vi.mocked(executeAction).mock.calls[1][1]).toMatchObject({ body: { assetId: 'rendered-asset' } });
    expect(plan.results[0]).toMatchObject({ result: { jobId: 'render', executionState: 'queued' }, outputs: { assetId: 'rendered-asset' } });
    expect(plan.actions[1].body.assetId).toBe('@step:1:assetId');
  });
  it('waits for a provider result before executing the next approved step', async () => {
    const { ctx, plan } = executionFixture();
    plan.goal = { schemaVersion: 1 };
    vi.mocked(executeAction).mockResolvedValue({ jobId: 'render', executionState: 'queued' });
    vi.mocked(readPlanOutcomes).mockResolvedValue({ outcome: summarizeOutcome('running', 3, [{ step: 1, executionState: 'queued', watchable: true }]), pollAfterMs: 15000 } as any);
    const result = await runPlan(ctx, 'p');
    expect(result).toMatchObject({ status: 'pending', outcome: { state: 'WAITING_PROVIDER' } });
    expect(executeAction).toHaveBeenCalledTimes(1);
    await runPlan(ctx, 'p');
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('blocks continuation when evidence cannot be reconciled safely', async () => {
    const { ctx, plan } = executionFixture();
    plan.goal = { schemaVersion: 1 };
    vi.mocked(executeAction).mockResolvedValue({ executionState: 'unknown' });
    vi.mocked(readPlanOutcomes).mockResolvedValue({ outcome: summarizeOutcome('running', 3, [{ step: 1, executionState: 'unknown' }]), pollAfterMs: null } as any);
    expect(await runPlan(ctx, 'p')).toMatchObject({ status: 'unknown', outcome: { state: 'BLOCKED' } });
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('continues the approved revision from persisted receipts after a checkpoint', async () => {
    const { ctx, plan } = executionFixture();
    const revision = '2026-10-06T10:00:00Z', next = '2026-10-06T10:01:00Z';
    plan.actions = [
      { kind: 'update_contact', contactId: 'c', expectedUpdatedAt: revision, patch: { name: 'Client' } },
      { kind: 'update_preferences', contactId: 'c', expectedUpdatedAt: revision, preferences: { desiredRooms: 3 } },
    ];
    plan.approval = approvalEnvelope('u', 'a', 'p', plan.actions, plan.expiresAt);
    vi.mocked(executeAction).mockResolvedValueOnce({ mutationRevision: { resource: 'contacts', id: 'c', before: revision, after: next } }).mockResolvedValueOnce({ contactId: 'c' });
    expect((await runPlan(ctx, 'p', false, 1)).status).toBe('pending');
    expect((await runPlan(ctx, 'p', false, 1)).status).toBe('completed');
    expect(vi.mocked(executeAction).mock.calls[1][1]).toMatchObject({ expectedUpdatedAt: next, preferences: { desiredRooms: 3 } });
    expect(plan.actions[1].expectedUpdatedAt).toBe(revision);
    expect(vi.mocked(executeAction).mock.calls.map(call => call[2])).toEqual(['p-0', 'p-1']);
  });
  it('resumes the next step after a checkpoint without replaying confirmed steps', async () => {
    const { ctx, plan } = executionFixture();
    vi.mocked(executeAction).mockImplementation(async (_ctx, _action, key) => ({ taskId: key }));
    expect((await runPlan(ctx, 'p', false, 1)).status).toBe('pending');
    expect(plan.results).toHaveLength(1);
    expect((await runPlan(ctx, 'p', false, 1)).status).toBe('pending');
    expect((await runPlan(ctx, 'p', false, 1)).status).toBe('completed');
    expect(vi.mocked(executeAction).mock.calls.map(call => call[2])).toEqual(['p-0', 'p-1', 'p-2']);
  });
  it('pauses after the in-flight action and resumes only the remaining actions', async () => {
    const { ctx, plan } = executionFixture();
    vi.mocked(executeAction).mockImplementation(async (_ctx, _action, key) => { if (key === 'p-0') await controlPlan(ctx, 'p', 'pause'); return { taskId: key }; });
    expect((await runPlan(ctx, 'p')).status).toBe('paused');
    expect(plan.results).toHaveLength(1);
    expect((await runPlan(ctx, 'p')).status).toBe('paused');
    await controlPlan(ctx, 'p', 'resume');
    expect((await runPlan(ctx, 'p')).status).toBe('completed');
    expect(executeAction).toHaveBeenCalledTimes(3);
  });
  it('stops future steps when cancellation arrives during an action', async () => {
    const { ctx, plan } = executionFixture();
    vi.mocked(executeAction).mockImplementation(async () => { await runPlan(ctx, 'p', true); return { taskId: 'first' }; });
    expect((await runPlan(ctx, 'p')).status).toBe('cancelled');
    expect(plan.results).toHaveLength(1);
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('refuses resumption after membership revocation', async () => {
    const { ctx } = executionFixture();
    await controlPlan(ctx, 'p', 'pause');
    ctx.role = 'admin';
    await expect(controlPlan(ctx, 'p', 'resume')).rejects.toThrow('revocat');
  });
});
