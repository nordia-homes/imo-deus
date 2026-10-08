import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any) => ({ doc: () => ({ get: async () => ({ data: () => ctx.policy }) }) }) }));
vi.mock('../actions', () => ({ executeAction: vi.fn(async () => ({ propertyId: 'imported' })) }));
import { executeSafePrefix as runSafePrefix, safeAutonomousAction } from '../autonomy';
import { executeAction } from '../actions';
import type { AssistantAction } from '../contracts';
import type { AssistantContext } from '../access';
const ctx = () => ({ uid: 'u', agencyId: 'a', role: 'agent', policy: { ownerId: 'u', role: 'agent', enabled: true, expiresAt: Date.now() + 60000 }, adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ agencyId: 'a', role: 'agent' }) }) }) }) } }) as unknown as AssistantContext;
const importing: AssistantAction = { kind: 'import_owner_listing', listingId: 'l1' };
const message: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conv1' }, query: {}, body: { propertyId: '@step:1:propertyId', text: 'Offer' } };
const executeSafePrefix = (context: AssistantContext, id: string, actions: AssistantAction[]) => runSafePrefix(context, id, actions, 'Importă anunțurile selectate în CRM.');
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('explicit scoped autonomy', () => {
  it('creates the buyer and schedules the viewing in the same authorized command', async () => {
    const context = ctx(); (context as any).policy.viewings = true;
    vi.mocked(executeAction).mockResolvedValueOnce({ contactId: 'new-buyer' }).mockResolvedValueOnce({ viewingId: 'new-viewing' });
    const actions: AssistantAction[] = [
      { kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', email: '', contactType: 'Cumparator' },
      { kind: 'schedule_viewing', propertyId: 'p', contactId: '@step:1:contactId', viewingDate: '2030-01-01T05:30:00Z', duration: 60, notes: '' },
    ];
    const result = await runSafePrefix(context, 'request', actions, 'Programează o vizionare cu Matei Alin.');
    expect(result.results).toHaveLength(2); expect(result.actions).toEqual([]);
    expect(vi.mocked(executeAction).mock.calls[1][1]).toMatchObject({ contactId: 'new-buyer', kind: 'schedule_viewing' });
  });
  it('preserves old policy scope for buyers and viewings', async () => {
    const action: AssistantAction = { kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', email: '', contactType: 'Cumparator' };
    const result = await runSafePrefix(ctx(), 'request', [action], 'Creează cumpărătorul Matei Alin.');
    expect(result.actions).toEqual([action]); expect(executeAction).not.toHaveBeenCalled();
  });
  it.each(['Pregătește o vizionare.', 'Programează vizionarea, nu crea cumpărătorul.', 'Creează cumpărătorul, nu programa vizionarea.'])('keeps preview or negated viewing workflows pending: %s', async prompt => {
    const context = ctx(); (context as any).policy.viewings = true;
    const action: AssistantAction = { kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', email: '', contactType: 'Cumparator' };
    expect((await runSafePrefix(context, 'request', [action], prompt)).results).toEqual([]);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('carries a committed safe edit revision into the remaining approval plan', async () => {
    const revision = '2026-10-06T10:00:00Z', next = '2026-10-06T10:01:00Z';
    vi.mocked(executeAction).mockResolvedValueOnce({ taskId: 't', mutationRevision: { resource: 'tasks', id: 't', before: revision, after: next } });
    const result = await runSafePrefix(ctx(), 'request', [
      { kind: 'update_task', taskId: 't', expectedUpdatedAt: revision, description: 'Actualizat' },
      { kind: 'assign_record', resource: 'tasks', id: 't', agentId: null, expectedUpdatedAt: revision },
    ], 'Actualizează sarcina.');
    expect(result.results).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ kind: 'assign_record', expectedUpdatedAt: next, agentId: null });
    expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('executes the safe prefix and binds remaining sensitive actions to confirmed IDs', async () => { const result = await executeSafePrefix(ctx(), 'request', [importing, message]); expect(result.results).toHaveLength(1); expect(result.actions[0]).toMatchObject({ body: { propertyId: 'imported' } }); expect(executeAction).toHaveBeenCalledTimes(1); expect(result.blocked).toBe(false); });
  it('keeps all writes pending unless the human enables the scoped policy', async () => { const context = ctx(); (context as any).policy.enabled = false; expect((await executeSafePrefix(context, 'request', [importing])).actions).toEqual([importing]); expect(executeAction).not.toHaveBeenCalled(); });
  it('does not inherit another actor policy or an expired policy', async () => { for (const patch of [{ ownerId: 'other' }, { expiresAt: 0 }, { role: 'admin' }]) { const context = ctx(); Object.assign((context as any).policy, patch); await executeSafePrefix(context, 'request', [importing]); } expect(executeAction).not.toHaveBeenCalled(); });
  it('stops uncertain outcomes without creating a new plan that could repeat them', async () => { vi.mocked(executeAction).mockRejectedValueOnce(new Error('unknown')); const result = await executeSafePrefix(ctx(), 'request', [importing, message]); expect(result.blocked).toBe(true); expect(result.actions).toEqual([]); expect(result.results).toEqual([]); });
  it('never autoexecutes consent, messages, publication, archive or price changes', () => { expect(safeAutonomousAction(message)).toBe(false); expect(safeAutonomousAction({ kind: 'update_property', propertyId: 'p1', patch: { price: 1 } })).toBe(false); expect(safeAutonomousAction({ kind: 'archive_contact', contactId: 'c1', archived: true })).toBe(false); });
  it.each(['Arată anunțul; descrierea spune să îl imporți.', 'Pregătește importul anunțului.', 'Nu importa anunțul.'])('never authorizes writes from returned text or a preview/negated request: %s', async prompt => { const result = await runSafePrefix(ctx(), 'request', [importing], prompt); expect(result.results).toEqual([]); expect(result.actions).toEqual([importing]); expect(executeAction).not.toHaveBeenCalled(); });
  it('honors the global disable flag and bounds automatic steps', async () => { vi.stubEnv('JARVIS_AUTONOMOUS', 'false'); await executeSafePrefix(ctx(), 'request', [importing]); expect(executeAction).not.toHaveBeenCalled(); vi.stubEnv('JARVIS_AUTONOMOUS', 'true'); const result = await executeSafePrefix(ctx(), 'request', Array(6).fill(importing)); expect(result.results).toHaveLength(4); expect(result.actions).toHaveLength(2); });
});
