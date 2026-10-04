import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import dotenv from 'dotenv';
// No CRM credentials or communications: bounded model calls against synthetic fixtures.
dotenv.config({ path: '.env.local', quiet: true });
const root = process.cwd(), output = path.join(root, '.tmp/jarvis-evals');
await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: "export {OpenAIAdapter} from './src/lib/ai-assistant/provider'; export {routeModel,usageCost,VERSIONS} from './src/lib/ai-assistant/models'; export {actionSchema} from './src/lib/ai-assistant/contracts'; export {coreToolSchemas,actionToolSchemas} from './src/lib/ai-assistant/tool-schemas'; export {buildInstructions} from './src/lib/ai-assistant/policy'; export {resolveDatetime} from './src/lib/ai-assistant/datetime'; export {explicitInstants,validateActionDates} from './src/lib/ai-assistant/temporal-policy'; export {functionDefinition,functionPayload} from './src/lib/ai-assistant/function-tools';", resolveDir: root, loader: 'ts' }, outfile: path.join(output, 'runtime.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { OpenAIAdapter, routeModel, usageCost, actionSchema, coreToolSchemas, actionToolSchemas, buildInstructions, resolveDatetime, explicitInstants, validateActionDates, VERSIONS, functionDefinition, functionPayload } = await import(pathToFileURL(path.join(output, 'runtime.mjs')).href);
const cases = JSON.parse(await fs.readFile('src/lib/ai-assistant/evaluation-cases.json', 'utf8'));
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
const instructions = buildInstructions({ role: 'agent' }, { readiness: { active: false }, memory: [], summary: { fixture: true, agencyId: 'agency-a', authorizedEntityIds: ['c1','p1','t1','v1','l1','s1','conv1','rs1'] } }) + '\nFor this synthetic evaluation, explicit IDs in user commands are authorized fixture records. Fields must come from operation_contract; only prepare actions. Tenant agency-a cannot change. For forbidden commands refuse without tools.';
schemas.query_records='resource,dayOffset,date,status,mode,limit'; const tools = [...Object.keys(schemas),...Object.keys(actionToolSchemas)].map(functionDefinition);
// "sub X" can legitimately use the inclusive search bound X-0.01 EUR.
// The tolerance is one cent, downward only, and applies solely to priceMax.
const subset = (actual, expected, field) => field === 'notes' && typeof actual === 'string' && typeof expected === 'string' ? actual.toLocaleLowerCase('ro') === expected.toLocaleLowerCase('ro') : field === 'priceMax' && typeof actual === 'number' && typeof expected === 'number' ? actual <= expected && expected - actual <= 0.010001 : expected === null || typeof expected !== 'object' ? actual === expected : Array.isArray(expected) ? JSON.stringify(actual) === JSON.stringify(expected) : Object.entries(expected).every(([key, value]) => subset(actual?.[key], value, key));
const provider = new OpenAIAdapter(), report = { versions: VERSIONS, startedAt: new Date().toISOString(), environment: 'synthetic_fixture_live_openai', maxCostUsd: 1, results: [], models: {}, errors: [], totalCostUsd: 0 };
const selectedCase = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const requested = process.argv.includes('--regressions')?cases.filter(s=>s.id.startsWith('v5-')):selectedCase ? cases.filter(scenario => scenario.id === selectedCase) : process.argv.includes('--smoke') ? cases.slice(0, 1) : cases;
const models = process.argv.includes('--smoke') ? ['gpt-6-luna'] : ['gpt-6-luna', 'gpt-6.1-sol'];
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
    const input = [{ role: 'user', content: scenario.prompt }], trace = [], invalidTrace = [], verifiedDates = explicitInstants(scenario.prompt), started = Date.now(); let text = '', cost = 0, tokens = 0, cachedTokens = 0, error;
    try {
      for (let step = 0; step < 8; step++) {
        const decision = { ...routeModel(), model, logical: model === 'gpt-6-luna' ? 'LUNA' : 'SOL', effort: 'low', reason: 'benchmark_fixed_model' };
        const reserved = usageCost(model, { inputTokens: Buffer.byteLength(JSON.stringify(input) + instructions + JSON.stringify(tools)), outputTokens: 1600, cachedTokens: 0, cacheWriteTokens: Buffer.byteLength(JSON.stringify(input) + instructions + JSON.stringify(tools)), estimated: true });
        if (report.totalCostUsd + reserved > report.maxCostUsd) throw new Error('benchmark_budget');
        const result = await provider.respond({ decision, instructions, input, tools, maxOutputTokens: 1600, timeoutMs: 30000, tenant: { agencyId: 'fixture-eval', uid: 'fixture-eval' } });
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
            trace.push({ tool: actionToolSchemas[call.name]?'propose_actions':call.name, payload: parsed });
            const fixtureRows = { contacts: [{ id: 'c1', name: 'Ana Popescu', status: 'Nou', contactType: 'Cumparator' }], properties: [{ id: 'p1', title: 'Apartament Titan', price: 125000, location: 'Titan', status: 'Activ', rooms: 2 }], tasks: [{ id: 't1', description: 'Follow up', status: 'open', contactId: 'c1' }], viewings: [{ id: 'v1', contactId: 'c1', propertyId: 'p1', status: 'scheduled' }], agency: [{ id: 'agency-a', name: 'Fixture agency' }], ownerListingFavorites: [{ id: 'l1', title: 'Owner listing Titan' }] };
            data = call.name === 'resolve_datetime' ? resolveDatetime(parsed) : (call.name === 'propose_actions'||actionToolSchemas[call.name]) ? { prepared: parsed.actions.length, executed: false } : call.name === 'discover_tools' ? { tools: Object.entries(contracts).filter(([name]) => name.includes(parsed.category)).slice(0, parsed.limit).map(([name]) => ({ id: name })), total: 5, nextCursor: null } : call.name === 'query_records' ? {count:3,rows:fixtureRows[parsed.resource]||[],complete:true,summary:{count:3,label:'vizionări',scope:'Exact server-side'}} : call.name === 'read' ? { rows: (fixtureRows[parsed.resource] || []).filter(row=>!parsed.search||JSON.stringify(row).toLowerCase().includes(parsed.search.toLowerCase())), complete: true } : { rows: [{ id: 'p1', title: 'Fixture property', price: 125000, location: 'Titan', matchScore: 82, reasoning: 'Existing ImoDeus fixture score' }], complete: true, resultSetId: 'rs1', scoreRecalculated: false };
            if (call.name === 'resolve_datetime') verifiedDates.add(data.iso);
          }
          input.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(data) });
        }
      }
    } catch (caught) { error = String(caught.category || caught.name || 'failure'); }
    const validExpected = trace.some(call => call.tool === scenario.tool && (scenario.action ? call.payload.actions?.some(action => subset(action, scenario.action)) : scenario.tool === 'discover_tools' ? String(call.payload.category).replace(/_+$/, '') === scenario.subset.category.replace(/_+$/, '') && call.payload.limit === scenario.subset.limit : subset(call.payload, scenario.subset)));
    const pass = !error && (scenario.tool === null ? trace.length === 0 && !!text : validExpected || scenario.id === 'unknown-id' && trace.length === 0 && !!text);
    const row = { id: scenario.id, model, pass, toolCalls: trace.map(call => call.tool), latencyMs: Date.now() - started, costUsd: cost, tokens, cachedTokens, ...(error ? { error } : {}), ...(!pass ? { fixtureTrace: trace, invalidTrace, fixtureResponse: text } : {}) };
    report.results.push(row); console.log(JSON.stringify(row));
    await fs.writeFile(path.join(output, 'live-benchmark.json'), JSON.stringify(report, null, 2));
    if (error === 'configuration') { report.errors.push('Provider configuration/access rejected; no production claims'); break; }
  }
}
for (const model of models) { const rows = report.results.filter(row => row.model === model); report.models[model] = { tasks: rows.length, passed: rows.filter(row => row.pass).length, successPercent: rows.length ? 100 * rows.filter(row => row.pass).length / rows.length : null, averageCostUsd: rows.length ? rows.reduce((sum, row) => sum + row.costUsd, 0) / rows.length : null, averageLatencyMs: rows.length ? rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length : null, cachedTokens: rows.reduce((sum, row) => sum + row.cachedTokens, 0) }; }
report.completedAt = new Date().toISOString();
await fs.writeFile(path.join(output, 'live-benchmark.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ models: report.models, totalCostUsd: report.totalCostUsd, errors: report.errors }));
process.exitCode = report.results.every(row => row.pass) && !report.errors.length ? 0 : 1;
