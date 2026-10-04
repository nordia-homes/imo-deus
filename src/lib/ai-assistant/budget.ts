import { usageCost, type ModelId, type ModelUsage } from './models';
export type AgentLimits = { maxSteps: number; maxToolCalls: number; maxTokens: number; maxCost: number; maxExecutionMs: number; maxParallel: number; maxOutputTokens: number };
export const DEFAULT_LIMITS: AgentLimits = { maxSteps: 12, maxToolCalls: 24, maxTokens: 70000, maxCost: 0.12, maxExecutionMs: 120000, maxParallel: 3, maxOutputTokens: 2200 };
export class BudgetExceeded extends Error { constructor(public dimension: string) { super(`Limita Jarvis a fost atinsă: ${dimension}. Rezultatele sunt parțiale.`); } }
export class AgentBudget {
  readonly started = Date.now(); steps = 0; calls = 0; tokens = 0; cost = 0;
  constructor(readonly limits: AgentLimits = DEFAULT_LIMITS) {}
  check() { if (Date.now() - this.started >= this.limits.maxExecutionMs) throw new BudgetExceeded('timp'); if (this.tokens >= this.limits.maxTokens) throw new BudgetExceeded('tokens'); if (this.cost >= this.limits.maxCost) throw new BudgetExceeded('cost'); }
  step() { this.check(); if (++this.steps > this.limits.maxSteps) throw new BudgetExceeded('pași'); }
  tool() { this.check(); if (++this.calls > this.limits.maxToolCalls) throw new BudgetExceeded('unelte'); }
  reserve(model: ModelId, inputBytes: number, output: number) {
    this.check(); // UTF-8 byte count is an upper bound, not chars/4 pretending exact tokenization.
    if (this.tokens + inputBytes + output > this.limits.maxTokens) throw new BudgetExceeded('tokens');
    if (this.cost + usageCost(model, { inputTokens: inputBytes, outputTokens: output, cachedTokens: 0, cacheWriteTokens: inputBytes, estimated: true }) > this.limits.maxCost) throw new BudgetExceeded('cost');
  }
  record(model: ModelId, usage: ModelUsage) { this.tokens += usage.inputTokens + usage.outputTokens; this.cost += usageCost(model, usage); this.check(); }
  snapshot() { return { steps: this.steps, toolCalls: this.calls, tokens: this.tokens, costUsd: this.cost, elapsedMs: Date.now() - this.started }; }
}
