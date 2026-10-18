vi.mock('../outreach-history', async (importOriginal) => ({ ...await importOriginal<typeof import('../outreach-history')>(), readOutreachHistory: vi.fn() }));
import { readOutreachHistory } from '../outreach-history';
vi.mock('../outreach-configuration', () => ({ readOutreachConfiguration: vi.fn() }));
import { readOutreachConfiguration } from '../outreach-configuration';
vi.mock('../outreach-preflight', () => ({ readOutreachPreflight: vi.fn() }));
import { readOutreachPreflight } from '../outreach-preflight';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn(), readRelated: vi.fn(), readField: vi.fn() }));
vi.mock('../search', () => ({ searchProperties: vi.fn() }));
vi.mock('../owner-prospects', async (importOriginal) => ({ ...await importOriginal<typeof import('../owner-prospects')>(), readOwnerProspects: vi.fn() }));
vi.mock('../timeline', async (importOriginal) => ({ ...await importOriginal<typeof import('../timeline')>(), readTimeline: vi.fn() }));
vi.mock('../actions', () => ({ matchContact: vi.fn(), matchProperty: vi.fn(), executeAction: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn(), operationCatalog: () => [], operationContract: vi.fn(), operations: { conversation_messages: { method: 'GET', path: '/messages', description: 'Mesaje.' } }, isReadOperation: vi.fn((name: string) => name === 'conversation_messages') }));
vi.mock('../readiness', () => ({ automationReadiness: async () => ({ configured: false, active: false }) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {
        constructor(message: string, public status = 400) { super(message); }
    } }));
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
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'function_call', name: 'crm', call_id: 'call', arguments: JSON.stringify({ operation, payload: JSON.stringify(payload) }) }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text: 'Plan pregătit.', intentStatus: 'answer' }) }] }] }) });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ usage: reportedUsage, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ text: 'Plan pregătit.', intentStatus: 'answer' }) }] }] }) });
    vi.stubGlobal('fetch', fetch);
    return fetch;
}
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
const usage = { inputTokens: 100, outputTokens: 20, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
function call(name: string, payload: unknown): ProviderResult {
    const fn = { id: crypto.randomUUID(), name, arguments: JSON.stringify({ payload: JSON.stringify(payload) }) };
    return { calls: [fn], items: [{ type: 'function_call', call_id: fn.id, name, arguments: fn.arguments }], text: '', usage, status: 'completed', latencyMs: 1 };
}
const final: ProviderResult = { calls: [], items: [], text: 'Rezultate confirmate.', intentStatus: 'answer', usage, status: 'completed', latencyMs: 1 };
import { selectionFallback } from '../jev-selection';
function chosen(modules: any[]) { return { modules, inputTokens: 50, outputTokens: 10, costUsd: 0.0000021, latencyMs: 2, status: 'ok' as const, reason: 'fixture', estimated: false }; }
it.each(['off', 'shadow', 'active'])('reaches the main model with retained conversation context in %s mode', async (mode) => {
    vi.stubEnv('JARVIS_JEV_MODE', mode);
    const select = vi.fn(async () => chosen(['marketing']));
    const respond = vi.fn(async (_request: import('../provider').ProviderRequest) => final);
    const history = [{ id: 'old', role: 'user' as const, text: 'Detaliu original important. '.repeat(70), createdAt: '2026-10-18T06:00:00Z' }];
    const result = await planTurn(ctx, 'Găsește apartamente în Titan sub 130000 euro', history, { provider: { id: 'fixture', respond }, jevSelector: { select } });
    expect(respond).toHaveBeenCalled();
    expect(JSON.stringify(respond.mock.calls)).toContain('Detaliu original important');
    expect(select).toHaveBeenCalledTimes(mode === 'off' ? 0 : 1);
    expect(result.metrics.capabilityRouting?.loaded).toContain('properties');
    if (mode === 'active')
        expect(result.metrics.capabilityRouting?.loaded).toContain('marketing');
    else
        expect(result.metrics.capabilityRouting?.loaded).not.toContain('marketing');
});
it.each(['throws', 'invalid', 'fallback'])('continues when selection %s', async (kind) => {
    vi.stubEnv('JARVIS_JEV_MODE', 'active');
    const select = vi.fn(async () => { if (kind === 'throws')
        throw new Error('network'); return kind === 'invalid' ? { modules: ['invented'] } : selectionFallback('unavailable'); });
    const respond = vi.fn(async (_request: import('../provider').ProviderRequest) => final);
    const result = await planTurn(ctx, 'Salut', [], { provider: { id: 'fixture', respond }, jevSelector: { select: select as any } });
    expect(result.metrics.status).toBe('success');
    expect(respond).toHaveBeenCalledOnce();
    expect(result.metrics.capabilityRouting?.status).toBe('fallback');
});
it('loads missing capabilities without repeating a previously prepared action', async () => {
    vi.stubEnv('JARVIS_JEV_MODE', 'active');
    const first = call('propose_actions', { actions: [{ kind: 'create_contact', name: 'Matei Alin', contactType: 'Cumparator' }] });
    const load = call('load_capabilities', { capabilities: ['calendar'], tools: ['schedule_viewing'] });
    const second = call('propose_actions', { actions: [{ kind: 'schedule_viewing', propertyId: 'p', contactId: '@step:1:contactId', viewingDate: '2030-01-01T05:30:00Z', duration: 60, notes: '' }] });
    const prompt = 'Creează cumpărătorul Matei Alin, apoi programează vizionarea la 2030-01-01T05:30:00Z.';
    const results = [first, load, second, call('goal_coverage', { requirements: [{ id: 'all', sourceQuote: prompt, description: 'Cumpărător și vizionare', resolution: 'planned', steps: [1, 2], evidenceCallIds: [] }] }), final];
    const respond = vi.fn(async (_request: import('../provider').ProviderRequest) => results.shift() || final);
    const result = await planTurn(ctx, prompt, [], { provider: { id: 'fixture', respond }, jevSelector: { select: async () => chosen([]) } });
    expect(result.metrics.status, result.text).toBe('success');
    expect(result.actions.map(a => a.kind)).toEqual(['create_contact', 'schedule_viewing']);
    expect(respond.mock.calls.length).toBe(5);
    expect(executeAction).not.toHaveBeenCalled();
});
it('loads domain instructions before an unforeseen proposal and only prepares it on retry', async () => {
    vi.stubEnv('JARVIS_JEV_MODE', 'active');
    const request = call('propose_actions', { actions: [{ kind: 'create_contact', name: 'Matei Alin', contactType: 'Cumparator' }] });
    const respond = vi.fn().mockResolvedValueOnce(request).mockResolvedValueOnce({ ...request, calls: [{ ...request.calls[0], id: 'retry' }], items: [{ ...(request.items[0] as any), call_id: 'retry' }] }).mockResolvedValueOnce(call('goal_coverage', { requirements: [{ id: 'all', sourceQuote: 'Continuă.', description: 'Continuare', resolution: 'planned', steps: [1], evidenceCallIds: [] }] })).mockResolvedValue(final);
    const result = await planTurn(ctx, 'Continuă.', [], { provider: { id: 'fixture', respond }, jevSelector: { select: async () => chosen([]) } });
    expect(result.actions).toHaveLength(1);
    expect(result.metrics.capabilityRouting?.expansions).toBe(1);
    const secondRequest = respond.mock.calls[1][0];
    expect(JSON.stringify(secondRequest.input)).toContain('retryRequired');
    expect(result.metrics.status).toBe('success');
});
it('rejects forbidden expansion and retains original authorization boundaries', async () => {
    const request = call('load_capabilities', { capabilities: ['settings'], tools: ['update_agency'] });
    const respond = vi.fn().mockResolvedValueOnce(request).mockResolvedValue(final);
    const result = await planTurn(ctx, 'Salut', [], { provider: { id: 'fixture', respond } });
    expect(result.actions).toEqual([]);
    expect(result.metrics.tools[0].status).toBe('failed');
    expect(executeAction).not.toHaveBeenCalled();
});
it('does not use discovery as proof of a business result', async () => {
    const prompt = 'Salut';
    const load = call('load_capabilities', { capabilities: ['calendar'], tools: ['viewing_details'] });
    const respond = vi.fn().mockResolvedValueOnce(load).mockResolvedValueOnce(call('goal_coverage', { requirements: [{ id: 'read', sourceQuote: prompt, description: 'Date CRM', resolution: 'answered', steps: [], evidenceCallIds: [load.calls[0].id] }] })).mockResolvedValue(final);
    const result = await planTurn(ctx, prompt, [], { provider: { id: 'fixture', respond } });
    expect(result.metrics.tools.find(t => t.name === 'goal_coverage')?.status).toBe('failed');
});

it('loads the reprogramming rule even when the action is wrapped by propose_actions',async()=>{
 vi.stubEnv('JARVIS_JEV_MODE','active');
 const request=call('propose_actions',{actions:[{kind:'update_viewing',viewingId:'v',status:'scheduled',viewingDate:'2030-01-01T05:30:00Z'}]});
 const respond=vi.fn().mockResolvedValueOnce(request).mockResolvedValue(final);
 const result=await planTurn(ctx,'Continuă.',[],{provider:{id:'fixture',respond},jevSelector:{select:async()=>chosen(['calendar'])}});
 expect(result.actions).toEqual([]);expect(respond.mock.calls[1][0].instructions).toContain('Pentru mutarea unei vizionări');expect(JSON.stringify(respond.mock.calls[1][0].input)).toContain('retryRequired');
});


it.each(['active','shadow','off'])('loads the complete Facebook preflight from a Jev workflow hint in %s mode',async mode=>{
 vi.stubEnv('JARVIS_JEV_MODE',mode);
 const respond=vi.fn(async (_request:import('../provider').ProviderRequest)=>final);
 const select=vi.fn(async()=>({...chosen([]),workflows:['facebook_publication' as const]}));
 const result=await planTurn(ctx,'Hai să ducem oferta acolo și apoi să verificăm calendarul.',[],{provider:{id:'fixture',respond},jevSelector:{select}});
 const names=respond.mock.calls[0][0].tools.map(tool=>tool.name);
 expect(names.includes('facebook_publication_preflight')).toBe(mode==='active');
 expect(names).toContain('load_capabilities');
 expect(result.actions).toEqual([]);
 if(mode==='active')expect(result.metrics.capabilityRouting?.workflows).toEqual(['facebook_publication']);
});


it('presents direct record queries after switching away from a completed Facebook request',async()=>{
 vi.stubEnv('JARVIS_JEV_MODE','off');const respond=vi.fn(async (_request:import('../provider').ProviderRequest)=>final);
 const history=[{id:'previous',role:'assistant' as const,text:'Cererea de publicare Facebook pentru Cișmigiu a fost creată.',createdAt:new Date().toISOString(),cards:[{type:'data' as const,source:'facebookJobs',title:'Publicare',rows:[{id:'job',propertyId:'old-property',connectionId:'account'}]}]}];
 await planTurn(ctx,'Câte vizionări sunt mâine?',history,{provider:{id:'fixture',respond}});
 expect(respond.mock.calls[0][0].tools.map(tool=>tool.name)).toContain('query_records');
 expect(respond.mock.calls[0][0].instructions).toContain('Cererea curentă stabilește');
 expect(respond.mock.calls[0][0].input).toContainEqual({role:'user',content:'Câte vizionări sunt mâine?'});
});


it.each([
 ['Caut un cumpărător.', 'contacts'],
 ['Câte sarcini sunt de făcut?', 'calendar'],
 ['Verifică mesajele WhatsApp.', 'communications'],
 ['Caută proprietăți în Titan.', 'properties'],
 ['Verifică dosarele de vânzări.', 'sales'],
 ['Consultă prospectele.', 'prospecting'],
])('prioritizes a new domain after Facebook: %s',async(prompt,domain)=>{
 vi.stubEnv('JARVIS_JEV_MODE','off');const respond=vi.fn(async (_request:import('../provider').ProviderRequest)=>final);
 const result=await planTurn(ctx,prompt,[{id:'previous',role:'assistant',text:'Am terminat cererea de publicare Facebook pentru Cișmigiu.',createdAt:new Date().toISOString()}],{provider:{id:'fixture',respond}});
 expect(result.metrics.capabilityRouting?.loaded).toContain(domain);
 expect(result.metrics.capabilityRouting?.loaded).not.toContain('marketing');
 expect(respond.mock.calls[0][0].tools.map(t=>t.name)).toContain('query_records');
 expect(JSON.stringify(respond.mock.calls[0][0].input)).toContain('Cișmigiu');
});
it('keeps prior context available for a referential follow-up without rerunning old actions',async()=>{
 vi.stubEnv('JARVIS_JEV_MODE','off');const respond=vi.fn(async (_request:import('../provider').ProviderRequest)=>final);
 const result=await planTurn(ctx,'Și pentru aceeași proprietate?', [{id:'old',role:'assistant',text:'Proprietatea Cișmigiu',createdAt:new Date().toISOString(),cards:[{type:'data',source:'properties',title:'Proprietate',rows:[{id:'p',title:'Cișmigiu'}]}]}],{provider:{id:'fixture',respond}});
 expect(JSON.stringify(respond.mock.calls[0][0].input)).toContain('Cișmigiu');expect(result.actions).toEqual([]);expect(respond.mock.calls[0][0].tools.map(t=>t.name)).toContain('conversation_history');
});

it.each(['off','shadow','active'])('reads complete distribution workflows through the real dispatcher in %s mode', async mode => {
 vi.stubEnv('JARVIS_JEV_MODE', mode);
 const catalogCall=call('workflow_catalog',{ids:['tiktok_organic','matched_buyers_whatsapp']});
 const respond=vi.fn().mockResolvedValueOnce(catalogCall).mockResolvedValueOnce(call('goal_coverage',{requirements:[{id:'explain',sourceQuote:'Explică pașii pentru TikTok și WhatsApp, fără să publici.',description:'Explicarea fluxurilor fără execuție',resolution:'answered',steps:[],evidenceCallIds:[catalogCall.calls[0].id]}]})).mockResolvedValue(final);
 const result=await planTurn(ctx,'Explică pașii pentru TikTok și WhatsApp, fără să publici.',[],{provider:{id:'fixture',respond},jevSelector:{select:async()=>chosen(['marketing','communications'])}});
 expect(result.metrics.status,result.text).toBe('success');
 expect(JSON.stringify(respond.mock.calls[1][0].input)).toContain('recommend_properties');
 expect(JSON.stringify(respond.mock.calls[1][0].input)).toContain('video_job');
 expect(result.actions).toHaveLength(0);
 expect(executeAction).not.toHaveBeenCalled();
});
