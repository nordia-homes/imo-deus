import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AssistantAction, AssistantCard, AssistantMessage, AccessReference } from './contracts';
import type { AssistantContext } from './access';
import { automationReadiness } from './readiness';
import { OpenAIAdapter, ProviderError, type ModelProvider } from './provider';
import { routeModel, usageCost, VERSIONS } from './models';
import { AgentBudget, BudgetExceeded, requestReservation, type InputReservation } from './budget';
import { actionToolSchemas } from './tool-schemas';
import { requireTool, coreToolNames, toolRegistry } from './registry';
import { compressedResult, contextMessages, relevantMemory } from './context';
import { usageRecord, type UsageRecord, type AgentEvent } from './telemetry';
import { buildInstructions } from './policy';
import { explicitInstants } from './temporal-policy';
import { functionDefinition, functionPayload } from './function-tools';

export type AgentOptions = { provider?: ModelProvider; budget?: AgentBudget; progress?: (event: AgentEvent) => void | Promise<void>; allowedTools?: string[]; child?: boolean; summary?: unknown; verifiedDates?: Set<string> };
export async function planTurn(ctx: AssistantContext, prompt: string, history: AssistantMessage[], options: AgentOptions = {}) {
  const cards: AssistantCard[] = [], actions: AssistantAction[] = [], accessRefs: AccessReference[] = history.flatMap(message => message.accessRefs || []);
  const budget = options.budget || new AgentBudget(), provider = options.provider || new OpenAIAdapter();
  const verifiedDates = options.verifiedDates || explicitInstants(prompt);
  const childStarted = Date.now(), initialTokens = budget.tokens, initialCost = budget.cost;
  const metrics = { models: [] as UsageRecord[], tools: [] as { name: string; status: string; latencyMs: number; version: string; argumentsHash: string }[], status: 'pending', elapsedMs: 0 };
  const finish = (text: string, status = 'success') => {
    metrics.status = status; metrics.elapsedMs = Date.now() - childStarted;
    for (const card of cards) card.outputType ||= card.title.includes('Matching') ? 'PROPERTY_MATCH_LIST' : ['owners', 'crm', 'properties'].includes(card.source) ? 'PROPERTY_LIST' : card.source === 'contacts' ? 'CLIENT_LIST' : card.source === 'viewings' ? 'VIEWING_CARD' : card.source === 'tasks' ? 'TASK_CARD' : card.source === 'insights' ? 'INSIGHT_CARD' : /campaign|meta|tiktok/.test(card.source) ? 'CAMPAIGN_CARD' : 'ANALYTICS_CARD';
    if (actions.length && status === 'success') text = `Am pregătit ${actions.length} acțiuni. Verifică planul și confirmă execuția; acțiunile nu au fost executate.`;
    return { text, cards, actions, accessRefs, metrics };
  };
  const emit = async (stage: string, text: string) => options.progress?.({ type: 'PROGRESS_EVENT', stage, text, step: budget.steps, at: new Date().toISOString() });
  if (!process.env.OPENAI_API_KEY && !options.provider) return finish('Serviciul AI nu este configurat. Căutarea structurată rămâne disponibilă.', 'unavailable');
  const readiness = await automationReadiness(ctx);
  const instructions = buildInstructions(ctx, { readiness, memory: ctx.adminDb ? await relevantMemory(ctx) : [], allowedTools: options.allowedTools, summary: options.summary });
  const contextHint = (prompt + ' ' + history.slice(-2).map(m=>m.text).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const actionRelevant = (name: string) => !Object.hasOwn(actionToolSchemas,name) || /viewing/.test(name) && /vizionar|vizionare|calendar|program/.test(contextHint) || /contact|preferences|interaction|offer|recommend/.test(name) && /client|contact|lead|ofert|telefon|cumparator/.test(contextHint) || /property|owner/.test(name) && /propriet|apartament|casa|teren|rezerv|status|portofol|anunt/.test(contextHint) || /task/.test(name) && /sarcin|task|follow.?up/.test(contextHint) || /automation/.test(name) && /automat|recurent/.test(contextHint) || name==='assign_record' && /atribui|agent/.test(contextHint);
  const available = coreToolNames.filter(name => !options.allowedTools || options.allowedTools.includes(name)).filter(actionRelevant).filter(name => { try { requireTool(name, ctx.role || ''); return true; } catch { return false; } });
  const tools = available.map(functionDefinition);
  const input: any[] = contextMessages(history); input.push({ role: 'user', content: prompt });
  let invalidCalls = 0, previousReservation: InputReservation | undefined; const repetitions = new Map<string, number>();
  try {
    for (let turn = 0; turn < (options.child ? 3 : budget.limits.maxSteps); turn++) {
      budget.step(); await emit('planning', 'Interpretez cererea și aleg următorul pas.');
      let decision = routeModel({ invalidCalls, remainingCost: budget.limits.maxCost - budget.cost });
      const reservation = requestReservation(instructions,input,tools,previousReservation), inputBytes = reservation.tokens;
      const outputLimit = options.child ? 1200 : budget.limits.maxOutputTokens;
      budget.reserve(decision.model, inputBytes, outputLimit);
      if (options.child && (budget.tokens - initialTokens + inputBytes + outputLimit > 16000 || budget.cost - initialCost + usageCost(decision.model, { inputTokens: inputBytes, outputTokens: outputLimit, cachedTokens: 0, cacheWriteTokens: inputBytes, estimated: true }) > 0.03 || Date.now() - childStarted >= 30000)) throw new BudgetExceeded('buget subagent');
      let result;
      for (let attempt = 0; ; attempt++) {
        try { result = await provider.respond({ decision, instructions, input, tools, maxOutputTokens: outputLimit, timeoutMs: Math.max(1, Math.min(45000, budget.limits.maxExecutionMs - (Date.now() - budget.started), options.child ? 30000 - (Date.now() - childStarted) : Infinity)), tenant: ctx }); break; }
        catch (error) {
          const usage = { inputTokens: inputBytes, outputTokens: outputLimit, cachedTokens: 0, cacheWriteTokens: inputBytes, estimated: true };
          metrics.models.push(usageRecord(decision, usage, usageCost(decision.model, usage), 0, error instanceof ProviderError ? error.category : 'unknown')); budget.record(decision.model, usage);
          if (error instanceof ProviderError && error.category === 'invalid_output' && attempt < 2) {
            invalidCalls++; decision = routeModel({ invalidCalls, planningFailures: invalidCalls, remainingCost: budget.limits.maxCost - budget.cost });
            budget.reserve(decision.model, inputBytes, outputLimit); await emit('schema_retry', 'Răspunsul nu respectă schema; încerc o corectare limitată.'); continue;
          }
          if (!(error instanceof ProviderError) || !error.retryable || attempt >= 1) throw error;
          budget.reserve(decision.model, inputBytes, outputLimit); await emit('provider_retry', 'Serviciul AI este temporar indisponibil; reîncerc o singură dată.');
        }
      }
      metrics.models.push(usageRecord(decision, result.usage, usageCost(decision.model, result.usage), result.latencyMs)); budget.record(decision.model, result.usage);
      previousReservation = result.usage.estimated ? undefined : {plainBytes:reservation.plainBytes,inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens};
      input.push(...result.items);
      if (!result.calls.length) return finish(result.text || 'Răspuns incomplet; nu am executat acțiuni.', result.status === 'incomplete' ? 'partial' : result.intentStatus === 'clarification' ? 'clarification' : result.intentStatus === 'refusal' ? 'refused' : 'success');
      for (const call of result.calls) {
        budget.tool(); const started = Date.now(); let name = call.name, status = 'success', data: unknown;
        try {
          // Compatibility for old recorded fixtures; new model definitions use clear tool names.
          const parsed = name === 'crm' ? z.object({ operation: z.string(), payload: z.string().max(30000) }).strict().parse(JSON.parse(call.arguments)) : { operation: name, payload: JSON.stringify(functionPayload(name, call.arguments)) };
          name = parsed.operation;
          if (!available.includes(name)) throw new Error('Instrumentul nu este disponibil în această execuție.');
          if (ctx.adminDb) {
            const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
            if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) throw new Error('Acces revocat; instrumentul nu a fost executat.');
          }
          if (options.allowedTools && !options.allowedTools.includes(name)) throw new Error('Tool nepermis subagentului.');
          const definition = requireTool(name, ctx.role || ''), payload = definition.inputSchema.parse(JSON.parse(parsed.payload));
          const signature = name + ':' + parsed.payload; const repeated = (repetitions.get(signature) || 0) + 1; repetitions.set(signature, repeated); if (repeated > 2) throw new Error('Planificare circulară fără progres.');
          await emit(name, definition.description);
          let timer: ReturnType<typeof setTimeout> | undefined;
          let response;
          const invoke = async () => {
            for (let attempt = 1; ; attempt++) {
              try { return await definition.handler(ctx, payload, prompt, { ...options, provider, budget, verifiedDates }); }
              catch (error) {
                const code = Number((error as { status?: number; httpStatus?: number })?.status || (error as { httpStatus?: number })?.httpStatus);
                const transient = error instanceof ProviderError ? error.retryable : [429, 502, 503, 504].includes(code);
                // Never replay compound/model tools or mutations. A timeout is ambiguous.
                if (definition.riskLevel !== 'READ' || ['delegate_read', 'parallel_read'].includes(name) || !transient || attempt >= definition.retryPolicy.maxAttempts) throw error;
                budget.tool(); await emit('tool_retry', 'Reîncerc o citire temporar indisponibilă, fără scrieri.');
              }
            }
          };
          try { response = await Promise.race([invoke(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Tool timeout; rezultatul nu este confirmat.')), Math.min(definition.timeoutMs, Math.max(1, budget.limits.maxExecutionMs - (Date.now() - budget.started)))); })]); }
          finally { if (timer) clearTimeout(timer); }
          definition.outputSchema.parse(response.data);
          if (name === 'resolve_datetime' && typeof response.data.iso === 'string') verifiedDates.add(response.data.iso);
          if (actions.length + response.actions.length > 12) throw new Error('Planul depășește 12 acțiuni.');
          cards.push(...response.cards); actions.push(...response.actions); accessRefs.push(...response.refs);
          if (response.childMetrics) { metrics.models.push(...response.childMetrics.models); metrics.tools.push(...response.childMetrics.tools as typeof metrics.tools); }
          data = response.data;
        } catch (error) {
          if (error instanceof BudgetExceeded) throw error;
          // Permissions, missing records, infrastructure outages and tool timeouts are
          // not evidence that a more expensive model can solve the task.
          if (error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof Error && /Instrumentul nu este disponibil|Planificare circulară|Tool nepermis|Tool necunoscut/.test(error.message))) invalidCalls++;
          status = 'failed'; data = { error: error instanceof z.ZodError ? 'Argumente/rezultat invalid: ' + error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : error instanceof Error ? error.message : 'Tool refuzat.' };
        }
        metrics.tools.push({ name: toolRegistry.has(name) ? name : 'unknown_tool', status, latencyMs: Date.now() - started, version: VERSIONS.tools, argumentsHash: createHash('sha256').update(call.arguments).digest('hex') });
        input.push({ type: 'function_call_output', call_id: call.id, output: compressedResult(data, 7000) });
      }
      if (actions.length) return finish('Plan pregătit.');
    }
  } catch (error) {
    if (error instanceof BudgetExceeded) return finish(error.message + ' Acțiunile pregătite nu au fost executate.', 'partial');
    if (error instanceof ProviderError) return finish('Serviciul AI nu a confirmat răspunsul. Nu am executat acțiuni; rezultatele confirmate sunt păstrate.', 'failed');
    throw error;
  }
  return finish('Limita de pași a fost atinsă. Rezultatele sunt parțiale; poți continua. Acțiunile pregătite nu au fost executate.', 'partial');
}
