import { z } from 'zod';
import { createHash } from 'node:crypto';
import { VERSIONS } from './models';
import { actionSchema, type AssistantAction, type AssistantCard, type AccessReference } from './contracts';
import { readResource, readRelated, readField, type AssistantContext } from './access';
import { searchProperties } from './search';
import { matchContact, matchProperty } from './actions';
import { invokeOperation, operations, isReadOperation, operationContract } from './operations';
import { discoverTools, requireTool, inputContract } from './registry';
import { rememberPreference, forgetPreference, saveResultSet, filterResultSet } from './context';
import { getInsights } from './insights';
import type { AgentOptions } from './planner';
import { analyzeRecords, resolveDatetime } from './deterministic';
import { validateActionDates } from './temporal-policy';
import { bindCalendarRevisions } from './calendar-revisions';
import { bindAgencyRevisions } from './agency-revisions';
import { bindBusinessRevisions } from './business-revisions';
import { queryRecords, decorateRecords } from './record-query';
import { operationCards } from './operation-cards';
import { dataCatalog, capabilityStatus } from './catalog';
export type ToolResult = { data: Record<string, unknown>; cards: AssistantCard[]; actions: AssistantAction[]; refs: AccessReference[]; childMetrics?: Awaited<ReturnType<typeof import('./planner').planTurn>>['metrics'] };
export async function dispatchTool(name: string, ctx: AssistantContext, payload: any, prompt: string, options: AgentOptions): Promise<ToolResult> {
  const cards: AssistantCard[] = [], actions: AssistantAction[] = [], refs: AccessReference[] = [];
  let data: Record<string, any>, childMetrics: ToolResult['childMetrics'];
  if (name === 'data_catalog') data = dataCatalog(payload.category);
  else if (name === 'capability_status') data = await capabilityStatus(ctx, payload.operation);
  else if (name === 'timeline') {
    const { readTimeline } = await import('./timeline'); data = await readTimeline(ctx, payload);
    cards.push({ type: 'data', title: 'Istoric CRM verificat', source: 'timeline', timeline: payload, ...data } as AssistantCard);
    refs.push({ resource: payload.resource, id: payload.id });
  } else if (name === 'resolve_datetime') data = resolveDatetime(payload);
  else if (name === 'query_records') {
    data = await queryRecords(ctx, payload); cards.push({ type: 'data', title: ({viewings:'Agenda vizionărilor',tasks:'Sarcinile tale',contacts:'Clienți',properties:'Portofoliu CRM'} as Record<string,string>)[payload.resource], source: payload.resource, query: payload, ...data } as AssistantCard);
  }
  else if (name === 'analyze_records') {
    data = await analyzeRecords(ctx, payload); cards.push({ type: 'data', outputType: 'ANALYTICS_CARD', title: 'Analiză deterministă', source: payload.resource, ...data } as AssistantCard);
    if (['sales', 'conversations', 'socialPosts', 'salesTemplateAudit', 'assistantAutomations'].includes(payload.resource)) refs.push(...payload.ids.map((id: string) => ({ resource: payload.resource, id })));
  } else if (name === 'read' || name === 'read_related' || name === 'read_field') {
    data = name === 'read' ? await readResource(ctx, payload) : name === 'read_related' ? await readRelated(ctx, payload) : await readField(ctx, payload);
    if (['sales', 'conversations', 'socialPosts', 'salesTemplateAudit', 'assistantAutomations'].includes(payload.resource)) refs.push(...(payload.id ? [{ resource: payload.resource, id: payload.id }] : (data.rows || []).map((row: any) => ({ resource: payload.resource, id: row.id }))));
    if (Array.isArray(data.rows)) cards.push({ type: 'data', title: payload.collection || payload.resource, source: payload.resource, ...data, rows: await decorateRecords(ctx, payload.resource, data.rows.slice(0, 20)) } as AssistantCard);
  } else if (name === 'search_properties') {
    data = await searchProperties(ctx, payload); cards.push({ type: 'results', title: payload.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', source: payload.source, search: payload, ...data } as AssistantCard);
  } else if (name === 'match_contact' || name === 'match_property') {
    const rows = name === 'match_contact' ? await matchContact(ctx, payload.contactId, payload.limit) : await matchProperty(ctx, payload.propertyId, payload.limit);
    const resultSetId = name === 'match_contact' && ctx.adminDb ? await saveResultSet(ctx, rows, payload.contactId) : undefined;
    data = { rows, ...(resultSetId ? { resultSetId } : {}), scoringSource: 'existing_imodeus_matching', scoreRecalculated: false };
    cards.push({ type: 'results', title: 'Matching CRM', source: name === 'match_contact' ? 'crm' : 'contacts', ...data } as AssistantCard);
  } else if (name === 'filter_existing_matches') {
    data = await filterResultSet(ctx, payload); cards.push({ type: 'results', title: 'Matching CRM filtrat', source: 'crm', ...data } as AssistantCard);
  } else if (name === 'discover_tools') data = discoverTools(payload.category, payload.cursor, payload.limit, ctx.role || '');
  else if (name === 'operation_contract') {
    requireTool(payload.operation, ctx.role || '');
    data = payload.actionKind || !Object.hasOwn(operations, payload.operation) ? inputContract(payload.operation, payload.actionKind) : operationContract(payload.operation) as Record<string, unknown>;
  }
  else if (name === 'existing_read') {
    requireTool(payload.operation, ctx.role || ''); data = await invokeOperation({ ...ctx, agentBudget: options.budget }, payload, true);
    cards.push(...operationCards(payload.operation, operations[payload.operation].description, data));
    if (payload.params.saleId) refs.push({ resource: 'sales', id: payload.params.saleId }); if (payload.params.conversationId) refs.push({ resource: 'conversations', id: payload.params.conversationId });
    for (const row of data.conversations || []) refs.push({ resource: 'conversations', id: row.id }); for (const row of data.results || []) if (row.conversationId) refs.push({ resource: 'conversations', id: row.conversationId });
  } else if (name === 'propose_actions') {
    validateActionDates(payload.actions, options.verifiedDates || new Set());
    for (const action of payload.actions as AssistantAction[]) if (action.kind === 'update_property_status' && action.status === 'Vândut' && !action.soldPrice) throw new Error('Cere agentului prețul real de vânzare înainte de pregătirea planului.');
    for (const action of payload.actions as AssistantAction[]) if (action.kind === 'existing_operation') { requireTool(action.operation, ctx.role || ''); if (!Object.hasOwn(operations, action.operation) || isReadOperation(action.operation)) throw new Error('Acțiune handler invalidă.'); }
    actions.push(...await bindBusinessRevisions(ctx, await bindAgencyRevisions(ctx, await bindCalendarRevisions(ctx, payload.actions)))); data = { prepared: actions.length, executed: false };
  } else if (name === 'remember_preference') {
    if (!/\b(memoreaz|retine|reține|remember)/i.test(prompt)) throw new Error('Memorarea necesită cererea explicită a agentului.');
    data = await rememberPreference(ctx, payload.key, payload.value);
  } else if (name === 'forget_preference') {
    if (!/\b(uita|uită|sterge|șterge|forget|delete)\b/i.test(prompt)) throw new Error('Ștergerea preferinței necesită cererea explicită a agentului.');
    data = await forgetPreference(ctx, payload.key);
  } else if (name === 'insights') {
    data = await getInsights(ctx, payload.limit); cards.push({ type: 'data', title: 'Insight-uri CRM', source: 'insights', ...data } as AssistantCard);
  } else if (name === 'delegate_read') {
    if (options.child) throw new Error('Delegarea recursivă este interzisă.');
    const { planTurn } = await import('./planner'); const child = await planTurn(ctx, payload.goal, [], { ...options, allowedTools: [...payload.tools, 'operation_contract'], summary: payload.resultSetId ? { resultSetId: payload.resultSetId } : undefined, child: true });
    cards.push(...child.cards); refs.push(...child.accessRefs); childMetrics = child.metrics; data = { text: child.text, status: child.metrics.status, cards: child.cards };
  } else if (name === 'parallel_read') {
    const toolMetrics: NonNullable<ToolResult['childMetrics']>['tools'] = [];
    const results = await Promise.allSettled(payload.calls.map(async (call: any) => {
      const started = Date.now(); let status = 'failed';
      try {
        options.budget?.tool(); const definition = requireTool(call.operation, ctx.role || ''); const input = definition.inputSchema.parse(call.payload);
        const result = await dispatchTool(call.operation, ctx, input, prompt, options); definition.outputSchema.parse(result.data); status = 'success'; return result;
      } finally { toolMetrics.push({ name: call.operation, status, latencyMs: Date.now() - started, version: VERSIONS.tools, argumentsHash: createHash('sha256').update(JSON.stringify(call.payload)).digest('hex') }); }
    }));
    for (const result of results) if (result.status === 'fulfilled') { cards.push(...result.value.cards); refs.push(...result.value.refs); }
    const complete = results.every(result => result.status === 'fulfilled' && result.value.data.complete !== false);
    data = { results: results.map(result => result.status === 'fulfilled' ? { status: 'success', data: result.value.data } : { status: 'failed', error: 'Citirea nu a fost confirmată.' }), complete };
    childMetrics = { models: [], tools: toolMetrics, status: complete ? 'success' : 'partial', elapsedMs: 0 };
  } else if (name === 'mcp_discover' || name === 'mcp_read') { const { mcpRequest } = await import('./mcp'); data = await mcpRequest(ctx, payload.serverId, name === 'mcp_discover' ? 'tools/list' : 'tools/call', payload.tool, payload.arguments); }
  else throw new Error('Tool necunoscut.');
  return { data, cards, actions, refs, ...(childMetrics ? { childMetrics } : {}) };
}
