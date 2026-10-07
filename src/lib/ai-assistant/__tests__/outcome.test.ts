import { expect, it } from 'vitest';
import { summarizeOutcome } from '../outcome';

it.each(['failed', 'cancelled', 'unavailable'])('keeps an active provider wait visible alongside a %s step', executionState => {
  const rows = [{ step: 1, executionState: 'succeeded', completionSatisfied: true }, { step: 2, executionState }, { step: 3, executionState: 'running', watchable: true }];
  for (const ordered of [rows, [...rows].reverse()]) {
    const outcome = summarizeOutcome('completed', 3, ordered);
    expect(outcome).toMatchObject({ state: 'WAITING_PROVIDER', confirmed: 1, failed: 1, pending: 1, uncertain: 0 });
    expect(outcome.note).toContain('pași nereușiți: 1');
    expect(outcome.note).toContain('în așteptarea furnizorului: 1');
  }
});
it.each([false, true])('keeps uncertain effects blocked alongside failures, with watchable=%s', watchable => {
  expect(summarizeOutcome('completed', 3, [{ step: 1, executionState: 'failed' }, { step: 2, executionState: 'unknown', watchable }, { step: 3, executionState: 'queued', watchable: true }])).toMatchObject({ state: 'BLOCKED', failed: 1, uncertain: 1, pending: 1 });
});
it('settles a mixed result only after the provider wait finishes', () => {
  const failure = { step: 1, executionState: 'failed' };
  expect(summarizeOutcome('completed', 2, [failure, { step: 2, executionState: 'queued', watchable: true }])).toMatchObject({ state: 'WAITING_PROVIDER', confirmed: 0 });
  expect(summarizeOutcome('completed', 2, [failure, { step: 2, executionState: 'succeeded', completionSatisfied: true }])).toMatchObject({ state: 'PARTIALLY_COMPLETED', confirmed: 1, pending: 0 });
  expect(summarizeOutcome('completed', 2, [failure, { step: 2, executionState: 'failed' }])).toMatchObject({ state: 'FAILED', failed: 2, pending: 0 });
});
it.each(['paused', 'cancelled'])('preserves %s for mixed results and reports outstanding effects', status => {
  expect(summarizeOutcome(status, 2, [{ step: 1, executionState: 'failed' }, { step: 2, executionState: 'queued', watchable: true }])).toMatchObject({ state: status.toUpperCase(), failed: 1, pending: 1 });
});

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
