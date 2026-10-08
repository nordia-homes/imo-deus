import { expect, it } from 'vitest';
import { requirementOutcomes } from '../requirement-outcomes';
const requirement = { id: 'video', description: 'Pregătește materialul', sourceQuote: 'materialul', resolution: 'planned', steps: [1], evidenceCallIds: [] };
const success = { step: 1, executionState: 'succeeded', completionSatisfied: true };
it('separates completed and pending requirements, preserving original noncontiguous step numbers', () => {
  const report = requirementOutcomes('completed', 3, { requirements: [{ ...requirement, steps: [3, 1] }, { ...requirement, id: 'publication', steps: [2] }] }, [success, { ...success, step: 3 }, { step: 2, executionState: 'queued', watchable: true }]);
  expect(report).toMatchObject({ status: 'available', rows: [{ id: 'video', state: 'COMPLETED', steps: [3, 1], confirmed: 2, total: 2 }, { id: 'publication', state: 'WAITING_PROVIDER', confirmed: 0, pending: 1 }] });
});
it('retains conflicting duplicate evidence and never borrows evidence from another requirement', () => {
  const coverage = { requirements: [requirement, { ...requirement, id: 'second', steps: [2] }] };
  const rows = [success, { ...success, executionState: 'failed', completionSatisfied: false }];
  for (const evidence of [rows, [...rows].reverse()]) expect(requirementOutcomes('completed', 2, coverage, evidence).rows).toMatchObject([{ state: 'BLOCKED', uncertain: 1 }, { state: 'BLOCKED', confirmed: 0 }]);
});
it('labels prior answers as historical rather than freshly confirmed business outcomes', () => {
  expect(requirementOutcomes('completed', 0, { requirements: [{ ...requirement, resolution: 'answered', steps: [], evidenceCallIds: ['read-1'] }] }, []).rows[0]).toMatchObject({ state: 'ANSWERED', confirmed: 0, total: 0, note: expect.stringContaining('nu au fost recitite') });
});
it.each(['unsupported', 'needs_clarification'])('keeps %s distinct from a failed execution', resolution => {
  expect(requirementOutcomes('completed', 0, { requirements: [{ ...requirement, resolution, steps: [] }] }, []).rows[0]).toMatchObject({ state: resolution === 'unsupported' ? 'UNSUPPORTED' : 'NEEDS_CLARIFICATION', failed: 0 });
});
it.each(['paused', 'cancelled'])('preserves %s with evidence counts', status => {
  expect(requirementOutcomes(status, 1, { requirements: [requirement] }, [success]).rows[0]).toMatchObject({ state: status.toUpperCase(), confirmed: 1 });
});
it.each([
  {}, { requirements: [] },
  { requirements: [requirement, requirement] },
  { requirements: [{ ...requirement, steps: [2] }] },
  { requirements: [{ ...requirement, steps: [1, 1] }] },
  { requirements: [{ ...requirement, steps: [] }] },
  { requirements: [{ ...requirement, resolution: 'answered' }] },
  { requirements: [{ ...requirement, resolution: 'answered', steps: [] }] },
  { requirements: [{ ...requirement, resolution: 'answered', steps: [], evidenceCallIds: ['read-1'] }] },
])('returns no falsely confirmed requirement for invalid coverage %j', coverage => {
  expect(requirementOutcomes('completed', 1, coverage, [success])).toMatchObject({ status: 'invalid', rows: [] });
});
it('keeps legacy coverage absent and does not mutate saved coverage or evidence', () => {
  expect(requirementOutcomes('completed', 1, undefined, [success])).toMatchObject({ status: 'missing', rows: [] });
  const coverage = { requirements: [requirement] }, evidence = [success];
  const before = structuredClone({ coverage, evidence });
  requirementOutcomes('completed', 1, coverage, evidence);
  expect({ coverage, evidence }).toEqual(before);
});
it('waits for approval before execution and preserves mixed waits within one requirement', () => {
  expect(requirementOutcomes('pending', 1, { requirements: [requirement] }, []).rows[0].state).toBe('AWAITING_APPROVAL');
  expect(requirementOutcomes('completed', 2, { requirements: [{ ...requirement, steps: [1, 2] }] }, [{ step: 1, executionState: 'failed' }, { step: 2, executionState: 'queued', watchable: true }]).rows[0]).toMatchObject({ state: 'WAITING_PROVIDER', failed: 1, pending: 1 });
});
