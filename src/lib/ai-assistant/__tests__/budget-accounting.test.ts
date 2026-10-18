import { expect, it } from 'vitest';
import { AgentBudget, BudgetExceeded, DEFAULT_LIMITS } from '../budget';

const usage = { inputTokens: 100, outputTokens: 50, cachedTokens: 20, cacheWriteTokens: 0, estimated: false };
it.each(['inputTokens', 'outputTokens', 'cachedTokens', 'cacheWriteTokens'] as const)('rejects malformed %s without changing recorded totals and keeps the shared budget stopped', field => {
  for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const budget = new AgentBudget();
    budget.record('gpt-6-luna', usage);
    const { tokens, costUsd } = budget.snapshot();
    expect(() => budget.record('gpt-6-luna', { ...usage, [field]: value })).toThrow(BudgetExceeded);
    expect(budget.snapshot()).toMatchObject({ tokens, costUsd });
    for (const next of [() => budget.check(), () => budget.step(), () => budget.tool(), () => budget.reserve('gpt-6-luna', 1, 1), () => budget.recordAuxiliary(0, 0)]) expect(next).toThrow('date de consum invalide');
  }
});
it.each([NaN, Infinity, -Infinity, -0.01])('rejects auxiliary cost %s instead of clamping or poisoning totals', cost => {
  const budget = new AgentBudget();
  budget.recordAuxiliary(0.01, 10);
  expect(() => budget.recordAuxiliary(cost, 20)).toThrow(BudgetExceeded);
  expect(budget.snapshot()).toMatchObject({ tokens: 10, costUsd: 0.01 });
  expect(() => budget.reserve('gpt-6-luna', 1, 1)).toThrow(BudgetExceeded);
});
it.each([NaN, Infinity, -1, 0.5])('rejects invalid reservation and auxiliary token count %s', count => {
  expect(() => new AgentBudget().reserve('gpt-6-luna', count, 1)).toThrow(BudgetExceeded);
  expect(() => new AgentBudget().reserve('gpt-6-luna', 1, count)).toThrow(BudgetExceeded);
  expect(() => new AgentBudget().recordAuxiliary(0, count)).toThrow(BudgetExceeded);
});
it('records a valid charge that reaches the ceiling before stopping further calls', () => {
  const budget = new AgentBudget({ ...DEFAULT_LIMITS, maxTokens: 150 });
  expect(() => budget.record('gpt-6-luna', usage)).toThrow('tokens');
  expect(budget.tokens).toBe(150);
  expect(budget.cost).toBeGreaterThan(0);
  expect(() => budget.reserve('gpt-6-luna', 1, 1)).toThrow('tokens');
});
it('accepts zero usage and finite fractional dollar charges', () => {
  const budget = new AgentBudget();
  budget.recordAuxiliary(0, 0);
  budget.recordAuxiliary(0.000001, 1);
  budget.reserve('gpt-6-luna', 0, 0);
  expect(budget.snapshot()).toMatchObject({ tokens: 1, costUsd: 0.000001 });
});

it('allows repeated cached context beyond the former cumulative cap while preserving cost and context limits', () => {
  const budget = new AgentBudget();
  for (let i = 0; i < 20; i++) {
    budget.reserve('gpt-6-luna', 10000, 100);
    budget.record('gpt-6-luna', { inputTokens: 9000, outputTokens: 50, cachedTokens: 8500, cacheWriteTokens: 0, estimated: false });
  }
  expect(budget.tokens).toBe(181000);
  expect(() => budget.reserve('gpt-6-luna', 70000, 1)).toThrow('contextul apelului');
  expect(() => budget.recordAuxiliary(DEFAULT_LIMITS.maxCost, 0)).toThrow('cost');
});
it('starts a fresh request budget without carrying consumption between conversation turns', () => {
  for (let request = 0; request < 110; request++) {
    const budget = new AgentBudget();
    expect(budget.tokens).toBe(0);
    budget.recordAuxiliary(0.001, 100000);
    expect(budget.tokens).toBe(100000);
  }
});
