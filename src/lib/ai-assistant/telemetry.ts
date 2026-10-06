import { collectionFor, type AssistantContext } from './access';
import { VERSIONS, modelPricing, type RoutingDecision, type ModelUsage } from './models';
import { featureFlags } from './skills';
import { DEFAULT_LIMITS } from './budget';
export type AgentEvent = { type: 'PROGRESS_EVENT' | 'ERROR_EVENT'; stage: string; step: number; text: string; at: string };
export type UsageRecord = { decision: RoutingDecision; usage: ModelUsage; costUsd: number; latencyMs: number; pricingVersion: string; outcome: string; errorCategory?: string };
export type TurnMetrics = { models: UsageRecord[]; tools: { name: string; status: string; latencyMs: number; version: string }[]; status: string; elapsedMs: number; requiresApproval?: boolean; approval?: boolean; jev?: import('./jev').JevObservation };
export function telemetryDocument(ctx: AssistantContext, requestId: string, sessionId: string, metrics: TurnMetrics) {
  // No prompts, arguments, messages, phone numbers or provider error bodies in logs.
  return { requestId, sessionId, userId: ctx.uid, agencyId: ctx.agencyId, ...metrics, costUsd: metrics.models.reduce((sum, item) => sum + item.costUsd, 0) + (metrics.jev?.costUsd || 0), tokens: metrics.models.reduce((sum, item) => sum + item.usage.inputTokens + item.usage.outputTokens, 0) + (metrics.jev?.inputTokens || 0) + (metrics.jev?.outputTokens || 0), versions: VERSIONS, configuration: { flags: featureFlags(), regionalProcessing: process.env.JARVIS_REGIONAL_PROCESSING === 'true', defaultLimits: DEFAULT_LIMITS }, timestamp: new Date().toISOString() };
}
export async function recordTelemetry(ctx: AssistantContext, requestId: string, sessionId: string, metrics: TurnMetrics) {
  await collectionFor(ctx, 'assistantTelemetry').doc(requestId).set(telemetryDocument(ctx, requestId, sessionId, metrics));
}
export function usageRecord(decision: RoutingDecision, usage: ModelUsage, costUsd: number, latencyMs: number, errorCategory?: string): UsageRecord { return { decision, usage, costUsd, latencyMs, pricingVersion: modelPricing(decision.model).version, outcome: errorCategory ? 'failed' : 'success', ...(errorCategory ? { errorCategory } : {}) }; }
