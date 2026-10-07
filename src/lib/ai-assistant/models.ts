import { z } from 'zod';
import pricing from './model-pricing.json';

export const MODEL_IDS = ['gpt-6-luna', 'gpt-6.1-sol'] as const;
export type ModelId = typeof MODEL_IDS[number];
export type LogicalModel = 'LUNA' | 'SOL';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';
export const VERSIONS = { prompt: 'jarvis-29', routing: 'luna-first-2', policy: 'tenant-approval-6', tools: '29', memory: '2', skills: '3' } as const;
export function allowedModel(id: string): ModelId { return z.enum(MODEL_IDS).parse(id); }
export type RoutingSignals = { dependencyDepth?: number; estimatedTools?: number; planningFailures?: number; invalidCalls?: number; ambiguity?: boolean; risk?: 'READ' | 'SAFE_WRITE' | 'SENSITIVE' | 'CRITICAL'; elapsedMs?: number; remainingCost?: number; evaluationRequiresSol?: boolean; infrastructureFailure?: boolean };
export type RoutingDecision = { logical: LogicalModel; model: ModelId; effort: ReasoningEffort; reason: string; version: string };
export function routeModel(signals: RoutingSignals = {}, solEnabled = process.env.JARVIS_SOL_ESCALATION !== 'false'): RoutingDecision {
  // Importance, price and prompt length are intentionally not routing signals.
  const qualityFailure = (signals.planningFailures || 0) >= 2 || (signals.invalidCalls || 0) >= 3;
  const complex = (signals.dependencyDepth || 0) >= 5 && (signals.estimatedTools || 0) >= 8;
  const escalate = solEnabled && !signals.infrastructureFailure && (qualityFailure || complex || signals.evaluationRequiresSol === true) && (signals.remainingCost ?? Infinity) >= 0.015;
  const logical = escalate ? 'SOL' : 'LUNA';
  const configured = logical === 'LUNA' ? process.env.OPENAI_ASSISTANT_MODEL || 'gpt-6-luna' : process.env.JARVIS_SOL_MODEL || 'gpt-6.1-sol';
  const model = allowedModel(configured);
  if ((logical === 'LUNA' && model !== 'gpt-6-luna') || (logical === 'SOL' && model !== 'gpt-6.1-sol')) throw new Error('Logical model mapping violates Luna-first policy');
  return { logical, model, effort: escalate ? 'medium' : (signals.estimatedTools || 0) > 5 ? 'medium' : 'low', reason: escalate ? qualityFailure ? 'repeated_validated_planning_failure' : signals.evaluationRequiresSol ? 'evaluation_quality_threshold' : 'dependent_workflow_complexity' : signals.infrastructureFailure ? 'provider_failure_is_not_quality_failure' : 'luna_first', version: VERSIONS.routing };
}
export type ModelUsage = { inputTokens: number; outputTokens: number; cachedTokens: number; cacheWriteTokens: number; estimated: boolean };
const rate = z.object({ input: z.number().nonnegative(), cachedInput: z.number().nonnegative(), cacheWrite: z.number().nonnegative(), output: z.number().nonnegative() }).strict();
export function modelPricing(model: ModelId) {
  const custom = process.env.JARVIS_MODEL_PRICING ? z.object({ version: z.string().min(1), models: z.object({ 'gpt-6-luna': rate, 'gpt-6.1-sol': rate }).strict() }).strict().parse(JSON.parse(process.env.JARVIS_MODEL_PRICING)) : pricing;
  return { ...custom.models[allowedModel(model)], version: custom.version };
}
export function usageCost(model: ModelId, usage: ModelUsage) {
  const rates = modelPricing(model);
  const cached = Math.min(usage.inputTokens, usage.cachedTokens), writes = Math.min(usage.inputTokens - cached, usage.cacheWriteTokens);
  const regional = process.env.JARVIS_REGIONAL_PROCESSING === 'true' ? 1.1 : 1;
  return ((usage.inputTokens - cached - writes) * rates.input + cached * rates.cachedInput + writes * rates.cacheWrite + usage.outputTokens * rates.output) / 1e6 * regional;
}
export type ModelCapabilities = { tools: boolean; structuredOutput: boolean; reasoning: ReasoningEffort[]; streaming: boolean };
export type ModelDefinition = { logical: LogicalModel; id: ModelId; provider: string; capabilities: ModelCapabilities };
export const modelDefinitions: ModelDefinition[] = MODEL_IDS.map((id, i) => ({ logical: i ? 'SOL' : 'LUNA', id, provider: 'openai', capabilities: { tools: true, structuredOutput: true, streaming: true, reasoning: i ? ['low', 'medium', 'high'] : ['none', 'low', 'medium', 'high'] } }));
