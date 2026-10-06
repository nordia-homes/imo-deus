import { expect, it } from 'vitest';
import { goalCoverageOutcome, validateGoalCoverage } from '../goal-coverage';
import { summarizeOutcome } from '../outcome';
const requirement = { id: 'task', sourceQuote: 'Creează', description: 'Sarcina cerută', resolution: 'planned' as const, steps: [1], evidenceCallIds: [] };
it('rejects ungrounded requests, missing steps, duplicate IDs and fabricated evidence', () => {
  expect(() => validateGoalCoverage({ requirements: [requirement] }, 'Creează task', 1, new Set())).not.toThrow();
  expect(() => validateGoalCoverage({ requirements: [requirement] }, 'Citește task', 1, new Set())).toThrow('citat exact');
  expect(() => validateGoalCoverage({ requirements: [requirement] }, 'Creează task', 2, new Set())).toThrow('Fiecare acțiune');
  expect(() => validateGoalCoverage({ requirements: [requirement, requirement] }, 'Creează task', 1, new Set())).toThrow('duplicat');
  expect(() => validateGoalCoverage({ requirements: [{ ...requirement, resolution: 'answered', steps: [], evidenceCallIds: ['invented'] }] }, 'Creează task', 0, new Set())).toThrow('Dovadă');
});
it('does not call the whole request completed when an explicit requirement remains unresolved', () => {
  const rows = [{ step: 1, executionState: 'succeeded', evidenceSource: 'execution_ledger' }];
  const completed = summarizeOutcome('completed', 1, rows);
  expect(goalCoverageOutcome(completed, undefined, rows, true).state).toBe('BLOCKED');
  expect(goalCoverageOutcome(completed, { requirements: [requirement, { ...requirement, id: 'publish', resolution: 'needs_clarification', steps: [] }] }, rows, true).state).toBe('NEEDS_CLARIFICATION');
  expect(goalCoverageOutcome(completed, { requirements: [requirement] }, rows, true).state).toBe('COMPLETED');
  expect(goalCoverageOutcome(completed, undefined, rows, false).state).toBe('COMPLETED');
});
