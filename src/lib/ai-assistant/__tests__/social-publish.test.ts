import { expect, it } from 'vitest';
import { socialPublishAction, socialPublishRequest, socialPublishExecutionPrompt } from '../social-publish';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
it('requires explicit publication intent and a strict action', () => {
  const action = { kind: 'existing_operation', operation: 'social_publish', params: { postId: 'p' }, query: {}, body: { immediate: true, expectedRevision: 'a'.repeat(64) } } as const;
  expect(socialPublishRequest('Publică postarea după approval.')).toBe(true);
  expect(socialPublishAction(action)).toBe(true); expect(explicitlyRequestedSafeAction(action, 'Publică postarea după approval.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Programează postarea prin canalul suportat.')).toBe(false);
  expect(socialPublishAction({ ...action, body: { ...action.body, scheduledAt: '2027-01-01T00:00:00Z' } })).toBe(false);
  expect(socialPublishExecutionPrompt('Publică postarea socială: p', [])).toBe('Publică postarea socială: p');
});
it('distinguishes publication, processing and uncertain provider effects', () => {
  const text = (extra: Record<string, unknown>) => executionConfirmation([{ result: { operation: 'social_publish', postId: 'p', immediate: true, ...extra } }]);
  expect(text({ publicationConfirmed: true, executionState: 'succeeded', externalIds: ['123_456'] })).toContain('ID publicare: 123_456');
  expect(text({ publicationConfirmed: false, executionState: 'processing' })).toContain('workerul continuă automat');
  expect(text({ publicationConfirmed: false, executionState: 'unknown' })).not.toContain('Meta a confirmat');
});