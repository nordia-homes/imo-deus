import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn(), readRelated: vi.fn(), readField: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('../actions', () => ({ matchContact: vi.fn(), matchProperty: vi.fn(), executeAction: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn(), operationCatalog: () => [], operationContract: vi.fn(), operations: {}, isReadOperation: vi.fn() }));
vi.mock('../readiness', () => ({ automationReadiness: async () => ({ configured: false, active: false }) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { planTurn } from '../planner';
import { executeAction } from '../actions';
import { searchProperties } from '../search';
import { readResource } from '../access';
import { ProviderError, type ProviderResult, type ModelProvider } from '../provider';
import { AgentBudget, DEFAULT_LIMITS } from '../budget';
import type { AssistantContext } from '../access';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
function provider(operation: string, payload: unknown) {
  vi.stubEnv('OPENAI_API_KEY', 'test-only');
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ type: 'function_call', name: 'crm', call_id: 'call', arguments: JSON.stringify({ operation, payload: JSON.stringify(payload) }) }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({text: 'Plan pregătit.', intentStatus: 'answer'}) }] }] }) });
  vi.stubGlobal('fetch', fetch); return fetch;
}
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
const usage = { inputTokens: 100, outputTokens: 20, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
function call(name: string, payload: unknown): ProviderResult {
  const fn = { id: crypto.randomUUID(), name, arguments: JSON.stringify({ payload: JSON.stringify(payload) }) };
  return { calls: [fn], items: [{ type: 'function_call', call_id: fn.id, name, arguments: fn.arguments }], text: '', usage, status: 'completed', latencyMs: 1 };
}
const final: ProviderResult = { calls: [], items: [], text: 'Rezultate confirmate.', intentStatus: 'answer', usage, status: 'completed', latencyMs: 1 };
function scripted(...responses: (ProviderResult | Error)[]) {
  const respond = vi.fn(); for (const response of responses) response instanceof Error ? respond.mockRejectedValueOnce(response) : respond.mockResolvedValueOnce(response);
  return { id: 'fixture', respond } satisfies ModelProvider;
}
describe('Responses tool planning', () => {
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
  it('finishes composing a multi-action workflow after the first proposal', async () => {
    const model = scripted(
      call('propose_actions', { actions: [{ kind: 'create_task', description: 'Primul pas', dueDate: '2030-01-01T10:00:00.000Z' }] }),
      call('propose_actions', { actions: [{ kind: 'create_task', description: 'Al doilea pas', dueDate: '2030-01-01T10:00:00.000Z' }] }), final);
    const result = await planTurn(ctx, 'Creează două sarcini pentru 2030-01-01T10:00:00Z.', [], { provider: model });
    expect(result.actions).toHaveLength(2);
    expect(model.respond).toHaveBeenCalledTimes(3);
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
    expect(model.respond).toHaveBeenCalledTimes(2);
    expect(model.respond.mock.calls[1][0].input.at(-1)).toMatchObject({ type: 'function_call_output' });
    expect(result.cards[0]).toMatchObject({ outputType: 'CLIENT_LIST', rows: [{ id: 'c1' }] });
  });
  it('retries one provider outage on Luna and records its cost/error without escalating', async () => {
    const model = scripted(new ProviderError('temporary', true), final);
    // Isolate routing from schema byte growth; budget limits have a separate test.
    const result = await planTurn(ctx, 'Salut', [], { provider: model, budget: new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 120000 }) });
    expect(model.respond.mock.calls.map(([request]) => request.decision.model)).toEqual(['gpt-6-luna', 'gpt-6-luna']);
    expect(result.metrics.models[0]).toMatchObject({ outcome: 'failed', errorCategory: 'temporary', usage: { estimated: true } });
    expect(result.metrics.models[0].costUsd).toBeGreaterThan(0);
  });
  it('stops after a repeated infrastructure failure and preserves truthful status', async () => {
    const model = scripted(new ProviderError('rate_limit', true), new ProviderError('rate_limit', true));
    const result = await planTurn(ctx, 'Salut', [], { provider: model });
    expect(model.respond).toHaveBeenCalledTimes(2); expect(result.metrics.status).toBe('failed'); expect(result.actions).toEqual([]);
  });
  it('escalates after three validated invalid calls, sharing one budget', async () => {
    const model = scripted(call('unknown_tool', {}), call('unknown_tool', {}), call('unknown_tool', {}), final);
    const budget = new AgentBudget();
    const result = await planTurn(ctx, 'Citește datele.', [], { provider: model, budget });
    expect(model.respond.mock.calls.map(([request]) => request.decision.model)).toEqual(['gpt-6-luna', 'gpt-6-luna', 'gpt-6-luna', 'gpt-6.1-sol']);
    expect(budget.calls).toBe(3); expect(result.metrics.tools.every(tool => tool.name === 'unknown_tool')).toBe(true);
  });
  it('uses Sol only after repeated invalid provider output, not the first failure', async () => {
    const model = scripted(new ProviderError('invalid_output', false), new ProviderError('invalid_output', false), final);
    const result = await planTurn(ctx, 'Salut', [], { provider: model, budget: new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 120000 }) });
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
    expect(result.metrics.status).toBe('success'); expect(result.metrics.models).toHaveLength(4);
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
