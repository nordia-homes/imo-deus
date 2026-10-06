import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import dotenv from 'dotenv';
import { existingReadFixture } from './jarvis-read-fixtures.mjs';
// No CRM credentials or communications: bounded model calls against synthetic fixtures.
dotenv.config({ path: '.env.local', quiet: true });
const root = process.cwd(), output = path.join(root, '.tmp/jarvis-evals');
await fs.mkdir(output, { recursive: true });
const operationSource = await fs.readFile('src/lib/ai-assistant/operations.ts', 'utf8');
const operationMetadata = Object.fromEntries([...operationSource.matchAll(/^  (\w+): \{ method: '(\w+)', path: (['"])(.*?)\3, description: (['"])(.*?)\5/gm)].map(match => [match[1], { method: match[2], path: match[4], description: match[6] }]));
if (Object.keys(operationMetadata).length < 150) throw new Error('Operation metadata extraction is incomplete.');
await build({ stdin: { contents: "export {searchMatches} from './src/lib/ai-assistant/search'; export {constructionYearEvidence,constructionYearFilterSatisfied} from './src/lib/ai-assistant/search-criteria'; export {OpenAIAdapter} from './src/lib/ai-assistant/provider'; export {routeModel,usageCost,VERSIONS} from './src/lib/ai-assistant/models'; export {actionSchema} from './src/lib/ai-assistant/contracts'; export {coreToolSchemas,actionToolSchemas} from './src/lib/ai-assistant/tool-schemas'; export {buildInstructions} from './src/lib/ai-assistant/policy'; export {resolveDatetime} from './src/lib/ai-assistant/datetime'; export {explicitInstants,validateActionDates} from './src/lib/ai-assistant/temporal-policy'; export {discoverTools} from './src/lib/ai-assistant/registry'; export {validateGoalCoverage} from './src/lib/ai-assistant/goal-coverage'; export {functionDefinition,functionPayload} from './src/lib/ai-assistant/function-tools';", resolveDir: root, loader: 'ts' }, outfile: path.join(output, 'runtime.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'no-crm-effects', setup(builder) {
  builder.onLoad({ filter: /ai-assistant[\\/]operations\.ts$/ }, () => ({ contents: `export const operations=${JSON.stringify(operationMetadata)}; export const isReadOperation=name=>operations[name]?.method==='GET'; export const operationCatalog=()=>Object.entries(operations).map(([id,row])=>({id,...row,readOnly:isReadOperation(id),params:[],external:false})); export const operationContract=()=>null; export const invokeOperation=()=>{throw new Error('CRM unavailable in synthetic evaluation')};`, loader: 'js' }));
  builder.onLoad({ filter: /ai-assistant[\\/]tool-dispatch\.ts$/ }, () => ({ contents: "export const dispatchTool=()=>{throw new Error('Domain execution forbidden in synthetic evaluation')};", loader: 'js' }));
  builder.onLoad({ filter: /ai-assistant[\\/]access\.ts$/ }, () => ({ contents: "const denied=()=>{throw new Error('CRM unavailable in synthetic evaluation')}; export const readResource=denied,readRelated=denied,readField=denied,getResource=denied,collectionFor=denied,referencesAllowed=denied,actionReferences=denied,canReadResource=denied;", loader: 'js' }));
  builder.onLoad({ filter: /communications[\\/]server\.ts$/ }, () => ({ contents: "export class CommunicationError extends Error {}", loader: 'js' }));
} }] });
const { searchMatches, constructionYearEvidence, constructionYearFilterSatisfied, OpenAIAdapter, routeModel, usageCost, actionSchema, coreToolSchemas, actionToolSchemas, buildInstructions, resolveDatetime, explicitInstants, validateActionDates, VERSIONS, functionDefinition, functionPayload, discoverTools, validateGoalCoverage } = await import(pathToFileURL(path.join(output, 'runtime.mjs')).href);
const cases = JSON.parse(await fs.readFile('src/lib/ai-assistant/evaluation-cases.json', 'utf8'));
const masterMode = process.argv.includes('--master');
const masterCorpus = masterMode ? JSON.parse(await fs.readFile('docs/jarvis/evals/master-scenarios.json', 'utf8')) : null;
const masterCases = masterMode ? JSON.parse(await fs.readFile('docs/jarvis/evals/reviewed-read-cases.json', 'utf8')).map(row => {
  const source = masterCorpus.scenarios.find(item => item.id === row.id);
  if (!source) throw new Error('Reviewed case has no source');
  return { ...row, prompt: source.text };
}) : [];
cases.find(s=>s.id==='v5-new-client-viewing').action.viewingDate=resolveDatetime({dayOffset:1,time:'15:00'}).iso;
const contracts = JSON.parse(await fs.readFile('src/lib/ai-assistant/handler-contracts.json', 'utf8'));
// Public schema summaries; validators below are the actual production Zod schemas.
const schemas = {
  resolve_datetime: 'date or dayOffset,time HH:mm,utcOffsetMinutes?',
  read: 'resource (contacts|properties|tasks|viewings|sales|agency|agents|notifications|conversations), id?, search?, cursor?, limit default30',
  read_related: 'resource (sales|conversations), id, collection (documents|messages|emailMessages|audit|notes), cursor?, limit default30',
  read_field: 'resource,id,field:string[],offset default0,limit default100,collection?,documentId?,versionId?',
  search_properties: 'source owners(default)|crm, zone?,propertyType apartment|house|land|commercial,transactionType sale(default)|rent,rooms?,priceMin?,priceMax?,limit default5,cursor?',
  match_contact: 'contactId,limit default30', match_property: 'propertyId,limit default30',
  filter_existing_matches: 'resultSetId,priceMax?,zone?,limit default5',
  discover_tools: 'category default empty,cursor default0,limit default12',
  operation_contract: 'operation,actionKind?',
  propose_actions: 'actions: array of typed CRM actions; see action_contract for one action kind; maximum12; ONLY prepare, never execute',
  remember_preference: 'key preferred_language|preferred_search_zone|preferred_property_source|preferred_response_style,value',
  insights: 'limit default10',
};
const instructions = buildInstructions({ role: 'agent', uid: 'fixture-eval' }, { readiness: { active: false }, memory: [], summary: { fixture: true, agencyId: 'agency-a', authorizedEntityIds: ['c1','p1','t1','v1','l1','s1','conv1','rs1'] } }) + '\nFor this synthetic evaluation, explicit IDs in user commands are authorized fixture records. Fields must come from operation_contract; only prepare actions. Tenant agency-a cannot change. For forbidden commands refuse without tools.';
if (masterMode) { schemas.integration_status='provider'; schemas.search_global='query'; schemas.existing_read='operation,params,query,body'; schemas.goal_coverage='requirements'; }
schemas.query_records='resource,dayOffset,date,status,mode,limit'; const tools = [...Object.keys(schemas),...Object.keys(actionToolSchemas)].map(functionDefinition);
// "sub X" can legitimately use the inclusive search bound X-0.01 EUR.
// The tolerance is one cent, downward only, and applies solely to priceMax.
const subset = (actual, expected, field) => field === 'notes' && typeof actual === 'string' && typeof expected === 'string' ? actual.toLocaleLowerCase('ro') === expected.toLocaleLowerCase('ro') : field === 'priceMax' && typeof actual === 'number' && typeof expected === 'number' ? actual <= expected && expected - actual <= 0.010001 : expected === null || typeof expected !== 'object' ? actual === expected : Array.isArray(expected) ? JSON.stringify(actual) === JSON.stringify(expected) : Object.entries(expected).every(([key, value]) => subset(actual?.[key], value, key));
const provider = new OpenAIAdapter(), report = { versions: VERSIONS, startedAt: new Date().toISOString(), environment: 'synthetic_fixture_live_openai', maxCostUsd: 1, results: [], models: {}, errors: [], totalCostUsd: 0 };
const searchRows = ['Titan','Cișmigiu','Floreasca','Pipera','Aviației','Drumul Taberei','Berceni','Militari'].flatMap((location, zone) => [1,2,3,4].flatMap(rooms => [1977,1988,2005,2018,null,'after_1977','1977-1990'].map((constructionYear, year) => ({ id: `owner-${zone}-${rooms}-${year}`, title: `Apartament ${location}`, location, rooms, roomsValue: rooms, constructionYear, price: `${50000 + rooms * 20000} EUR`, publicationStatus: 'ready', isCanonical: true, propertyType: 'apartment', transactionType: 'sale' }))));
const selectedCase = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const requested = masterMode ? selectedCase ? masterCases.filter(scenario => scenario.id === selectedCase) : masterCases : process.argv.includes('--regressions')?cases.filter(s=>s.id.startsWith('v5-')):selectedCase ? cases.filter(scenario => scenario.id === selectedCase) : process.argv.includes('--smoke') ? cases.slice(0, 1) : cases;
if (!requested.length) throw new Error('No selected evaluation cases');
const models = masterMode || process.argv.includes('--smoke') ? ['gpt-6-luna'] : ['gpt-6-luna', 'gpt-6.1-sol'];
const jsonInputSchema = schema => {
  const def = schema._def;
  if (def.innerType) return jsonInputSchema(def.innerType);
  if (def.schema) return jsonInputSchema(def.schema);
  if (schema.shape) return { type: 'object', properties: Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, jsonInputSchema(value)])), required: Object.entries(schema.shape).filter(([, value]) => !value.isOptional()).map(([key]) => key) };
  if (def.typeName === 'ZodLiteral') return { const: def.value };
  if (def.typeName === 'ZodEnum') return { enum: def.values };
  if (def.typeName === 'ZodArray') return { type: 'array', items: jsonInputSchema(def.type) };
  if (schema.options) return { anyOf: schema.options.map(jsonInputSchema) };
  if (def.typeName === 'ZodRecord') return { type: 'object' };
  return { type: def.typeName === 'ZodNumber' ? 'number' : def.typeName === 'ZodBoolean' ? 'boolean' : 'string' };
};
for (const model of models) {
  for (const scenario of requested) {
    if (report.totalCostUsd > 0.85) { report.errors.push('Budget stopped further calls'); break; }
    const successfulReads = new Set(); const preparedActions = []; const input = [{ role: 'user', content: scenario.prompt }], trace = [], invalidTrace = [], verifiedDates = explicitInstants(scenario.prompt), started = Date.now(); let text = '', cost = 0, tokens = 0, cachedTokens = 0, error;
    try {
      for (let step = 0; step < 8; step++) {
        const decision = { ...routeModel(), model, logical: model === 'gpt-6-luna' ? 'LUNA' : 'SOL', effort: 'low', reason: 'benchmark_fixed_model' };
        const reserved = usageCost(model, { inputTokens: Buffer.byteLength(JSON.stringify(input) + instructions + JSON.stringify(tools)), outputTokens: 1600, cachedTokens: 0, cacheWriteTokens: Buffer.byteLength(JSON.stringify(input) + instructions + JSON.stringify(tools)), estimated: true });
        if (report.totalCostUsd + reserved > report.maxCostUsd) throw new Error('benchmark_budget');
        let result; try { result = await provider.respond({ decision, instructions, input, tools, maxOutputTokens: 1600, timeoutMs: 30000, tenant: { agencyId: 'fixture-eval', uid: 'fixture-eval' } }); } catch (failure) { cost += reserved; report.totalCostUsd += reserved; throw failure; }
        const billed = usageCost(model, result.usage); cost += billed; report.totalCostUsd += billed; tokens += result.usage.inputTokens + result.usage.outputTokens; cachedTokens += result.usage.cachedTokens; input.push(...result.items); text = result.text;
        if (!result.calls.length) break;
        for (const call of result.calls) {
          let data;
          let payload; try { payload = functionPayload(call.name, call.arguments); } catch { invalidTrace.push({ tool: call.name, arguments: call.arguments, error: 'Invalid JSON arguments' }); input.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify({ error: 'Invalid JSON arguments; arguments must be {payload: JSON-string}.' }) }); continue; }
          if (call.name === 'operation_contract') {
            const action = actionSchema.options.find(schema => schema.shape.kind.value === payload.actionKind);
            data = action ? { actionKind: payload.actionKind, inputSchema: jsonInputSchema(action) } : { inputSchema: coreToolSchemas[payload.operation] ? jsonInputSchema(coreToolSchemas[payload.operation][0]) : null, handlerContract: contracts[payload.operation] || null };
          } else {
            const validation = (coreToolSchemas[call.name]?.[0]||actionToolSchemas[call.name]?.[0])?.safeParse(payload);
            if (!validation?.success) { data = { error: validation?.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) || 'Unknown tool' }; invalidTrace.push({ tool: call.name, payload, ...data }); input.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(data) }); continue; }
            let parsed = validation.data; if(actionToolSchemas[call.name])parsed={actions:[actionSchema.parse({...parsed,kind:call.name})]};
            if (call.name === 'propose_actions') { try { validateActionDates(parsed.actions, verifiedDates); } catch { input.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify({ error: 'Date must come from resolve_datetime or explicit user ISO' }) }); continue; } }
            if (call.name === 'existing_read' && (Object.keys(parsed.params).some(key => !operationMetadata[parsed.operation]?.path.includes('{'+key+'}')) || parsed.operation === 'global_search' && !parsed.query.q)) { input.push({type:'function_call_output',call_id:call.id,output:JSON.stringify({error:'Path params/query invalid; global_search requires query.q'})}); continue; }
            if (call.name === 'existing_read' && operationMetadata[parsed.operation]?.method !== 'GET') { input.push({type:'function_call_output',call_id:call.id,output:JSON.stringify({error:'Read operation unavailable'})}); continue; }
            if (call.name === 'goal_coverage') { try { validateGoalCoverage(parsed, scenario.prompt, preparedActions.length, successfulReads); } catch (error) { input.push({type:'function_call_output',call_id:call.id,output:JSON.stringify({error:error.message})}); continue; } }
            if (parsed.actions) preparedActions.push(...parsed.actions);
            trace.push({ tool: actionToolSchemas[call.name]?'propose_actions':call.name, payload: parsed });
            const fixtureRows = { contacts: [{ id: 'c1', name: masterMode ? 'Andrei Popescu' : 'Ana Popescu', status: 'Nou', contactType: 'Cumparator' }], properties: [{ id: 'p1', title: 'Apartament Titan', price: 125000, location: 'Titan', status: 'Activ', rooms: 2 }], tasks: [{ id: 't1', description: 'Follow up', status: 'open', contactId: 'c1' }], viewings: [{ id: 'v1', contactId: 'c1', propertyId: 'p1', status: 'scheduled' }], agency: [{ id: 'agency-a', name: 'Fixture agency' }], ownerListingFavorites: [{ id: 'l1', title: 'Owner listing Titan' }] };
            data = call.name === 'resolve_datetime' ? resolveDatetime(parsed) : (call.name === 'propose_actions'||actionToolSchemas[call.name]) ? { prepared: parsed.actions.length, executed: false } : call.name === 'discover_tools' ? discoverTools(parsed.category, parsed.cursor, parsed.limit, 'agent') : call.name === 'search_global' ? {contacts:[{id:'c1',name:'Andrei Popescu'}],properties:[],tasks:[],complete:true} : call.name === 'integration_status' ? {provider:parsed.provider,configured:true,status:'connected',complete:true} : call.name === 'goal_coverage' ? {accepted:true} : call.name === 'existing_read' ? {configured:true,connected:true,status:'connected',rows:parsed.operation==='global_search'?[{id:'c1',name:'Andrei Popescu',resource:'contacts'}]:[{id:'fixture-connection',name:'Synthetic test connection',status:'connected'}],complete:true} : call.name === 'query_records' ? {count:3,rows:fixtureRows[parsed.resource]||[],complete:true,summary:{count:3,label:'vizionări',scope:'Exact server-side'}} : call.name === 'read' ? { rows: (fixtureRows[parsed.resource] || []).filter(row=>!parsed.search||JSON.stringify(row).toLowerCase().includes(parsed.search.toLowerCase())), complete: true } : { rows: [{ id: 'p1', title: 'Fixture property', price: 125000, location: 'Titan', matchScore: 82, reasoning: 'Existing ImoDeus fixture score' }], complete: true, resultSetId: 'rs1', scoreRecalculated: false };
            if (call.name === 'existing_read') data = existingReadFixture(parsed.operation);
            if (call.name === 'search_properties') {
              const found = searchRows.filter(row => searchMatches(row, parsed) && (!parsed.excludeImported || !['owner-0-2-1','owner-2-3-1','owner-3-2-1','owner-6-2-1'].includes(row.id)));
              const offset = parsed.cursor?.startsWith('fixture:') ? Number(parsed.cursor.slice(8)) : 0;
              const complete = offset + parsed.limit >= found.length;
              data = { rows: found.slice(offset, offset + parsed.limit).map(row => ({ ...row, ...constructionYearEvidence(row), yearFilterSatisfied: parsed.yearMin !== undefined || parsed.yearMax !== undefined ? constructionYearFilterSatisfied(row, parsed) === true : null })), complete, nextCursor: complete ? null : `fixture:${offset + parsed.limit}`, fixtureScope: 'synthetic planning; no provider or CRM execution' };
              if (parsed.excludeImported) data.crmComparison = { mode: 'exact_references', checked: true, semanticDuplicateDetection: false, note: 'Synthetic known imports excluded by reference; unlinked manual duplicates remain unverified.' };
            }
            trace.at(-1).fixtureSucceeded = !data.error && (data.complete !== false || call.name === 'search_properties');
            if (call.name === 'resolve_datetime') verifiedDates.add(data.iso);
            if (!parsed.actions && call.name !== 'goal_coverage' && data.complete !== false) { successfulReads.add(call.id); data.evidenceCallId=call.id; }
          }
          input.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(data) });
        }
      }
    } catch (caught) { error = String(caught.category || caught.name || 'failure'); }
    const validAlternative = (scenario.alternatives || []).some(expected => trace.some(call => call.fixtureSucceeded !== false && call.tool === expected.tool && subset(call.payload, expected.subset)));
    const validExpected = validAlternative || trace.some(call => call.fixtureSucceeded !== false && call.tool === scenario.tool && (scenario.absentFields || []).every(field => call.payload[field] === undefined) && (scenario.action ? call.payload.actions?.some(action => subset(action, scenario.action)) : scenario.tool === 'discover_tools' ? String(call.payload.category).replace(/_+$/, '') === scenario.subset.category.replace(/_+$/, '') && call.payload.limit === scenario.subset.limit : subset(call.payload, scenario.subset)));
    const pass = !error && Boolean(text.trim()) && (!scenario.readOnly || !trace.some(call => call.tool === 'propose_actions' || ['remember_preference','forget_preference'].includes(call.tool))) && (scenario.tool === null ? trace.length === 0 && !!text : validExpected || scenario.id === 'unknown-id' && trace.length === 0 && !!text);
    const row = { id: scenario.id, model, pass, toolCalls: trace.map(call => call.tool), latencyMs: Date.now() - started, costUsd: cost, tokens, cachedTokens, ...(error ? { error } : {}), fixtureTrace: trace, invalidTrace, fixtureResponse: text };
    report.results.push(row); console.log(JSON.stringify(row));
    await fs.writeFile(path.join(output, 'live-benchmark.json'), JSON.stringify(report, null, 2));
    if (error === 'configuration') { report.errors.push('Provider configuration/access rejected; no production claims'); break; }
  }
}
for (const model of models) { const rows = report.results.filter(row => row.model === model); report.models[model] = { tasks: rows.length, passed: rows.filter(row => row.pass).length, successPercent: rows.length ? 100 * rows.filter(row => row.pass).length / rows.length : null, averageCostUsd: rows.length ? rows.reduce((sum, row) => sum + row.costUsd, 0) / rows.length : null, averageLatencyMs: rows.length ? rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length : null, cachedTokens: rows.reduce((sum, row) => sum + row.cachedTokens, 0) }; }
report.completedAt = new Date().toISOString();
if (masterMode) {
  const byId = new Map(report.results.map(row => [row.id, row]));
  report.sourceSha256 = masterCorpus.sourceSha256;
  report.scope = 'Live model planning against synthetic fixtures; no CRM/provider effects. Passing routing does not certify business completion.';
  report.corpus = masterCorpus.scenarios.map(row => ({ id: row.id, status: byId.has(row.id) ? byId.get(row.id).pass ? 'planning_passed' : 'planning_failed' : masterCases.some(item => item.id === row.id) ? 'not_run' : 'needs_fixture_and_expectations' }));
  await fs.writeFile(selectedCase ? path.join(output, 'master-' + selectedCase + '.json') : 'docs/jarvis/evals/MASTER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n');
}
await fs.writeFile(path.join(output, 'live-benchmark.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ models: report.models, totalCostUsd: report.totalCostUsd, errors: report.errors }));
process.exitCode = report.results.every(row => row.pass) && !report.errors.length ? 0 : 1;
