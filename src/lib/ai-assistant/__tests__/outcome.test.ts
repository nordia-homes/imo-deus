import { expect, it } from 'vitest';
import { summarizeOutcome } from '../outcome';

it('does not certify worker completion without business evidence', () => {
  expect(summarizeOutcome('completed', 1, [])).toMatchObject({ state: 'BLOCKED', confirmed: 0 });
  expect(summarizeOutcome('completed', 1, [{ step: 1, executionState: 'queued', watchable: true }]).state).toBe('WAITING_PROVIDER');
  expect(summarizeOutcome('completed', 1, [{ step: 1, executionState: 'queued' }]).state).toBe('BLOCKED');
});
it('counts scheduling only with explicit satisfied evidence and preserves partial failure', () => {
  const scheduled = { step: 1, executionState: 'queued', completionSatisfied: true };
  expect(summarizeOutcome('completed', 1, [scheduled]).state).toBe('COMPLETED');
  expect(summarizeOutcome('completed', 2, [scheduled, { step: 2, executionState: 'failed' }]).state).toBe('PARTIALLY_COMPLETED');
});
it('rejects duplicate/out-of-range counts and preserves cancellation', () => {
  const success = { step: 1, executionState: 'succeeded', evidenceSource: 'execution_ledger' };
  expect(summarizeOutcome('completed', 2, [success, success, { ...success, step: 3 }])).toMatchObject({ confirmed: 1, state: 'BLOCKED' });
  expect(summarizeOutcome('cancelled', 1, [success]).state).toBe('CANCELLED');
  expect(summarizeOutcome('completed', 1, [{ ...success, completionSatisfied: false }]).state).toBe('BLOCKED');
});
it('does not choose a successful receipt over contradictory evidence for the same step', () => {
  const success = { step: 1, executionState: 'succeeded', completionSatisfied: true };
  const failure = { step: 1, executionState: 'failed' };
  for (const rows of [[success, failure], [failure, success]]) {
    expect(summarizeOutcome('completed', 1, rows)).toMatchObject({ state: 'BLOCKED', confirmed: 0, uncertain: 1 });
  }
});
