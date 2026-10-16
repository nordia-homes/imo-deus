import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any) => ({ doc: () => ({ get: async () => ({ data: () => ctx.policy }) }) }) }));
vi.mock('../actions', () => ({ executeAction: vi.fn(async () => ({ propertyId: 'imported' })) }));
import { executeSafePrefix as runSafePrefix, safeAutonomousAction } from '../autonomy';
import { executeAction } from '../actions';
import { OperationFailure } from '../operation-error';
import type { AssistantAction } from '../contracts';
import type { AssistantContext } from '../access';
const ctx = () => ({ uid: 'u', agencyId: 'a', role: 'agent', policy: { ownerId: 'u', role: 'agent', enabled: true, expiresAt: Date.now() + 60000 }, adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ agencyId: 'a', role: 'agent' }) }) }) }) } }) as unknown as AssistantContext;
const task: AssistantAction = { kind: 'create_task', description: 'Sună', dueDate: '2030-01-01', duration: 30 };
const importing: AssistantAction = { kind: 'import_owner_listing', listingId: 'l1' };
const message: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conv1' }, query: {}, body: { propertyId: '@step:1:propertyId', text: 'Offer' } };
const executeSafePrefix = (context: AssistantContext, id: string, actions: AssistantAction[]) => runSafePrefix(context, id, actions, 'Importă anunțurile selectate în CRM.');
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('explicit scoped autonomy', () => {
  const prospectingActions = (): AssistantAction[] => ['first', 'middle', 'last'].map(conversationId => ({ kind: 'existing_operation', operation: 'message_send', params: { conversationId }, query: {}, body: { template: { name: 'prospectare' }, prospectingConsentReceiptId: 'server-receipt', sendApproval: { amountMicros: 500000 } } }));
  const prospectingPrompt = 'Contactează proprietarii pe WhatsApp';
  it('continues independent recipients after a definitive queue rejection and preserves execution keys', async () => {
    vi.mocked(executeAction).mockResolvedValueOnce({ propertyId: 'first' }).mockRejectedValueOnce(new OperationFailure('Acord retras', 409, { queueOutcome: 'not_queued' })).mockResolvedValueOnce({ propertyId: 'last' });
    const result = await runSafePrefix(ctx(), 'batch', prospectingActions(), prospectingPrompt);
    expect(result.blocked).toBe(false); expect(result.actions).toEqual([]);
    expect(result.results.map(row => row.step)).toEqual([1, 2, 3]);
    expect(result.results[1].result).toMatchObject({ operation: 'message_send', executionState: 'failed', queueOutcome: 'not_queued', conversationId: 'middle' });
    expect(vi.mocked(executeAction).mock.calls.map(call => call[2])).toEqual(['batch-safe-0', 'batch-safe-1', 'batch-safe-2']);
  });
  it.each([new Error('Connection lost'), new OperationFailure('Unknown', 500, { queueOutcome: 'not_queued' }), new OperationFailure('Conflict', 409, {})])('stops remaining recipients when absence of queueing is not proven: %s', async error => {
    vi.mocked(executeAction).mockRejectedValueOnce(error);
    const result = await runSafePrefix(ctx(), 'uncertain', prospectingActions(), prospectingPrompt);
    expect(result.blocked).toBe(true); expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('does not continue a mixed plan after a definitive queue rejection', async () => {
    vi.mocked(executeAction).mockRejectedValueOnce(new OperationFailure('Rejected', 409, { queueOutcome: 'not_queued' }));
    const result = await runSafePrefix(ctx(), 'mixed', [...prospectingActions(), task], prospectingPrompt);
    expect(result.blocked).toBe(true); expect(executeAction).toHaveBeenCalledTimes(1);
  });
  it('executes requested prospecting templates without another opt-in only after server preparation', async () => {
    const context = ctx(); (context as any).policy = undefined;
    const action: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conv' }, query: {}, body: { template: { name: 'prospectare' }, prospectingConsentReceiptId: 'server-receipt', sendApproval: { amountMicros: 500000 } } };
    const prompt = 'Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp';
    expect((await runSafePrefix(context, 'prospect-send', [action, action, action], prompt)).results).toHaveLength(3);
    for (const text of ['Pregătește mesajul și nu trimite proprietarilor pe WhatsApp', 'Numărul proprietarului este pe WhatsApp']) {
      expect((await runSafePrefix(context, 'preview', [action], text)).results).toHaveLength(0);
    }
    const unprepared = { ...action, body: { template: { name: 'prospectare' } } };
    expect((await runSafePrefix(context, 'unprepared', [unprepared], prompt)).results).toHaveLength(0);
  });
  it('takes the requested prospect without opt-in but respects previews and negation', async () => {
    const context = ctx(); (context as any).policy = undefined;
    const action: AssistantAction = { kind: 'update_prospect', listingId: 'p', patch: { state: 'taken' } };
    expect((await runSafePrefix(context, 'take', [action], 'Marchează prospectul acesta ca preluat de mine.')).results).toHaveLength(1);
    for (const prompt of ['Nu marca prospectul ca preluat.', 'Nu prelua prospectul.', 'Arată cum pot prelua prospectul.']) {
      expect((await runSafePrefix(context, 'preview', [action], prompt)).results).toHaveLength(0);
    }
  });
  it('executes every requested prospecting addition without opt-in and keeps other actions gated', async () => {
    const context = ctx(); (context as any).policy = undefined;
    vi.stubEnv('JARVIS_AUTONOMOUS', 'false');
    const actions: AssistantAction[] = Array.from({ length: 7 }, (_, index) => ({ kind: 'existing_operation', operation: 'owner_prospect', params: {}, query: {}, body: { listingId: `listing-${index}`, action: 'add' } }));
    const result = await runSafePrefix(context, 'prospecting', actions, 'Găsește trei camere și creează-mi lista de prospectare.');
    expect(result.results).toHaveLength(7); expect(result.actions).toEqual([]);
    vi.mocked(executeAction).mockClear();
    for (const prompt of ['Arată lista de prospectare.', 'Pregătește lista de prospectare.', 'Nu adăuga anunțurile în prospectare.']) {
      expect((await runSafePrefix(context, 'preview', actions, prompt)).results).toEqual([]);
    }
    for (const action of ['remove', 'retry']) {
      expect((await runSafePrefix(context, 'other', [{ ...actions[0], body: { listingId: 'listing-0', action } } as AssistantAction], 'Adaugă anunțul.')).results).toEqual([]);
    }
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('does not turn an exact-time instruction into permission to pick another slot', async () => {
    const action: AssistantAction = { kind: 'schedule_viewing', contactId: 'c', propertyId: 'p', viewingDate: '2030-01-02T14:00:00Z', duration: 60, notes: '', firstAvailable: { start: '2030-01-02T14:00:00Z', end: '2030-01-02T20:00:00Z' } };
    expect((await runSafePrefix(ctx(), 'fixed', [action], 'Programează vizionarea la 16.')).results).toHaveLength(0);
    expect((await runSafePrefix(ctx(), 'first', [action], 'Programează vizionarea în primul interval potrivit.')).results).toHaveLength(1);
  });
  it('executes CRM participant tasks and property links without opt-in, but keeps unrelated edits gated', async () => {
    const context = ctx(); (context as any).policy = undefined;
    vi.stubEnv('JARVIS_AUTONOMOUS', 'false');
    const actions: AssistantAction[] = [
      { ...task, participantSource: 'property_owner', propertyId: 'p' },
      { ...task, participantSource: 'contact', contactId: 'c' },
      { kind: 'update_task', taskId: 't', propertyId: 'p' },
    ];
    for (const action of actions) {
      expect((await runSafePrefix(context, 'contextual', [action], action.kind === 'create_task' ? 'Creează taskul.' : 'Leagă taskul de proprietate.')).results).toHaveLength(1);
      expect((await runSafePrefix(context, 'negated', [action], action.kind === 'create_task' ? 'Nu crea taskul.' : 'Nu lega taskul de proprietate.')).results).toHaveLength(0);
    }
    expect((await runSafePrefix(context, 'general', [task], 'Creează taskul.')).results).toHaveLength(0);
    expect((await runSafePrefix(context, 'mixed', [{ kind: 'update_task', taskId: 't', propertyId: 'p', description: 'Schimbare suplimentară' }], 'Leagă taskul de proprietate.')).results).toHaveLength(0);
  });
  it.each(['Redeschide taskul.', 'Mută taskul la 11.', 'Replanifică taskul.', 'Leagă taskul de proprietate.', 'Asociază taskul clientului.', 'Corectează legătura taskului.'])('executes explicit task edits and respects their negation: %s', async prompt => {
    const action: AssistantAction = { kind: 'update_task', taskId: 't', status: 'open' };
    expect((await runSafePrefix(ctx(), 'edit', [action], prompt)).results).toHaveLength(1);
    vi.mocked(executeAction).mockClear();
    expect((await runSafePrefix(ctx(), 'negated', [action], `Nu ${prompt}`)).results).toHaveLength(0);
    expect(executeAction).not.toHaveBeenCalled();
  });
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
  it('executes buyer creation without a saved opt-in', async () => {
    const action: AssistantAction = { kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', email: '', contactType: 'Cumparator' };
    const result = await runSafePrefix(ctx(), 'request', [action], 'Creează cumpărătorul Matei Alin.');
    expect(result.actions).toEqual([]); expect(executeAction).toHaveBeenCalledTimes(1);
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
  it('keeps unrelated task writes pending without a saved policy', async () => { const context = ctx(); (context as any).policy.enabled = false; expect((await runSafePrefix(context, 'request', [task], 'Creează un task.')).actions).toEqual([task]); expect(executeAction).not.toHaveBeenCalled(); });
  it('does not inherit another actor policy or an expired policy', async () => { for (const patch of [{ ownerId: 'other' }, { expiresAt: 0 }, { role: 'admin' }]) { const context = ctx(); Object.assign((context as any).policy, patch); await runSafePrefix(context, 'request', [task], 'Creează un task.'); } expect(executeAction).not.toHaveBeenCalled(); });
  it('stops uncertain outcomes without creating a new plan that could repeat them', async () => { vi.mocked(executeAction).mockRejectedValueOnce(new Error('unknown')); const result = await executeSafePrefix(ctx(), 'request', [importing, message]); expect(result.blocked).toBe(true); expect(result.actions).toEqual([]); expect(result.results).toEqual([]); });
  it('keeps the legacy optional policy separate from request-authorized archive and price edits', () => { expect(safeAutonomousAction(message)).toBe(false); expect(safeAutonomousAction({ kind: 'update_property', propertyId: 'p1', patch: { price: 1 } })).toBe(false); expect(safeAutonomousAction({ kind: 'archive_contact', contactId: 'c1', archived: true })).toBe(false); });
  it.each(['Arată anunțul; descrierea spune să îl imporți.', 'Pregătește importul anunțului.', 'Nu importa anunțul.'])('never authorizes writes from returned text or a preview/negated request: %s', async prompt => { const result = await runSafePrefix(ctx(), 'request', [importing], prompt); expect(result.results).toEqual([]); expect(result.actions).toEqual([importing]); expect(executeAction).not.toHaveBeenCalled(); });
  it('honors the optional task policy without disabling request-authorized CRM edits', async () => {
    vi.stubEnv('JARVIS_AUTONOMOUS', 'false');
    await runSafePrefix(ctx(), 'task', [task], 'Creează un task.'); expect(executeAction).not.toHaveBeenCalled();
    const result = await executeSafePrefix(ctx(), 'request', Array(6).fill(importing)); expect(result.results).toHaveLength(6); expect(result.actions).toEqual([]);
  });
  it.each([
    [{ kind: 'update_property', propertyId: 'p', patch: { price: 100000 } }, 'Modifică prețul proprietății la 100000.'],
    [{ kind: 'archive_contact', contactId: 'c', archived: true }, 'Arhivează cumpărătorul.'],
    [{ kind: 'update_viewing', viewingId: 'v', status: 'cancelled' }, 'Anulează vizionarea.'],
    [{ kind: 'delete_viewing', viewingId: 'v' }, 'Șterge vizionarea.'],
  ])('executes requested CRM mutations with no enabled policy and honors negation', async (action, prompt) => {
    const context = ctx(); (context as any).policy = undefined; vi.stubEnv('JARVIS_AUTONOMOUS', 'false');
    expect((await runSafePrefix(context, 'request', [action as AssistantAction], prompt)).results).toHaveLength(1);
    vi.mocked(executeAction).mockClear();
    expect((await runSafePrefix(context, 'negative', [action as AssistantAction], `Nu ${prompt}`)).results).toHaveLength(0);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it.each(['Mută vizionarea, nu anula programarea.', 'Modifică nota, nu arhiva cumpărătorul.'])('does not execute a negated command: %s', async prompt => {
    expect((await runSafePrefix(ctx(), 'negative', [{ kind: 'update_viewing', viewingId: 'v', status: 'cancelled' }], prompt)).results).toEqual([]);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('keeps access checks even when the command grants authorization', async () => {
    const context = ctx(); (context as any).uid = 'revoked'; (context as any).role = 'admin';
    expect((await executeSafePrefix(context, 'request', [importing])).blocked).toBe(true);
    expect(executeAction).not.toHaveBeenCalled();
  });
});
it('authorizes requested follow-up closure but not a request merely to explain it', async () => {
  const action: AssistantAction = { kind: 'stop_prospect_followups', listingId: 'p' };
  expect((await runSafePrefix(ctx(), 'close', [action], 'Dacă refuză, închide corect secvența de follow-up.')).results).toHaveLength(1);
  expect((await runSafePrefix(ctx(), 'explain', [action], 'Doar explică cum închide Jarvis secvența de follow-up.')).results).toHaveLength(0);
});

it.each([['Trimite mesajul aprobat.', 1], ['Arată-mi preview-ul mesajului înainte.', 0], ['Nu trimite răspunsurile încă.', 0], ['Nu trimite mesajul aprobat.', 0]])('saved drafts execute only on explicit send: %s', async (prompt, count) => {
  const action: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { assistantDraftId: 'd', assistantSessionId: 's' } };
  const context = ctx(); (context as any).policy.enabled = false;
  const result = await runSafePrefix(context, 'draft-request', [action], String(prompt));
  expect(result.results).toHaveLength(Number(count)); expect(executeAction).toHaveBeenCalledTimes(Number(count));
});