import { usageCost, type ModelId, type ModelUsage } from './models';
export type AgentLimits = { maxSteps: number; maxToolCalls: number; maxTokens: number; maxCost: number; maxExecutionMs: number; maxParallel: number; maxOutputTokens: number };
export const DEFAULT_LIMITS: AgentLimits = { maxSteps: 12, maxToolCalls: 24, maxTokens: 70000, maxCost: 0.12, maxExecutionMs: 120000, maxParallel: 3, maxOutputTokens: 2200 };
export class BudgetExceeded extends Error { constructor(public dimension: string) { super(`Limita Jarvis a fost atinsă: ${dimension}. Rezultatele sunt parțiale.`); } }
export type InputReservation = { plainBytes: number; inputTokens: number; outputTokens: number };
export function requestReservation(instructions: string, input: unknown[], tools: unknown[], previous?: InputReservation) {
  // Encrypted reasoning is protocol ciphertext, not its base64 length in billable tokens.
  // After the first call, use the provider's measured input plus ALL new plaintext bytes
  // and the entire preceding output, with headroom. Actual usage still enforces the cap.
  const plainBytes = Buffer.byteLength(instructions + JSON.stringify(tools) + JSON.stringify(input, (key, value) => key === 'encrypted_content' ? undefined : value));
  const tokens = previous && previous.inputTokens > 0 ? Math.ceil(previous.inputTokens * 1.2) + Math.max(0, plainBytes - previous.plainBytes) + previous.outputTokens : plainBytes;
  return { plainBytes, tokens };
}
export class AgentBudget {
  readonly started = Date.now(); steps = 0; calls = 0; tokens = 0; cost = 0;
  private invalidAccounting = false;
  constructor(readonly limits: AgentLimits = DEFAULT_LIMITS) {}
  private validateAccounting(counts: number[], costs: number[] = []) {
    if (this.invalidAccounting || counts.some(value => !Number.isSafeInteger(value) || value < 0) || costs.some(value => !Number.isFinite(value) || value < 0)) {
      this.invalidAccounting = true;
      throw new BudgetExceeded('date de consum invalide; execuția necesită verificare');
    }
  }
  check() { this.validateAccounting([this.tokens], [this.cost]); if (Date.now() - this.started >= this.limits.maxExecutionMs) throw new BudgetExceeded('timp'); if (this.tokens >= this.limits.maxTokens) throw new BudgetExceeded('tokens'); if (this.cost >= this.limits.maxCost) throw new BudgetExceeded('cost'); }
  step() { this.check(); if (++this.steps > this.limits.maxSteps) throw new BudgetExceeded('pași'); }
  tool() { this.check(); if (++this.calls > this.limits.maxToolCalls) throw new BudgetExceeded('unelte'); }
  reserve(model: ModelId, inputBytes: number, output: number) {
    this.check(); // UTF-8 byte count is an upper bound, not chars/4 pretending exact tokenization.
    this.validateAccounting([inputBytes, output]);
    if (this.tokens + inputBytes + output > this.limits.maxTokens) throw new BudgetExceeded('tokens');
    if (this.cost + usageCost(model, { inputTokens: inputBytes, outputTokens: output, cachedTokens: 0, cacheWriteTokens: inputBytes, estimated: true }) > this.limits.maxCost) throw new BudgetExceeded('cost');
  }
  record(model: ModelId, usage: ModelUsage) {
    this.validateAccounting([usage.inputTokens, usage.outputTokens, usage.cachedTokens, usage.cacheWriteTokens]);
    const cost = usageCost(model, usage);
    this.recordAuxiliary(cost, usage.inputTokens + usage.outputTokens);
  }
  recordAuxiliary(costUsd: number, tokens: number) {
    // Validate before mutation; invalid provider data must never turn a ceiling
    // comparison into NaN or subtract from previously accounted usage.
    this.validateAccounting([tokens, this.tokens + tokens], [costUsd, this.cost + costUsd]);
    this.cost += costUsd; this.tokens += tokens; this.check();
  }
  snapshot() { return { steps: this.steps, toolCalls: this.calls, tokens: this.tokens, costUsd: this.cost, elapsedMs: Date.now() - this.started }; }
}
