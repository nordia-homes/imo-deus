import { createHash } from 'node:crypto';
import { z } from 'zod';
import { allowedModel, VERSIONS, type ModelUsage, type RoutingDecision } from './models';

export type ProviderRequest = { decision: RoutingDecision; instructions: string; input: unknown[]; tools: unknown[]; maxOutputTokens: number; timeoutMs: number; tenant: { agencyId: string; uid: string }; signal?: AbortSignal };
export type ProviderResult = { items: unknown[]; calls: { id: string; name: string; arguments: string }[]; text: string; intentStatus?: 'answer' | 'clarification' | 'refusal'; usage: ModelUsage; latencyMs: number; status: string };
export interface ModelProvider { readonly id: string; respond(request: ProviderRequest): Promise<ProviderResult> }
export class ProviderError extends Error { constructor(public category: 'rate_limit' | 'temporary' | 'configuration' | 'invalid_output' | 'timeout', public retryable: boolean, public httpStatus?: number) { super(`Model provider: ${category}`); } }
const usageSchema = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(), input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative().optional(), cache_write_tokens: z.number().int().nonnegative().optional() }).passthrough().optional() }).passthrough();
const replySchema = z.object({ text: z.string().min(1).max(12000), intentStatus: z.enum(['answer', 'clarification', 'refusal']) }).strict();
const replyFormat = { type: 'json_schema', name: 'jarvis_reply', strict: true, schema: { type: 'object', properties: { text: { type: 'string' }, intentStatus: { type: 'string', enum: ['answer', 'clarification', 'refusal'] } }, required: ['text', 'intentStatus'], additionalProperties: false } };
export class OpenAIAdapter implements ModelProvider {
  readonly id = 'openai';
  async respond(request: ProviderRequest): Promise<ProviderResult> {
    const model = allowedModel(request.decision.model);
    if (!process.env.OPENAI_API_KEY) throw new ProviderError('configuration', false);
    const started = Date.now();
    const tenantKey = createHash('sha256').update(`${request.tenant.agencyId}:${request.tenant.uid}`).digest('hex').slice(0, 32);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, reasoning: { effort: request.decision.effort }, instructions: request.instructions, input: request.input, tools: request.tools, parallel_tool_calls: false, store: false, include: ['reasoning.encrypted_content'], prompt_cache_key: `jarvis:${tenantKey}:${VERSIONS.prompt}`, prompt_cache_options: { mode: 'implicit', ttl: '30m' }, max_output_tokens: request.maxOutputTokens, text: { format: replyFormat } }), signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)]) : AbortSignal.timeout(request.timeoutMs), cache: 'no-store' });
    } catch { throw new ProviderError('timeout', true); }
    if (!response.ok) throw new ProviderError(response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'temporary' : 'configuration', response.status === 429 || response.status >= 500, response.status);
    let result; try { result = await response.json(); } catch { throw new ProviderError('temporary', true); }
    if (!Array.isArray(result.output)) throw new ProviderError('invalid_output', false);
    let calls: { call_id: string; name: string; arguments: string }[];
    try { calls = result.output.filter((item: any) => item.type === 'function_call').map((item: any) => z.object({ call_id: z.string().min(1), name: z.string().min(1).max(100), arguments: z.string().max(32000) }).passthrough().parse(item)); } catch { throw new ProviderError('invalid_output', false); }
    const rawText = result.output.flatMap((item: any) => item.content || []).filter((item: any) => item.type === 'output_text').map((item: any) => String(item.text)).join('\n');
    let reply: z.infer<typeof replySchema> | undefined;
    if (!calls.length && rawText) { try { reply = replySchema.parse(JSON.parse(rawText)); } catch { throw new ProviderError('invalid_output', false); } }
    const parsed = usageSchema.safeParse(result.usage);
    // Missing usage is charged conservatively and labelled estimated, never zero.
    const estimatedInput = new TextEncoder().encode(JSON.stringify(request.input) + request.instructions + JSON.stringify(request.tools)).length;
    const usage: ModelUsage = parsed.success ? { inputTokens: parsed.data.input_tokens, outputTokens: parsed.data.output_tokens, cachedTokens: parsed.data.input_tokens_details?.cached_tokens || 0, cacheWriteTokens: parsed.data.input_tokens_details?.cache_write_tokens || 0, estimated: false } : { inputTokens: estimatedInput, outputTokens: request.maxOutputTokens, cachedTokens: 0, cacheWriteTokens: estimatedInput, estimated: true };
    return { items: result.output, calls: calls.map((item: { call_id: string; name: string; arguments: string }) => ({ id: item.call_id, name: item.name, arguments: item.arguments })), text: reply?.text || '', intentStatus: reply?.intentStatus, usage, latencyMs: Date.now() - started, status: result.status || 'completed' };
  }
}
