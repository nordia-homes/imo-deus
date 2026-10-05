import { collectionFor, type AssistantContext } from './access';
export async function usageReport(ctx: AssistantContext, from: string, to: string, after?: string) {
  let base = collectionFor(ctx, 'assistantTelemetry').where('timestamp', '>=', from).where('timestamp', '<', to).orderBy('timestamp').orderBy('__name__');
  if (ctx.role !== 'admin') base = base.where('userId', '==', ctx.uid);
  const groups: Record<string, { tasks: number; costUsd: number; tokens: number }> = {};
  let cursor: FirebaseFirestore.DocumentSnapshot | undefined, complete = false, tasks = 0, scanned = 0, auxiliaryCalls = 0, successes = 0, lunaSolved = 0, solTasks = 0, cost = 0, auxiliaryCost = 0, latency = 0;
  if (after) { cursor = await collectionFor(ctx, 'assistantTelemetry').doc(after).get(); const row = cursor.data(); if (!row || row.timestamp < from || row.timestamp >= to || (ctx.role !== 'admin' && row.userId !== ctx.uid)) throw new Error('Cursor neautorizat.'); }
  const models: Record<string, { calls: number; costUsd: number; inputTokens: number; outputTokens: number; cachedTokens: number; reasons: Record<string, number> }> = {};
  let approvalRequired = 0, approved = 0, cancelled = 0, providerCalls = 0, failedProviderCalls = 0, retriedTasks = 0, toolCalls = 0, failedToolCalls = 0;
  const errorCategories: Record<string, number> = {}, executions: Record<string, number> = {};
  let unknownCostTasks = 0;
  while (scanned < 5000) {
    const page = await (cursor ? base.startAfter(cursor) : base).limit(100).get();
    for (const doc of page.docs) {
      const row = doc.data(), auxiliary = row.sessionId === 'domain_ai'; scanned++;
      if (row.usageComplete === false) unknownCostTasks++;
      tasks += auxiliary ? 0 : 1; auxiliaryCalls += auxiliary ? 1 : 0; auxiliaryCost += auxiliary ? Number(row.costUsd || 0) : 0;
      successes += !auxiliary && row.status === 'success' ? 1 : 0; cost += Number(row.costUsd || 0); latency += auxiliary ? 0 : Number(row.elapsedMs || 0);
      approvalRequired += row.requiresApproval ? 1 : 0; approved += row.approval === true ? 1 : 0; cancelled += row.approvalStatus === 'cancelled' ? 1 : 0;
      if (row.executionStatus) executions[row.executionStatus] = (executions[row.executionStatus] || 0) + 1;
      const failures = (row.models || []).filter((call: any) => call.outcome === 'failed');
      providerCalls += (row.models || []).length; failedProviderCalls += failures.length; retriedTasks += !auxiliary && failures.length && (row.models || []).length > failures.length ? 1 : 0;
      for (const call of failures) { const key = call.errorCategory || 'unknown'; errorCategories[key] = (errorCategories[key] || 0) + 1; }
      toolCalls += (row.tools || []).length; failedToolCalls += (row.tools || []).filter((call: any) => call.status === 'failed').length;
      const escalated = (row.models || []).some((call: any) => call.decision.model === 'gpt-6.1-sol');
      solTasks += !auxiliary && escalated ? 1 : 0;
      lunaSolved += !auxiliary && !escalated && row.status === 'success' && (row.models || []).length ? 1 : 0;
      for (const key of [`day:${String(row.timestamp).slice(0, 10)}`, `month:${String(row.timestamp).slice(0, 7)}`, `user:${row.userId}`]) { const group = groups[key] ||= { tasks: 0, costUsd: 0, tokens: 0 }; group.tasks += auxiliary ? 0 : 1; group.costUsd += Number(row.costUsd || 0); group.tokens += Number(row.tokens || 0); }
      for (const call of row.models || []) { const model = models[call.decision.model] ||= { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasons: {} }; model.calls++; model.costUsd += call.costUsd; model.inputTokens += call.usage.inputTokens; model.outputTokens += call.usage.outputTokens; model.cachedTokens += call.usage.cachedTokens; model.reasons[call.decision.reason] = (model.reasons[call.decision.reason] || 0) + 1; }
    }
    if (page.size < 100) { complete = true; break; } cursor = page.docs.at(-1);
  }
  return { agencyId: ctx.agencyId, scope: ctx.role === 'admin' ? 'agency' : 'user', from, to, tasks, scanned, auxiliaryCalls, auxiliaryCostUsd: auxiliaryCost, successes, lunaSolvedTasks: lunaSolved, solTasks, lunaSolvedPercent: tasks ? 100 * lunaSolved / tasks : null, solEscalatedPercent: tasks ? 100 * solTasks / tasks : null, costUsd: cost, costComplete: unknownCostTasks === 0, unknownCostTasks, averageCostPerTask: tasks && !unknownCostTasks ? cost / tasks : null, averageLatencyMs: tasks ? latency / tasks : null, approvalRequired, approved, cancelled, approvalRatePercent: approvalRequired ? 100 * approved / approvalRequired : null, providerCalls, failedProviderCalls, retryRatePercent: tasks ? 100 * retriedTasks / tasks : null, toolCalls, failedToolCalls, errorCategories, executions, models, groups, complete, cursor: complete ? null : cursor?.id || null };
}

