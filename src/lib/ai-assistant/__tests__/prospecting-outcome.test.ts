import { expect, it } from 'vitest';
import { prospectingOutcome } from '../prospecting-outcome';

it.each(['queued', 'available', 'failed', 'awaiting_connection'])('confirms only list membership for add with phone status %s', status => {
  const result = prospectingOutcome('add', { active: true }, { isFavoriteActive: true, phoneExtractionStatus: status });
  expect(result).toMatchObject({ executionState: 'succeeded', businessStatus: 'added_to_prospecting', completionSatisfied: true, watchable: false });
  expect(result.note).toContain('nu confirmă');
});
it.each([{}, { active: false }])('does not infer successful add from an existing favorite without the matching receipt', receipt => {
  expect(prospectingOutcome('add', receipt, { isFavoriteActive: true }).completionSatisfied).toBe(false);
});
it('does not hide a concurrent removal or re-addition', () => {
  expect(prospectingOutcome('add', { active: true }, { isFavoriteActive: false }).completionSatisfied).toBe(false);
  expect(prospectingOutcome('remove', { active: false }, { isFavoriteActive: true }).completionSatisfied).toBe(false);
  expect(prospectingOutcome('remove', { active: false }, { isFavoriteActive: false }).businessStatus).toBe('removed_from_prospecting');
});
it.each(['queued', 'pending', 'processing', 'running', 'retrying'])('waits without retrying for phone status %s', status => {
  expect(prospectingOutcome('retry', { active: true }, { isFavoriteActive: true, phoneExtractionStatus: status })).toMatchObject({ executionState: 'queued', completionSatisfied: false, watchable: true });
});
it.each(['failed', 'error', 'cancelled', 'unavailable', 'awaiting_connection', 'not_required', 'unknown'])('does not certify retrieval for phone status %s', status => {
  expect(prospectingOutcome('retry', { active: true }, { isFavoriteActive: true, phoneExtractionStatus: status })).toMatchObject({ completionSatisfied: false, watchable: false });
});
it('requires a usable phone without exposing it in outcome evidence', () => {
  const row = { isFavoriteActive: true, phoneExtractionStatus: 'available', ownerPhone: '0722123456' };
  const result = prospectingOutcome('retry', { active: true }, row);
  expect(result.completionSatisfied).toBe(true);
  expect(JSON.stringify(result)).not.toContain(row.ownerPhone);
  expect(prospectingOutcome('retry', { active: true }, { ...row, ownerPhone: 'invalid' }).completionSatisfied).toBe(false);
});
