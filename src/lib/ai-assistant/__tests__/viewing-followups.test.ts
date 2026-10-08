import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { withoutFollowup } from '../viewing-followups';
import { requestAuthorizedCrmAction, explicitlyRequestedSafeAction } from '../autonomy';
vi.mock('../actions', () => ({}));
it('uses exact viewing links and the Bucharest day, including completed follow-ups', () => {
  const row = { status: 'completed', agentId: 'a', viewingDate: '2026-10-07T21:30:00Z' };
  const viewings = ['missing', 'open', 'done'].map(id => ({ ...row, id }));
  const tasks = [{ viewingId: 'open', status: 'open' }, { viewingId: 'done', status: 'completed' }];
  expect(withoutFollowup(viewings, tasks, 'a', new Date('2026-10-09T10:00:00Z'), '2026-10-08').map(row => row.id)).toEqual(['missing']);
  expect(withoutFollowup(viewings, tasks, 'a', new Date('2026-10-09T10:00:00Z'), '2026-10-07')).toEqual([]);
});
it('authorizes only linked viewing follow-ups by request and rejects negation/preview', () => {
  const action = { kind: 'create_task' as const, viewingId: 'v', description: 'Follow-up', dueDate: '2026-10-08' };
  expect(requestAuthorizedCrmAction(action)).toBe(true);
  expect(requestAuthorizedCrmAction({ ...action, viewingId: undefined })).toBe(false);
  expect(explicitlyRequestedSafeAction(action, 'Creează follow-up pentru vizionări.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Nu crea follow-up pentru vizionări.')).toBe(false);
  expect(explicitlyRequestedSafeAction(action, 'Arată un preview, apoi creează follow-up.')).toBe(false);
});
