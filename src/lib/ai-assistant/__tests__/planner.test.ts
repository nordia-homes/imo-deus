vi.mock('../outreach-history', async importOriginal => ({ ...await importOriginal<typeof import('../outreach-history')>(), readOutreachHistory: vi.fn() }));
import { readOutreachHistory } from '../outreach-history';
vi.mock('../outreach-configuration', () => ({ readOutreachConfiguration: vi.fn() }));
import { readOutreachConfiguration } from '../outreach-configuration';
vi.mock('../outreach-preflight', () => ({ readOutreachPreflight: vi.fn() }));
import { readOutreachPreflight } from '../outreach-preflight';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn(), readRelated: vi.fn(), readField: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('../owner-prospects', async importOriginal => ({ ...await importOriginal<typeof import('../owner-prospects')>(), readOwnerProspects: vi.fn() }));
vi.mock('../timeline', async importOriginal => ({ ...await importOriginal<typeof import('../timeline')>(), readTimeline: vi.fn() }));
vi.mock('../actions', () => ({ matchContact: vi.fn(), matchProperty: vi.fn(), executeAction: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn(), operationCatalog: () => [], operationContract: vi.fn(), operations: { conversation_messages: { method: 'GET', path: '/messages', description: 'Mesaje.' } }, isReadOperation: vi.fn((name: string) => name === 'conversation_messages') }));
vi.mock('../readiness', () => ({ automationReadiness: async () => ({ configured: false, active: false }) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { planTurn } from '../planner';
import { executeAction } from '../actions';
import { searchProperties } from '../search';
import { readResource } from '../access';
import { invokeOperation } from '../operations';
import { readOwnerProspects } from '../owner-prospects';
import { readTimeline } from '../timeline';
import { ProviderError, type ProviderResult, type ModelProvider } from '../provider';
import { AgentBudget, BudgetExceeded, DEFAULT_LIMITS } from '../budget';
import type { AssistantContext } from '../access';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
// Load the lazy tool graph before timed test bodies; a cold import can otherwise
// time out the first case and leave its pending mocked reads in later cases.
beforeAll(async () => { await import('../tool-dispatch'); }, 30000);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function provider(operation: string, payload: unknown) {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  // These fixtures test tool validation. Report usage like the normal API so
  // prompt growth cannot switch them into the separate missing-usage budget path.
  const reportedUsage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 0 } };
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'function_call', name: 'crm', call_id: 'call', arguments: JSON.stringify({ operation, payload: JSON.stringify(payload) }) }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({text: 'Plan pregătit.', intentStatus: 'answer'}) }] }] }) });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text: 'Plan pregătit.', intentStatus: 'answer' }) }] }] }) });
  vi.stubGlobal('fetch', fetch); return fetch;
}
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
const usage = { inputTokens: 100, outputTokens: 20, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
function call(name: string, payload: unknown): ProviderResult {
  const fn = { id: crypto.randomUUID(), name, arguments: JSON.stringify({ payload: JSON.stringify(payload) }) };
  return { calls: [fn], items: [{ type: 'function_call', call_id: fn.id, name, arguments: fn.arguments }], text: '', usage, status: 'completed', latencyMs: 1 };
}
const final: ProviderResult = { calls: [], items: [], text: 'Rezultate confirmate.', intentStatus: 'answer', usage, status: 'completed', latencyMs: 1 };
it('keeps explicit WhatsApp prospecting within the first-call budget with concrete delivery instructions', async () => {
  const prompt = 'Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp';
  const respond = vi.fn(async (_request: unknown) => ({ ...final, intentStatus: 'clarification' as const }));
  await planTurn({ ...ctx, prospectingRequest: { sessionId: 'session', requestId: 'request', prompt } }, prompt, [], { provider: { id: 'fixture', respond } });
  expect(respond).toHaveBeenCalledTimes(1);
  const request = respond.mock.calls[0][0] as any;
  expect(request.tools.map((tool: any) => tool.name)).toContain('search_properties');
  expect(request.tools.map((tool: any) => tool.name)).not.toContain('create_task');
  expect(request.instructions).toContain('prospectingConnectionId');
  expect(request.instructions).toContain('whatsapp_templates');
  expect(request.instructions).toContain('Nu solicita previzualizarea textului');
  expect(request.instructions).toContain('chiar dacă există alte șabloane');
  expect(Buffer.byteLength(request.instructions)).toBeLessThan(10000);
});
function scripted(...responses: (ProviderResult | Error)[]) {
  const respond = vi.fn(); for (const response of responses) response instanceof Error ? respond.mockRejectedValueOnce(response) : respond.mockResolvedValueOnce(response);
  respond.mockResolvedValue(final);
  return { id: 'fixture', respond } satisfies ModelProvider;
}
describe('Responses tool planning', () => {
  it('treats a prohibition on unauthorized takeover as read-only, not an instruction to take free prospects', async () => {
    const prompt = 'Nu le prelua fără drept.';
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'other', takenByAgentId: 'other' }, { id: 'free' }], complete: true, nextCursor: null });
    const read = call('read', { resource: 'ownerListingFavorites', limit: 50 });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'guard', sourceQuote: prompt, description: 'Atribuiri protejate', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.actions).toEqual([]); expect(result.metrics.status).toBe('success');
    expect(result.cards.flatMap(card => card.rows).map(row => row.id)).toEqual(['other']);
    expect(model.respond.mock.calls.every(args => args[0].tools.every((tool: any) => ['read', 'goal_coverage'].includes(tool.name)))).toBe(true);
  });
  it('lists other-agent reservations without exposing writes or certifying an unread list', async () => {
    const prompt = 'Care prospecte sunt rezervate altui agent?';
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('partial');
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'other', isFavoriteActive: true, reservedByAgentId: 'other', reservedAt: new Date().toISOString() }, { id: 'mine', isFavoriteActive: true, reservedByAgentId: 'u' }], complete: true, nextCursor: null });
    const read = call('read', { resource: 'contacts', id: 'wrong', limit: 1 });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'list', sourceQuote: prompt, description: 'Rezervările altor agenți', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.cards.flatMap(card => card.rows).map(row => row.id)).toEqual(['other']);
    expect(result.actions).toEqual([]); expect(result.metrics.status).toBe('success');
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).toEqual(['read']);
  });
  it('reads every active-prospect page with server-bound scope even when the model repeats a wrong selection', async () => {
    const prompt = 'Găsește prospectele mele active.';
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('partial');
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'other', isFavoriteActive: true, takenByAgentId: 'other' }], complete: false, nextCursor: 'page-1' });
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'page-2' });
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'mine', title: 'Alfa', isFavoriteActive: true, takenByAgentId: 'u' }], complete: true, nextCursor: null });
    const reads = [1, 2, 3].map(() => call('read', { resource: 'contacts', id: 'wrong', search: 'wrong', cursor: 'wrong', limit: 1 }));
    const model = scripted(...reads, call('goal_coverage', { requirements: [{ id: 'list', sourceQuote: prompt, description: 'Prospectele mele active', resolution: 'answered', steps: [], evidenceCallIds: [reads[2].calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(vi.mocked(readResource).mock.calls.map(args => args[1])).toEqual([{ resource: 'ownerListingFavorites', limit: 50 }, { resource: 'ownerListingFavorites', limit: 50, cursor: 'page-1' }, { resource: 'ownerListingFavorites', limit: 50, cursor: 'page-2' }]);
    expect(result.cards.flatMap(card => card.rows).map(row => row.id)).toEqual(['mine']);
    expect(result.metrics.status).toBe('success'); expect(result.actions).toEqual([]);
    expect(model.respond.mock.calls.slice(0, 3).every(args => args[0].tools.every((tool: any) => tool.name === 'read'))).toBe(true);
  });
  it('binds status checks to the selected message and excludes unrelated operations and messages', async () => {
    const prompt = 'Verifică dacă mesajul este queued, accepted, delivered sau read.';
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'Mesaj selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'Mesaj', source: 'conversation_messages', rows: [{ id: 'target', conversationId: 'selected' }] }] }];
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('clarification');
    expect((await planTurn(ctx, prompt, history, { provider: scripted(final) })).metrics.status).toBe('partial');
    vi.mocked(invokeOperation).mockResolvedValueOnce({ conversation: { id: 'selected' }, messages: [{ id: 'other', status: 'read' }, { id: 'target', conversationId: 'selected', status: 'queued' }] });
    const read = call('existing_read', { operation: 'conversation_list', params: {}, query: {}, body: {} });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'status', sourceQuote: prompt, description: 'Starea actuală', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, history, { provider: model });
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).toEqual(['existing_read']);
    expect(invokeOperation).toHaveBeenCalledWith(expect.anything(), { operation: 'conversation_messages', params: { conversationId: 'selected' }, query: { target: 'target' }, body: {} }, true);
    expect(result.cards.flatMap(card => card.rows).map(row => row.id)).toEqual(['target']);
    expect(result.metrics.status).toBe('success'); expect(result.actions).toEqual([]); expect(executeAction).not.toHaveBeenCalled();
  });
  it('requires selected WhatsApp conversation and fresh templates before completing catalog checks', async () => {
    const prompt = 'După acord, verifică template-urile disponibile.';
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('clarification');
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'WhatsApp selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'WhatsApp', source: 'conversations', rows: [{ id: 'selected' }] }] }];
    const model = scripted(final);
    expect((await planTurn(ctx, prompt, history, { provider: model })).metrics.status).toBe('partial');
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).toEqual(['whatsapp_template_check']);
  });
  it('requires a selected conversation and an actual check before certifying WhatsApp eligibility', async () => {
    const prompt = 'Nu trimite WhatsApp dacă destinatarul nu este eligibil.';
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('clarification');
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'Selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'WhatsApp', source: 'conversations', rows: [{ id: 'selected' }] }] }];
    const model = scripted(final);
    expect((await planTurn(ctx, prompt, history, { provider: model })).metrics.status).toBe('partial');
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).toEqual(['whatsapp_recipient_check']);
  });
  it('binds collaboration drafts to a fresh selected prospect read and exposes no mutations', async () => {
    const prompt = 'Pregătește un mesaj de colaborare pentru proprietar.';
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'Selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'Prospect', source: 'ownerListingFavorites', rows: [{ id: 'selected' }] }] }];
    expect((await planTurn(ctx, prompt, [], { provider: scripted(final) })).metrics.status).toBe('clarification');
    expect((await planTurn(ctx, prompt, history, { provider: scripted(final) })).metrics.status).toBe('partial');
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'selected', ownerName: 'Alin Matei' }], complete: true, nextCursor: null });
    const read = call('read', { resource: 'contacts', id: 'invented', search: 'unrelated' });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'draft', sourceQuote: prompt, description: 'Ciornă', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, history, { provider: model });
    expect(result.metrics.status).toBe('success'); expect(result.actions).toEqual([]); expect(result.text).toContain('Ciornă de colaborare — nu a fost trimisă.');
    expect(readResource).toHaveBeenCalledWith(ctx, { resource: 'ownerListingFavorites', id: 'selected', limit: 30 });
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).toEqual(['read']);
  });
  it('limits human callback planning to one task for the persisted prospect', async () => {
    const request = 'Creează task de apel uman în loc de apel AI.';
    const history = [{ id: 'question', role: 'assistant' as const, text: 'Pentru ce zi?', createdAt: new Date().toISOString(), prospectContinuation: { listingId: 'selected', request } }];
    const model = scripted(call('propose_actions', { actions: [{ kind: 'create_task', ownerListingId: 'wrong', description: 'Apel uman', dueDate: '2099-01-01' }] }), final);
    const result = await planTurn(ctx, request + '\n2099-01-01', history, { provider: model });
    expect(result.actions).toEqual([]);
    const names = model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name);
    expect(names).toContain('create_task'); expect(names).not.toContain('outreach_preflight'); expect(names).not.toContain('update_prospect');
    expect(model.respond.mock.calls[0][0].input.some((item: any) => item.role === 'developer' && item.content.includes('ownerListingId=selected'))).toBe(true);
  });
  it('asks for scheduling time and rejects an immediate call or an unverified instant in the reply', async () => {
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'Prospect selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'Prospect', source: 'ownerListingFavorites', rows: [{ id: 'selected' }] }] }];
    const initial = await planTurn(ctx, 'Programează apelul conform funcționalității existente.', history, { provider: scripted(final) });
    expect(initial.metrics.status).toBe('clarification'); expect(initial.actions).toEqual([]);
    const messages = [...history, { id: 'question', role: 'assistant' as const, text: initial.text, createdAt: new Date().toISOString() }];
    for (const payload of [{ listingId: 'invented' }, { listingId: 'invented', scheduledAt: '2099-01-01T10:00:00Z' }]) {
      const result = await planTurn(ctx, 'Mâine la 10:30.', messages, { provider: scripted(call('outreach_preflight', payload), final) });
      expect(result.actions).toEqual([]); expect(result.metrics.status).toBe('partial');
    }
    expect(readOutreachPreflight).not.toHaveBeenCalled();
    const ambiguous = [...history, { ...history[0], id: 'new-list', cards: [{ ...history[0].cards[0], rows: [{ id: 'other-a' }, { id: 'other-b' }] }] }, messages.at(-1)!];
    expect((await planTurn(ctx, 'Mâine la 10:30.', ambiguous, { provider: scripted(final) })).metrics.status).toBe('clarification');
  });
  it('requires a selected prospect and a preflight, even if the model tries to finish immediately', async () => {
    const prompt = 'Pornește apelul AI dacă este eligibil și este aprobat.';
    const noSelection = scripted(final);
    expect((await planTurn(ctx, prompt, [], { provider: noSelection })).metrics.status).toBe('clarification');
    expect(noSelection.respond).not.toHaveBeenCalled();
    const history = [{ id: 'selection', role: 'assistant' as const, text: 'Prospect selectat', createdAt: new Date().toISOString(), cards: [{ type: 'data' as const, title: 'Prospect', source: 'ownerListingFavorites', rows: [{ id: 'selected' }] }] }];
    const premature = scripted(final);
    expect((await planTurn(ctx, prompt, history, { provider: premature })).metrics.status).toBe('partial');
    expect(premature.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).not.toContain('goal_coverage');
    vi.mocked(readOutreachPreflight).mockResolvedValue({ complete: true, eligible: false, rows: [], reason: 'Serviciu dezactivat' } as any);
    const read = call('outreach_preflight', { listingId: 'invented' });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'call', sourceQuote: prompt, description: 'Verificare', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    expect((await planTurn(ctx, prompt, history, { provider: model })).actions).toEqual([]);
    expect(readOutreachPreflight).toHaveBeenCalledWith(ctx, { listingId: 'selected' });
  });
  it.each(['Verifică setările de outreach.', 'Verifică setările de outreach pentru apelurile AI.', 'Verifică setările apelurilor AI.', 'Nu porni apelul dacă serviciul este dezactivat.'])('requires current configuration for %s', async prompt => {
    vi.mocked(readOutreachConfiguration).mockResolvedValue({ rows: [{ enabled: false }], complete: true } as any);
    const read = call('outreach_configuration', {});
    const model = scripted(final, read, call('goal_coverage', { requirements: [{ id: 'settings', sourceQuote: prompt, description: 'Setări actuale', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    expect((await planTurn(ctx, prompt, [], { provider: model })).metrics.status).toBe('success');
    expect(readOutreachConfiguration).toHaveBeenCalledWith(ctx);
    expect(model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name)).not.toContain('goal_coverage');
  });
  it('does not certify outreach settings without reading them', async () => {
    expect((await planTurn(ctx, 'Verifică setările de outreach.', [], { provider: scripted(final) })).metrics.status).toBe('partial');
  });
  it('keeps AI call reading compact and binds the requested filter and pagination', async () => {
    const prompt = 'Care apeluri AI au eșuat?';
    vi.mocked(readOutreachHistory).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'next' } as any).mockResolvedValueOnce({ rows: [], complete: true } as any);
    const first = call('outreach_history', { mode: 'all' }), last = call('outreach_history', { mode: 'latest_result' });
    const model = scripted(first, final, last, call('goal_coverage', { requirements: [{ id: 'calls', sourceQuote: prompt, description: 'Eșuate', resolution: 'answered', steps: [], evidenceCallIds: [last.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(readOutreachHistory).toHaveBeenNthCalledWith(1, ctx, { mode: 'failed' });
    expect(readOutreachHistory).toHaveBeenNthCalledWith(2, ctx, { mode: 'failed', cursor: 'next' });
    expect(JSON.stringify(model.respond.mock.calls[0][0].tools).length).toBeLessThan(12000);
  });
  it('does not certify an AI call list without any CRM read', async () => {
    const result = await planTurn(ctx, 'Arată-mi apelurile AI de prospectare.', [], { provider: scripted(final) });
    expect(result.metrics.status).toBe('partial');
  });

  it('finishes every phone-lookup page for the selected prospect without reading timelines', async () => {
    const prompt = 'Verifică dacă numărul lui apare și la alte anunțuri.';
    const history: any[] = [{ id: 'selection', role: 'assistant', text: 'Selectat', cards: [{ source: 'ownerListingFavorites', rows: [{ id: 'p' }] }] }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'page-2' } as any).mockResolvedValueOnce({ rows: [{ id: 'other' }], complete: true } as any);
    const first = call('owner_prospects', { listingId: 'wrong', scope: 'agency_history' });
    const last = call('owner_prospects', { listingId: 'p', cursor: 'model-transcribed-cursor' });
    const model = scripted(first, final, last, call('goal_coverage', { requirements: [{ id: 'phone', sourceQuote: prompt, description: 'Alte anunțuri', resolution: 'answered', steps: [], evidenceCallIds: [last.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, history, { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(readOwnerProspects).toHaveBeenNthCalledWith(1, ctx, { listingId: 'p' }, undefined, undefined);
    expect(readOwnerProspects).toHaveBeenNthCalledWith(2, ctx, { listingId: 'p', cursor: 'page-2' }, undefined, undefined);
    expect(readTimeline).not.toHaveBeenCalled();
    expect(JSON.stringify(model.respond.mock.calls)).toContain('page-2');
  });
  it('does not treat server-driven cursor progress as circular calls when the model omits cursors', async () => {
    const prompt = 'Verifică dacă numărul lui apare și la alte anunțuri.';
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'second' } as any).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'third' } as any).mockResolvedValueOnce({ rows: [], complete: true } as any);
    const reads = Array.from({ length: 3 }, () => call('owner_prospects', { listingId: 'p' }));
    const model = scripted(...reads, call('goal_coverage', { requirements: [{ id: 'phone', sourceQuote: prompt, description: 'Verificat', resolution: 'answered', steps: [], evidenceCallIds: [reads[2].calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [{ role: 'assistant', text: 'Selectat', cards: [{ source: 'ownerListingFavorites', rows: [{ id: 'p' }] }] }] as any, { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(result.metrics.tools.every(tool => tool.status === 'success')).toBe(true);
    expect(readOwnerProspects).toHaveBeenNthCalledWith(3, ctx, { listingId: 'p', cursor: 'third' }, undefined, undefined);
  });
  it('asks for the missing phone before concluding there are no other listings', async () => {
    const prompt = 'Verifică dacă numărul lui apare și la alte anunțuri.';
    vi.mocked(readOwnerProspects).mockResolvedValue({ rows: [], complete: false, reason: 'missing_valid_phone' } as any);
    const result = await planTurn(ctx, prompt, [{ role: 'assistant', text: 'Selectat', cards: [{ source: 'ownerListingFavorites', rows: [{ id: 'p' }] }] }] as any, { provider: scripted(call('owner_prospects', { listingId: 'p' })) });
    expect(result.metrics.status).toBe('clarification');
    expect(result.ownerHistoryContinuation).toEqual({ listingId: 'p', request: prompt });
  });

  it('keeps owner history schemas compact while preserving discovery and all required reads', async () => {
    const prompt = 'Arată-mi toate interacțiunile cu acest proprietar.';
    vi.mocked(readOwnerProspects).mockResolvedValue({ rows: [{ resource: 'ownerListingFavorites', id: 'p', readMode: 'timeline' }], complete: true } as any);
    vi.mocked(readTimeline).mockResolvedValue({ rows: [], complete: true } as any);
    const first = call('owner_prospects', { listingId: 'p', scope: 'agency_history' });
    const timeline = call('timeline', { resource: 'ownerListingFavorites', id: 'p' });
    const model = scripted(first, timeline, call('goal_coverage', { requirements: [{ id: 'history', sourceQuote: prompt, description: 'Istoric', resolution: 'answered', steps: [], evidenceCallIds: [first.calls[0].id, timeline.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [{ id: 'selected', role: 'assistant', text: 'Prospect selectat.', createdAt: '2026-10-11T07:00:00Z', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Prospect', rows: [{ id: 'p' }] }] }], { provider: model });
    expect(result.metrics.status).toBe('success');
    const names = model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name);
    expect(names).toEqual(expect.arrayContaining(['owner_prospects', 'timeline', 'read', 'read_related', 'discover_tools']));
    expect(names).not.toContain('create_property');
    expect(names).not.toContain('goal_coverage');
    expect(model.respond.mock.calls[1][0].tools.map((tool: any) => tool.name)).not.toContain('goal_coverage');
    expect(model.respond.mock.calls[2][0].tools.map((tool: any) => tool.name)).toContain('goal_coverage');
    const closure = model.respond.mock.calls[2][0].input.find((item: any) => item.role === 'developer' && item.content.includes('Citirile obligatorii sunt încheiate'));
    expect(closure.content).toContain(JSON.stringify({ sourceQuote: prompt, evidenceCallIds: [first.calls[0].id, timeline.calls[0].id] }));
    expect(names.length).toBeLessThanOrEqual(10);
  });
  it('asks for missing owner identity and resumes the read using the supplied phone', async () => {
    const prompt = 'Arată istoricul proprietarului.';
    const history: any[] = [{ id: 'selected', role: 'assistant', text: 'Selectat', createdAt: '', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Selectat', rows: [{ id: 'p' }] }] }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: true, identityComplete: false } as any);
    const first = await planTurn(ctx, prompt, [...history, { id: 'current-page-context', role: 'user', text: 'Nicio selecție', createdAt: '', cards: [] }], { provider: scripted(call('owner_prospects', { listingId: 'p', scope: 'agency_history' })) });
    expect(first.metrics.status).toBe('clarification');
    expect(first.metrics.tools).toMatchObject([{ name: 'owner_prospects', status: 'success' }]);
    expect(first.ownerHistoryContinuation).toEqual({ listingId: 'p', request: prompt });
    const pending: any[] = [{ id: 'reply', role: 'assistant', text: first.text, createdAt: '', ownerHistoryContinuation: first.ownerHistoryContinuation }];
    const invalid = await planTurn(ctx, '0722', pending, { provider: scripted(final) });
    expect(invalid.metrics.status).toBe('clarification');
    expect(invalid.ownerHistoryContinuation).toEqual(first.ownerHistoryContinuation);
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: true, identityComplete: true } as any);
    const read = call('owner_prospects', { listingId: 'p', scope: 'agency_history' });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'history', sourceQuote: prompt, description: 'Istoric', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const resumed = await planTurn(ctx, '+40 722 123 456', pending, { provider: model });
    expect(resumed.metrics.status, resumed.text).toBe('success');
    expect(resumed.ownerHistoryContinuation).toBeUndefined();
    expect(readOwnerProspects).toHaveBeenLastCalledWith(ctx, expect.objectContaining({ listingId: 'p' }), '0722123456', undefined);
    expect(resumed.actions).toEqual([]);
  });
  it('directs premature history closure to the unread timeline page with its actual cursor', async () => {
    const prompt = 'Arată istoricul proprietarului.';
    const history: any[] = [{ id: 'selected', role: 'assistant', text: 'Selectat', createdAt: '', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Selectat', rows: [{ id: 'p' }] }] }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [{ resource: 'properties', id: 'imported', readMode: 'timeline' }], complete: true, identityComplete: true } as any);
    vi.mocked(readTimeline).mockResolvedValueOnce({ rows: [], complete: false, nextCursor: 'actual-next-page' } as any).mockResolvedValueOnce({ rows: [], complete: true } as any);
    const discovery = call('owner_prospects', { listingId: 'p', scope: 'agency_history' });
    const page = call('timeline', { resource: 'properties', id: 'imported', limit: 20 });
    const last = call('timeline', { resource: 'properties', id: 'imported', limit: 20, cursor: 'actual-next-page' });
    const model = scripted(discovery, page, final, last, call('goal_coverage', { requirements: [{ id: 'history', sourceQuote: prompt, description: 'Istoric complet', resolution: 'answered', steps: [], evidenceCallIds: [discovery.calls[0].id, last.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, history, { provider: model });
    expect(result.metrics.status, result.text).toBe('success');
    const repair = model.respond.mock.calls[3][0].input.find((item: any) => item.role === 'developer' && item.content.includes('citiri obligatorii'));
    expect(repair.content).toContain('actual-next-page');
    expect(repair.content).toContain('imported');
    expect(result.metrics.tools.every(tool => tool.status === 'success')).toBe(true);
  });
  it('persists ambiguous import clarification and resumes only the confirmed property association', async () => {
    const prompt = 'Arată istoricul proprietarului.';
    const history: any[] = [{ id: 'selected', role: 'assistant', text: 'Selectat', createdAt: '', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Selectat', rows: [{ id: 'p' }] }] }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: true, identityComplete: true, unresolvedReferences: [{ propertyId: 'imported', title: 'Apartament Cișmigiu', reason: 'ambiguous_source_url', referenceHash: 'hash' }] } as any);
    const first = await planTurn(ctx, prompt, history, { provider: scripted(call('owner_prospects', { listingId: 'p', scope: 'agency_history' })) });
    expect(first.metrics.status).toBe('clarification');
    expect(first.text).toContain('Apartament Cișmigiu');
    expect(first.ownerHistoryContinuation?.association).toMatchObject({ propertyId: 'imported', referenceHash: 'hash' });
    const pending: any[] = [{ id: 'reply', role: 'assistant', text: first.text, createdAt: '', ownerHistoryContinuation: first.ownerHistoryContinuation }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: true, identityComplete: true, unresolvedReferences: [] } as any);
    const read = call('owner_prospects', { listingId: 'p', scope: 'agency_history' });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'history', sourceQuote: prompt, description: 'Istoric', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, 'Da.', pending, { provider: model });
    expect(result.metrics.status, result.text).toBe('success');
    expect(readOwnerProspects).toHaveBeenLastCalledWith(ctx, expect.objectContaining({ listingId: 'p' }), undefined, [{ propertyId: 'imported', referenceHash: 'hash', related: true }]);
    expect(result.actions).toEqual([]);
    expect(result.ownerHistoryContinuation).toBeUndefined();
  });
  it('binds owner history discovery to the selected prospect instead of a model-transcribed ID', async () => {
    const prompt = 'Arată istoricul proprietarului.';
    const history: any[] = [{ id: 'selected', role: 'assistant', text: 'Selectat', createdAt: '', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Selectat', rows: [{ id: 'correct-id' }] }] }];
    vi.mocked(readOwnerProspects).mockResolvedValueOnce({ rows: [], complete: true, identityComplete: true } as any);
    history[0].cards.unshift({ type: 'data', source: 'ownerListingFavorites', title: 'Lista anterioară', rows: [{ id: 'another' }, { id: 'unselected' }] });
    const read = call('owner_prospects', { listingId: 'mistyped-id' });
    const model = scripted(read, call('goal_coverage', { requirements: [{ id: 'history', sourceQuote: prompt, description: 'Istoric', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, history, { provider: model });
    expect(readOwnerProspects).toHaveBeenCalledWith(ctx, { listingId: 'correct-id', scope: 'agency_history' }, undefined, undefined);
    expect(result.metrics.status, result.text).toBe('success');
    expect(result.metrics.tools.every(tool => tool.status === 'success')).toBe(true);
  });
  it('does not certify owner history when the model returns text without reading any records', async () => {
    const result = await planTurn(ctx, 'Arată-mi toate interacțiunile cu acest proprietar.', [{ id: 'selected', role: 'assistant', text: 'Prospect selectat.', createdAt: '2026-10-11T07:00:00Z', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Prospect', rows: [{ id: 'p' }] }] }], { provider: scripted(final) });
    expect(result.metrics.status).toBe('partial');
  });
  it('keeps history closure unavailable while an association page remains unread', async () => {
    vi.mocked(readOwnerProspects).mockResolvedValue({ rows: [], complete: false, nextCursor: 'more' } as any);
    const model = scripted(call('owner_prospects', { listingId: 'p', scope: 'agency_history' }), final);
    const result = await planTurn(ctx, 'Arată-mi toate interacțiunile cu acest proprietar.', [{ id: 'selected', role: 'assistant', text: 'Prospect selectat.', createdAt: '2026-10-11T07:00:00Z', cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Prospect', rows: [{ id: 'p' }] }] }], { provider: model });
    expect(result.metrics.status).toBe('partial');
    for (const [request] of model.respond.mock.calls) expect(request.tools.map((tool: any) => tool.name)).not.toContain('goal_coverage');
  });
  it('accepts a date-only task from the resolved Bucharest day without inventing a task hour', async () => {
    const prompt = 'Creează follow-up pentru 2030-10-27, fără oră.';
    const action = { kind: 'create_task', ownerListingId: 'p', description: 'Follow-up', dueDate: '2030-10-27' };
    const model = scripted(call('resolve_datetime', { date: '2030-10-27', time: '12:00' }), call('propose_actions', { actions: [action] }), call('goal_coverage', { requirements: [{ id: 'followup', sourceQuote: prompt, description: 'Task fără oră', resolution: 'planned', steps: [1], evidenceCallIds: [] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(result.actions).toEqual([action]);
  });
  it('reaches the provider for a short prospect clarification reply while retaining discovery', async () => {
    const model = scripted(final);
    const result = await planTurn(ctx, 'Colaborează.', [
      { id: 'clarification', role: 'assistant', text: 'Ce status?', createdAt: '2026-10-11T07:00:00Z', prospectContinuation: { listingId: 'p', request: 'Actualizează statusul prospectului selectat.' } },
      { id: 'current-page-context', role: 'assistant', text: 'Pagina curentă nu are client sau proprietate.', createdAt: '2026-10-11T07:01:00Z' },
    ], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(model.respond).toHaveBeenCalledOnce();
    const names = model.respond.mock.calls[0][0].tools.map((tool: any) => tool.name);
    expect(names).toContain('update_prospect');
    expect(names).toContain('discover_tools');
    expect(names).not.toContain('create_property');
  });
  it('repairs a viewing proposed before its new buyer without retaining the invalid first action', async () => {
    const prompt = 'Programează vizionarea la 2030-01-01T05:30:00Z pentru Matei Alin.';
    const viewing = { kind: 'schedule_viewing', contactId: '@step:1:contactId', propertyId: 'p', viewingDate: '2030-01-01T05:30:00Z', duration: 60, notes: '' };
    const model = scripted(call('propose_actions', { actions: [viewing] }),
      call('propose_actions', { actions: [{ kind: 'create_contact', name: 'Matei Alin', phone: '0123123123', contactType: 'Cumparator' }, viewing] }),
      call('goal_coverage', { requirements: [{ id: 'viewing', sourceQuote: prompt, description: 'Cumpărător și vizionare', resolution: 'planned', steps: [1, 2], evidenceCallIds: [] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(result.actions.map(action => action.kind)).toEqual(['create_contact', 'schedule_viewing']);
    expect(result.metrics.tools.map(tool => tool.status)).toEqual(['failed', 'success', 'success']);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('master-0806 continues after the first read and prepares the missing follow-up before finalizing', async () => {
    const prompt = corpus.scenarios.find(row => row.id === 'master-0806')!.text;
    vi.mocked(readResource).mockResolvedValue({ rows: [{ id: 'v', status: 'completed' }], complete: true } as any);
    const first = call('read', { resource: 'viewings' });
    const model = scripted(first, final,
      call('resolve_datetime', { date: '2030-01-01', time: '12:00' }),
      call('propose_actions', { actions: [{ kind: 'create_task', description: 'Follow-up vizionare v', dueDate: '2030-01-01T10:00:00.000Z' }] }),
      call('goal_coverage', { requirements: [{ id: 'followup', sourceQuote: prompt, description: 'Verifică vizionările și pregătește follow-up', resolution: 'planned', steps: [1], evidenceCallIds: [first.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(result.actions).toMatchObject([{ kind: 'create_task', description: 'Follow-up vizionare v' }]);
    expect(model.respond).toHaveBeenCalledTimes(6);
    expect(model.respond.mock.calls[2][0].input.some((item: any) => item.role === 'developer' && item.content.includes('Nu încheia după primul pas'))).toBe(true);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it.each(['master-0801', 'master-0850'])('%s does not certify completion when a model keeps stopping after the first lookup', async id => {
    vi.mocked(readResource).mockResolvedValue({ rows: [{ id: 'p' }], complete: true } as any);
    const model = scripted(call('read', { resource: 'properties' }), final, final, final);
    const result = await planTurn(ctx, corpus.scenarios.find(row => row.id === id)!.text, [], { provider: model });
    expect(result.metrics.status).toBe('partial');
    expect(result.text).toContain('Acoperirea cererii nu a putut fi verificată');
    expect(model.respond).toHaveBeenCalledTimes(4);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('master-0849 requests clarification when the previous goal context is missing', async () => {
    const prompt = corpus.scenarios.find(row => row.id === 'master-0849')!.text;
    const model = scripted(call('goal_coverage', { requirements: [{ id: 'remaining', sourceQuote: prompt, description: 'Lipsește contextul obiectivului anterior', resolution: 'needs_clarification', steps: [], evidenceCallIds: [] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('clarification');
    expect(result.text).toContain('Lipsește contextul obiectivului anterior');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('continues after an unsuccessful first read and accepts only evidence from the recovered read', async () => {
    const prompt = 'Citește clientul c1.';
    vi.mocked(readResource).mockRejectedValueOnce(new Error('Citire indisponibilă')).mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Client' }], complete: true } as any);
    const failed = call('read', { resource: 'contacts', id: 'c1' });
    const recovered = call('read', { resource: 'contacts', id: 'c1' });
    const model = scripted(failed, final, recovered,
      call('goal_coverage', { requirements: [{ id: 'client', sourceQuote: prompt, description: 'Datele clientului', resolution: 'answered', steps: [], evidenceCallIds: [recovered.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('success');
    expect(result.metrics.tools.map(tool => tool.status)).toEqual(['failed', 'success', 'success']);
    expect(model.respond).toHaveBeenCalledTimes(5);
    expect(result.goalCoverage?.requirements[0].evidenceCallIds).toEqual([recovered.calls[0].id]);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('does not accept a failed first read as proof or certify its repeated final answer', async () => {
    const prompt = 'Citește clientul c1.';
    vi.mocked(readResource).mockRejectedValueOnce(new Error('Citire indisponibilă'));
    const failed = call('read', { resource: 'contacts', id: 'c1' });
    const model = scripted(failed,
      call('goal_coverage', { requirements: [{ id: 'client', sourceQuote: prompt, description: 'Datele clientului', resolution: 'answered', steps: [], evidenceCallIds: [failed.calls[0].id] }] }), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    expect(result.metrics.status).toBe('partial');
    expect(result.metrics.tools.map(tool => tool.status)).toEqual(['failed', 'failed']);
    expect(result.goalCoverage).toBeUndefined();
    expect(model.respond).toHaveBeenCalledTimes(5);
    expect(readResource).toHaveBeenCalledTimes(1);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('does not mark an empty final model response as successful', async () => {
    const result = await planTurn(ctx, 'Arată rezultatele.', [], { provider: scripted({ ...final, text: '   ' }) });
    expect(result.metrics.status).toBe('partial');
    expect(result.text).toContain('Răspuns incomplet');
    expect(result.actions).toEqual([]);
  });
  it('retains server-validated requirement coverage and invalidates it after another proposal', async () => {
    const proposal = () => call('propose_actions', { actions: [{ kind: 'create_task', description: 'Sarcină', dueDate: '2030-01-01T10:00:00.000Z' }] });
    const coverage = () => call('goal_coverage', { requirements: [{ id: 'task', sourceQuote: 'Creează', description: 'Sarcina cerută', resolution: 'planned', steps: [1], evidenceCallIds: [] }] });
    const prompt = 'Creează o sarcină la 2030-01-01T10:00:00Z.';
    const result = await planTurn(ctx, prompt, [], { provider: scripted(proposal(), coverage(), final) });
    expect(result.goalCoverage?.requirements[0].steps).toEqual([1]);
    const changed = await planTurn(ctx, prompt, [], { provider: scripted(proposal(), coverage(), proposal(), final) });
    expect(changed.goalCoverage).toBeUndefined();
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('returns authoritative references to repair coverage without accepting proposal IDs as read evidence', async () => {
    const prompt = 'Citește clientul c1 și creează o sarcină la 2030-01-01T10:00:00Z.';
    vi.mocked(readResource).mockResolvedValueOnce({ rows: [{ id: 'c1' }], complete: true } as any);
    const read = call('read', { resource: 'contacts', id: 'c1' });
    const proposal = call('propose_actions', { actions: [{ kind: 'create_task', description: 'Sarcină', dueDate: '2030-01-01T10:00:00.000Z' }] });
    const coverage = (evidenceCallIds: string[]) => call('goal_coverage', { requirements: [{ id: 'task', sourceQuote: prompt, description: 'Citire și sarcină', resolution: 'planned', steps: [1], evidenceCallIds }] });
    const invalid = coverage([proposal.calls[0].id]);
    const model = scripted(read, proposal, invalid, coverage([read.calls[0].id]), final);
    const result = await planTurn(ctx, prompt, [], { provider: model });
    const input = (model.respond.mock.calls[3][0] as any).input;
    const output = JSON.parse(input.find((item: any) => item.type === 'function_call_output' && item.call_id === invalid.calls[0].id).output);
    expect(output.correctionContext).toMatchObject({ sourceQuote: prompt, preparedSteps: [1], successfulReadCallIds: [read.calls[0].id] });
    expect(result.metrics.tools.map(tool => tool.status)).toEqual(['success', 'success', 'failed', 'success']);
    expect(result.goalCoverage?.requirements[0].evidenceCallIds).toEqual([read.calls[0].id]);
    expect(result.metrics.status).toBe('success'); expect(executeAction).not.toHaveBeenCalled();
  });
  it('finishes composing a multi-action workflow after the first proposal', async () => {
    const model = scripted(
      call('propose_actions', { actions: [{ kind: 'create_task', description: 'Primul pas', dueDate: '2030-01-01T10:00:00.000Z' }] }),
      call('propose_actions', { actions: [{ kind: 'create_task', description: 'Al doilea pas', dueDate: '2030-01-01T10:00:00.000Z' }] }), final);
    const result = await planTurn(ctx, 'Creează două sarcini pentru 2030-01-01T10:00:00Z.', [], { provider: model });
    expect(result.actions).toHaveLength(2);
    expect(model.respond).toHaveBeenCalledTimes(5);
    expect(result.metrics.status).toBe('partial');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('retains a fully covered mutation plan when only the final wording call exceeds the step ceiling', async () => {
    const prompt = 'Creează o sarcină la 2030-01-01T10:00:00Z.';
    const proposal = call('propose_actions', { actions: [{ kind: 'create_task', description: 'Sarcină', dueDate: '2030-01-01T10:00:00.000Z' }] });
    const coverage = call('goal_coverage', { requirements: [{ id: 'task', sourceQuote: prompt, description: 'Sarcina cerută', resolution: 'planned', steps: [1], evidenceCallIds: [] }] });
    const model = scripted(proposal, coverage);
    const result = await planTurn(ctx, prompt, [], { provider: model, budget: new AgentBudget({ ...DEFAULT_LIMITS, maxSteps: 2 }) });
    expect(result.metrics.status).toBe('success'); expect(result.actions).toHaveLength(1);
    expect(result.text).toContain('nu au fost executate'); expect(model.respond).toHaveBeenCalledTimes(2);
    expect(executeAction).not.toHaveBeenCalled();
    const incomplete = await planTurn(ctx, prompt, [], { provider: scripted(proposal), budget: new AgentBudget({ ...DEFAULT_LIMITS, maxSteps: 1 }) });
    expect(incomplete.metrics.status).toBe('partial'); expect(incomplete.goalCoverage).toBeUndefined();
  });
  it('retains a validated read-then-write plan when only final wording exceeds the step budget', async () => {
    const prompt = 'Citește clienții și creează o sarcină la 2030-01-01T10:00:00Z.';
    vi.mocked(readResource).mockResolvedValue({ rows: [], complete: true } as any);
    const read = call('read', { resource: 'contacts' });
    const proposal = call('propose_actions', { actions: [{ kind: 'create_task', description: 'Sarcină', dueDate: '2030-01-01T10:00:00.000Z' }] });
    const coverage = call('goal_coverage', { requirements: [
      { id: 'read', sourceQuote: 'Citește clienții', description: 'Clienții citiți', resolution: 'answered', steps: [], evidenceCallIds: [read.calls[0].id] },
      { id: 'write', sourceQuote: 'creează o sarcină', description: 'Sarcina cerută', resolution: 'planned', steps: [1], evidenceCallIds: [] },
    ] });
    const result = await planTurn(ctx, prompt, [], { provider: scripted(read, proposal, coverage), budget: new AgentBudget({ ...DEFAULT_LIMITS, maxSteps: 3 }) });
    expect(result.metrics.status).toBe('success'); expect(result.actions).toHaveLength(1);
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('finalizes only before an unneeded call, never after an unprocessed over-budget response', async () => {
    const prompt = 'Creează o sarcină la 2030-01-01T10:00:00Z.';
    const proposal = call('propose_actions', { actions: [{ kind: 'create_task', description: 'Sarcină', dueDate: '2030-01-01T10:00:00.000Z' }] });
    const coverage = call('goal_coverage', { requirements: [{ id: 'task', sourceQuote: prompt, description: 'Sarcina cerută', resolution: 'planned', steps: [1], evidenceCallIds: [] }] });
    const budget = new AgentBudget();
    const reserve = budget.reserve.bind(budget); let reservations = 0;
    vi.spyOn(budget, 'reserve').mockImplementation((...args) => { if (++reservations === 3) throw new BudgetExceeded('tokens'); reserve(...args); });
    const model = scripted(proposal, coverage);
    expect((await planTurn(ctx, prompt, [], { provider: model, budget })).metrics.status).toBe('success');
    expect(model.respond).toHaveBeenCalledTimes(2);
    const overBudget = scripted(proposal, coverage, { ...final, usage: { ...usage, inputTokens: 70001 } });
    expect((await planTurn(ctx, prompt, [], { provider: overBudget })).metrics.status).toBe('partial');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('does not multiply inherited access references across successive replies', async () => {
    const history: any[] = [{ role: 'assistant', text: 'Rezultat', accessRefs: Array.from({ length: 6192 }, () => ({ resource: 'sales', id: 's' })) }];
    for (let turn = 0; turn < 5; turn++) {
      const result = await planTurn(ctx, 'Salut', history, { provider: scripted(final) });
      expect(result.accessRefs).toEqual([{ resource: 'sales', id: 's' }]);
      history.push({ role: 'assistant', text: result.text, accessRefs: result.accessRefs });
    }
  });
  it('prepares a validated action without performing CRM writes', async () => {
    const fetch = provider('propose_actions', { actions: [{ kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00+02:00' }] });
    const result = await planTurn(ctx, 'Creează o sarcină de follow up la 2030-01-01T10:00:00+02:00.', []);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ dueDate: '2030-01-01T08:00:00.000Z' });
    expect(executeAction).not.toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.tools[0].strict).toBe(true);
    expect(body.parallel_tool_calls).toBe(false);
  });
  it('rejects a model attempt to grant WhatsApp consent', async () => {
    const fetch = provider('propose_actions', { actions: [{ kind: 'grant_whatsapp_consent', phone: '40700000000' }] });
    const result = await planTurn(ctx, 'Verifică eligibilitatea proprietarului.', []);
    expect(result.actions).toEqual([]);
    const input = JSON.parse(fetch.mock.calls[1][1].body).input;
    expect(input.find((item: any) => item.type === 'function_call_output').output).toContain('error');
    expect(executeAction).not.toHaveBeenCalled();
  });
  it('searches the owner corpus by default using an authenticated server tool', async () => {
    provider('search_properties', { zone: 'Titan', priceMax: 130000 });
    vi.mocked(searchProperties).mockResolvedValue({ rows: [], nextCursor: null, complete: true } as any);
    const result = await planTurn(ctx, '5 apartamente în Titan sub 130000 euro', []);
    expect(searchProperties).toHaveBeenCalledWith(ctx, expect.objectContaining({ source: 'owners', zone: 'Titan', limit: 5 }));
    expect(result.cards[0].source).toBe('owners');
  });
  it('uses a genuine multi-step read loop and retains IDs as tool facts', async () => {
    vi.mocked(readResource).mockResolvedValue({ rows: [{ id: 'c1', name: 'Client' }], complete: true } as any);
    const model = scripted(call('read', { resource: 'contacts', id: 'c1' }), final);
    const result = await planTurn(ctx, 'Citește clientul c1.', [], { provider: model });
    expect(model.respond).toHaveBeenCalledTimes(4);
    expect(model.respond.mock.calls[1][0].input.some((item: any) => item.type === 'function_call_output')).toBe(true);
    expect(result.cards[0]).toMatchObject({ outputType: 'CLIENT_LIST', rows: [{ id: 'c1' }] });
  });
  it('retries one provider outage on Luna and records its cost/error without escalating', async () => {
    const model = scripted(new ProviderError('temporary', true), final);
    // Isolate routing from schema byte growth; budget limits have a separate test.
    const result = await planTurn(ctx, 'Salut', [], { provider: model, allowedTools: ['read'], budget: new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 120000 }) });
    expect(model.respond.mock.calls.map(([request]) => request.decision.model)).toEqual(['gpt-6-luna', 'gpt-6-luna']);
    expect(result.metrics.models[0]).toMatchObject({ outcome: 'failed', errorCategory: 'temporary', usage: { estimated: true } });
    expect(result.metrics.models[0].costUsd).toBeGreaterThan(0);
  });
  it('stops after a repeated infrastructure failure and preserves truthful status', async () => {
    const model = scripted(new ProviderError('rate_limit', true), new ProviderError('rate_limit', true));
    // Isolate retry policy from the conservative missing-usage reservation for
    // the entire tool catalog. Production budget limits remain unchanged.
    const result = await planTurn(ctx, 'Salut', [], { provider: model, allowedTools: ['read'] });
    expect(model.respond).toHaveBeenCalledTimes(2); expect(result.metrics.status).toBe('failed'); expect(result.actions).toEqual([]);
  });
  it('escalates after three validated invalid calls, sharing one budget', async () => {
    const model = scripted(call('unknown_tool', {}), call('unknown_tool', {}), call('unknown_tool', {}), final);
    const budget = new AgentBudget();
    const result = await planTurn(ctx, 'Citește datele.', [], { provider: model, budget });
    expect(model.respond.mock.calls.map(([request]) => request.decision.model)).toEqual(['gpt-6-luna', 'gpt-6-luna', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-6.1-sol', 'gpt-6.1-sol']);
    expect(result.metrics.status).toBe('partial');
    expect(budget.calls).toBe(3); expect(result.metrics.tools.every(tool => tool.name === 'unknown_tool')).toBe(true);
  });
  it('uses Sol only after repeated invalid provider output, not the first failure', async () => {
    const model = scripted(new ProviderError('invalid_output', false), new ProviderError('invalid_output', false), final);
    // Isolate routing from conservative byte reservations for unmetered failures.
    const result = await planTurn(ctx, 'Salut', [], { provider: model, allowedTools: ['read'], budget: new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 120000 }) });
    expect(model.respond.mock.calls.map(([request]) => request.decision.model), result.text).toEqual(['gpt-6-luna', 'gpt-6-luna', 'gpt-6.1-sol']);
    expect(result.metrics.status).toBe('success');
  });
  it('blocks a model call before exceeding the token budget', async () => {
    const model = scripted(final);
    const result = await planTurn(ctx, 'Salut', [], { provider: model, budget: new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 100 }) });
    expect(model.respond).not.toHaveBeenCalled(); expect(result.metrics.status).toBe('partial');
  });
  it('rejects date arithmetic fabricated by the model', async () => {
    const model = scripted(call('propose_actions', { actions: [{ kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00.000Z' }] }), final);
    const result = await planTurn(ctx, 'Follow up mâine.', [], { provider: model });
    expect(result.actions).toEqual([]); expect(result.metrics.tools[0].status).toBe('failed');
  });
  it('allows a server-resolved date and still never executes the prepared mutation', async () => {
    const model = scripted(call('resolve_datetime', { date: '2030-01-01', time: '12:00' }), call('propose_actions', { actions: [{ kind: 'create_task', description: 'Follow up', dueDate: '2030-01-01T10:00:00.000Z' }] }), final);
    const result = await planTurn(ctx, 'Follow up pe 1 ianuarie 2030 la ora 12.', [], { provider: model });
    expect(result.actions).toHaveLength(1); expect(executeAction).not.toHaveBeenCalled();
  });
  it('runs independent reads concurrently with the shared tool ceiling', async () => {
    vi.mocked(readResource).mockResolvedValue({ rows: [], complete: true } as any);
    const model = scripted(call('parallel_read', { calls: [{ operation: 'read', payload: { resource: 'contacts' } }, { operation: 'read', payload: { resource: 'tasks' } }] }), final);
    const budget = new AgentBudget();
    const result = await planTurn(ctx, 'Citește clienți și sarcini.', [], { provider: model, budget });
    expect(readResource).toHaveBeenCalledTimes(2); expect(budget.calls).toBe(3); expect(result.cards).toHaveLength(2);
  });
  it('delegates bounded reads with the same tenant and no recursive tool', async () => {
    vi.mocked(readResource).mockResolvedValue({ rows: [], complete: true } as any);
    const model = scripted(call('delegate_read', { goal: 'Citește contactele', tools: ['read'] }), call('read', { resource: 'contacts' }), final, final);
    const result = await planTurn(ctx, 'Analizează contactele.', [], { provider: model });
    expect(readResource).toHaveBeenCalledWith(ctx, expect.objectContaining({ resource: 'contacts' }));
    expect(model.respond.mock.calls[1][0].tools.map((tool: any) => tool.name)).toEqual(['read', 'operation_contract']);
    expect(result.metrics.status).toBe('partial'); expect(result.metrics.models).toHaveLength(6);
  });
  it('retries a transient read once without invoking a mutation', async () => {
    vi.mocked(searchProperties).mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 })).mockResolvedValueOnce({ rows: [], complete: true } as any);
    const model = scripted(call('search_properties', { source: 'owners' }), final);
    const result = await planTurn(ctx, 'Caută proprietari.', [], { provider: model });
    expect(searchProperties).toHaveBeenCalledTimes(2); expect(result.metrics.tools[0].status).toBe('success'); expect(executeAction).not.toHaveBeenCalled();
  });
  it('revokes membership between planning and tools, before accessing CRM records', async () => {
    const model = scripted(call('read', { resource: 'contacts' }), final);
    const revoked = { ...ctx, adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ agencyId: 'other', role: 'agent' }) }) }) }) } } as unknown as AssistantContext;
    // Memory also uses DB; disable its lookup for this isolated membership test.
    vi.stubEnv('JARVIS_MEMORY', 'false');
    const result = await planTurn(revoked, 'Citește clienți.', [], { provider: model });
    expect(readResource).not.toHaveBeenCalled(); expect(result.metrics.tools[0].status).toBe('failed');
  });
});
