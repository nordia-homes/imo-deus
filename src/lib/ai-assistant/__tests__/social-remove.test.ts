import { expect, it } from 'vitest';
import { socialRemoveAction, socialRemoveRequest, socialRemoveExecutionPrompt } from '../social-remove';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
it('distinguishes full-post confirmation from selecting one destination', () => {
  expect(socialRemoveRequest('Șterge postarea numai după confirmare.')).toBe('post');
  expect(socialRemoveRequest('Elimină doar destinația selectată.')).toBe('destination');
  expect(socialRemoveRequest('Publică postarea după approval.')).toBeNull();
  const history = [{ role: 'assistant', cards: [{ source: 'socialRemoveRequest', rows: [{ prompt: 'Șterge postarea numai după confirmare.' }] }] }] as any;
  expect(socialRemoveExecutionPrompt('Confirmă ștergerea postării sociale: P', history)).toBe('Șterge postarea numai după confirmare.');
  expect(socialRemoveExecutionPrompt('Elimină destinația socială: P | C', history)).toBe('Elimină destinația socială: P | C');
  expect(socialRemoveExecutionPrompt('Confirmă ștergerea postării sociale: P', [])).toBe('Confirmă ștergerea postării sociale: P');
});
it('authorizes only strict remote deletion tied to the selected external ID', () => {
  const action = { kind: 'existing_operation', operation: 'social_destination_remove', params: { postId: 'P', connectionId: 'C' }, query: {}, body: { remote: true, expectedExternalId: '123_456' } } as const;
  expect(socialRemoveAction(action)).toBe(true); expect(explicitlyRequestedSafeAction(action, 'Elimină doar destinația selectată.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Arată-mi dashboardul social.')).toBe(false);
  expect(socialRemoveAction({ ...action, body: { ...action.body, remote: false } })).toBe(false);
  expect(socialRemoveAction({ ...action, body: { ...action.body, expectedExternalId: '456' } })).toBe(false);
});
it('confirms only the destination backed by a persisted deletion receipt', () => {
  const receipt = { operation: 'social_destination_remove', executionState: 'succeeded', deletionConfirmed: true, postId: 'P', connectionId: 'C', externalId: '123_456' };
  const text = executionConfirmation([{ result: receipt }]); expect(text).toContain('123_456 din contul C'); expect(text).not.toContain('toate');
  expect(executionConfirmation([{ result: { ...receipt, deletionConfirmed: false } }])).not.toContain('Meta a confirmat');
});