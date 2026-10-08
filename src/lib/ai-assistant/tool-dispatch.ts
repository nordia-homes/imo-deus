import { viewingConfirmationDraft } from './viewing-confirmation-draft';
import { viewingAttendance } from './viewing-attendance';
import { viewingRisk } from './viewing-risk';
import { todayReview } from './today-review';
import { hasViewingSelection } from './viewing-selection';
import { calendarAvailability } from './calendar-availability';
import { taskDeferral } from './task-deferral';
import { taskPriorities } from './task-priorities';
import { taskAgenda } from './task-agenda';
import { viewingFollowups } from './viewing-followups';
import { propertyViewings } from './property-viewings';
import { viewingDetails } from './viewing-details';
import { assertTaskEdit } from './task-edit';
import { shiftDatetime } from './datetime';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { VERSIONS } from './models';
import { actionSchema, type AssistantAction, type AssistantCard, type AccessReference } from './contracts';
import { readResource, readRelated, readField, type AssistantContext } from './access';
import { searchProperties } from './search';
import { annotateWatchFeedback } from './watch-feedback';
import { matchContact, matchProperty } from './actions';
import { invokeOperation, operations, isReadOperation, operationContract } from './operations';
import { discoverTools, requireTool, inputContract } from './registry';
import { rememberPreference, forgetPreference, saveResultSet, filterResultSet, preferredTimezone } from './context';
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
  if (name === 'today_review') {
    data = await todayReview(ctx, payload);
    for (const source of ['tasks', 'viewings']) cards.push({ type: 'data', title: source === 'tasks' ? 'Sarcini de verificat azi' : 'Vizionări cu rezultat de verificat', source, rows: data.rows.filter((row: Record<string, unknown>) => row.resource === source), complete: data.complete, note: data.note });
  } else if (name === 'viewing_risk') {
    data = await viewingRisk(ctx, options.selectedViewingIds || []);
    cards.push({ type: 'data', title: 'Priorități de verificare a vizionărilor', source: 'viewings', rows: data.rows, complete: data.complete, note: data.note });
  } else if (name === 'viewing_attendance') {
    data = await viewingAttendance(ctx, payload);
    cards.push({ type: 'data', title: 'Vizionări neconfirmate', source: 'viewings', rows: data.rows, complete: data.complete, note: data.definition });
  } else if (name === 'viewing_confirmation_draft') {
    data = hasViewingSelection(payload.viewingId, prompt, options.selectedViewingId)
      ? await viewingConfirmationDraft(ctx, payload)
      : { status: 'needs_clarification', complete: false, rows: [], sent: false, note: 'Cere utilizatorului să aleagă vizionarea. Nu selecta automat o vizionare din rezultatele căutării.' };
    cards.push({ type: 'data', title: 'Confirmare vizionare · mesaj netrimis', source: 'viewing_confirmation', rows: data.rows, complete: data.complete, note: data.note });
  } else if (name === 'calendar_availability') {
    data = await calendarAvailability(ctx, payload);
    cards.push({ type: 'data', title: 'Intervale libere · București', source: 'calendar', rows: data.rows.map((row: Record<string, unknown>) => ({ ...row, title: `${row.startLocal} – ${row.endLocal} · București` })), complete: data.complete, note: data.scope });
    if (payload.contactId) refs.push({ resource: 'contacts', id: payload.contactId });
  } else if (name === 'task_deferral') {
    data = await taskDeferral(ctx);
    cards.push({ type: 'data', title: 'Taskuri eligibile pentru mâine', source: 'tasks', rows: data.rows, complete: data.complete });
  } else if (name === 'task_priorities') {
    data = await taskPriorities(ctx, payload);
    cards.push({ type: 'data', title: 'Prioritățile taskurilor', source: 'tasks', rows: data.rows, complete: data.complete });
    for (const row of data.rows) if (row.contactId) refs.push({ resource: 'contacts', id: row.contactId });
  } else if (name === 'task_agenda') {
    data = await taskAgenda(ctx, payload);
    cards.push({ type: 'data', title: 'Sarcinile agentului', source: 'tasks', rows: data.rows, complete: data.complete });
  } else if (name === 'viewing_followups') {
    data = await viewingFollowups(ctx, payload);
    cards.push({ type: 'data', title: 'Vizionări fără sarcină follow-up', source: 'viewings', rows: data.rows, complete: data.complete });
    for (const row of data.rows) refs.push({ resource: 'contacts', id: row.contactId });
  } else if (name === 'property_viewings') {
    data = await propertyViewings(ctx, payload);
    cards.push({ type: 'data', title: 'Istoric vizionări proprietate', source: 'viewings', rows: data.rows, complete: data.complete });
    for (const id of data.contactIds) refs.push({ resource: 'contacts', id });
  } else if (name === 'viewing_details') {
    data = await viewingDetails(ctx, payload);
    cards.push({ type: 'data', title: 'Detalii vizionare', source: 'viewings', rows: data.rows, complete: data.complete });
    if (data.contactId) refs.push({ resource: 'contacts', id: data.contactId });
  } else if (name === 'integration_status') {
    const operation = ({ facebook_groups: 'facebook_connections', meta_ads: 'meta_status', tiktok_ads: 'tiktok_status', tiktok_organic: 'tiktok_organic_status', imobiliare: 'imobiliare_status', storia: 'storia_status', romimo: 'romimo_status', communications: 'communications_status' } as Record<string, string>)[payload.provider];
    requireTool(operation, ctx.role || '');
    data = await invokeOperation(ctx, { operation, params: {}, query: {}, body: {} }, true);
    cards.push(...operationCards(operation, `Conexiune ${payload.provider}`, data));
  }
  else if (name === 'search_global') {
    requireTool('global_search', ctx.role || '');
    data = await invokeOperation(ctx, { operation: 'global_search', params: {}, query: { q: payload.query }, body: {} }, true);
    data.complete = ['contacts', 'properties', 'tasks'].every(source => Array.isArray(data[source]) && data[source].length < 5);
    data.note = 'Căutarea globală afișează maximum cinci rezultate din fiecare categorie. Pentru toate rezultatele folosește citirea paginată a categoriei.';
    for (const source of ['contacts', 'properties', 'tasks']) if (Array.isArray(data[source])) cards.push({ type: 'results', title: 'Căutare globală · ' + source, source, rows: data[source], complete: data[source].length < 5, note: data.note });
  }
  else if (name === 'resolve_matching_recipient') {
    const { resolveMatchingRecipient } = await import('./matching-recipient');
    data = await resolveMatchingRecipient(ctx, options.summary, payload);
    refs.push({ resource: 'contacts', id: data.contactId }, ...data.conversations.map((row: any) => ({ resource: 'conversations' as const, id: row.id })));
    cards.push({ type: 'results', title: 'Proprietatea selectată pentru client', source: 'crm', rows: data.rows, resultSetId: data.resultSetId, note: data.note, complete: true });
    cards.push({ type: 'data', title: 'Conversații pentru client', source: 'conversations', rows: data.conversations, note: data.note, complete: data.recipientSearchComplete });
  }
  else if (name === 'select_context') {
    const { selectContext } = await import('./context-selection'); data = await selectContext(ctx, options.summary, payload);
    if (data.resource !== 'owners') refs.push(...data.rows.map((row: any) => ({ resource: data.resource, id: row.id })));
    if (typeof data.contactId === 'string') refs.push({ resource: 'contacts', id: data.contactId });
    cards.push({ type: 'results', title: 'Selecția din lista anterioară', source: data.resource, ...data } as AssistantCard);
  }
  else if (name === 'goal_coverage') data = { received: true }; // Validated against this turn by the planner.
  else if (name === 'knowledge_search') {
    const { searchPlaybooks } = await import('./knowledge'); data = searchPlaybooks(payload.query, payload.limit);
  } else if (name === 'legal_source_search') {
    const { searchOfficialSources } = await import('./legal-source'); data = await searchOfficialSources(ctx, payload.query, payload.cursor);
  } else if (name === 'legal_source_read') {
    const { readOfficialSource } = await import('./legal-source'); data = await readOfficialSource(ctx, payload.url, payload.offset, payload.snapshotId);
    cards.push({ type: 'data', title: 'Sursă oficială consultată', source: 'legal', rows: [{ sourceUrl: data.sourceUrl, authority: data.authority, retrievedAt: data.retrievedAt, contentHash: data.contentHash, temporalValidityVerified: false }], note: data.note });
  } else if (name === 'data_catalog') data = dataCatalog(payload.category);
  else if (name === 'capability_status') data = await capabilityStatus(ctx, payload.operation);
  else if (name === 'timeline') {
    const { readTimeline } = await import('./timeline'); data = await readTimeline(ctx, payload);
    cards.push({ type: 'data', title: 'Istoric CRM verificat', source: 'timeline', timeline: payload, ...data } as AssistantCard);
    refs.push({ resource: payload.resource, id: payload.id });
  } else if (name === 'shift_datetime') data = shiftDatetime(payload);
  else if (name === 'resolve_datetime') data = resolveDatetime({ ...payload, timezone: payload.timezone || await preferredTimezone(ctx) });
  else if (name === 'query_records') {
    data = await queryRecords(ctx, payload); cards.push({ type: 'data', title: ({viewings:'Agenda vizionărilor',tasks:'Sarcinile tale',contacts:'Clienți',properties:'Portofoliu CRM',sales:'Dosare Sales'} as Record<string,string>)[payload.resource], source: payload.resource, query: payload, ...data } as AssistantCard);
    if (payload.resource === 'sales') refs.push(...data.rows.map((row: any) => ({ resource: 'sales' as const, id: row.id })));
  }
  else if (name === 'analyze_records') {
    data = await analyzeRecords(ctx, payload); cards.push({ type: 'data', outputType: 'ANALYTICS_CARD', title: 'Analiză deterministă', source: payload.resource, ...data } as AssistantCard);
    if (['sales', 'conversations', 'socialPosts', 'salesTemplateAudit', 'assistantAutomations'].includes(payload.resource)) refs.push(...payload.ids.map((id: string) => ({ resource: payload.resource, id })));
  } else if (name === 'read' || name === 'read_related' || name === 'read_field') {
    data = name === 'read' ? await readResource(ctx, payload) : name === 'read_related' ? await readRelated(ctx, payload) : await readField(ctx, payload);
    if (['sales', 'conversations', 'socialPosts', 'salesTemplateAudit', 'assistantAutomations'].includes(payload.resource)) refs.push(...(payload.id ? [{ resource: payload.resource, id: payload.id }] : (data.rows || []).map((row: any) => ({ resource: payload.resource, id: row.id }))));
    if (Array.isArray(data.rows)) cards.push({ type: 'data', title: payload.collection || payload.resource, source: payload.resource, ...data, rows: await decorateRecords(ctx, payload.resource, data.rows.slice(0, 20)) } as AssistantCard);
  } else if (name === 'search_properties') {
    data = await searchProperties(ctx, payload);
    if (payload.source === 'owners') data.rows = await annotateWatchFeedback(ctx, data.rows);
    cards.push({ type: 'results', title: payload.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', source: payload.source, search: payload, ...data } as AssistantCard);
  } else if (name === 'match_contact' || name === 'match_property') {
    const rows = name === 'match_contact' ? await annotateWatchFeedback(ctx, await matchContact(ctx, payload.contactId, payload.limit), payload.contactId) : await matchProperty(ctx, payload.propertyId, payload.limit);
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
    payload.actions.forEach(assertTaskEdit);
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
    for (const row of data.rows) {
      if (row.saleId) refs.push({ resource: 'sales', id: row.saleId });
      if (row.conversationId) refs.push({ resource: 'conversations', id: row.conversationId });
    }
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
