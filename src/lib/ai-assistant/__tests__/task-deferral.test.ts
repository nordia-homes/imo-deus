import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { deferralBlocked } from '../task-deferral';
import { assertTaskEdit } from '../task-edit';
const now = new Date('2026-10-08T10:00:00Z');
const task = { agentId: 'a', status: 'open', dueDate: '2026-10-11' };
it('protects urgent tasks and viewings on the Bucharest day', () => {
  expect(deferralBlocked(task, null, null, null, 'a', now)).toBeNull();
  expect(deferralBlocked({ ...task, contactId: 'c' }, { priority: 'Ridicată' }, null, null, 'a', now)).toBe('Task urgent.');
  expect(deferralBlocked({ ...task, viewingId: 'v' }, null, null, { viewingDate: '2026-10-07T21:30:00Z' }, 'a', now)).toContain('vizionări de azi');
});
it('does not treat incomplete relationships, completed tasks or a guard alone as editable', () => {
  expect(deferralBlocked({ ...task, viewingId: 'v' }, null, null, { viewingDate: 'invalid' }, 'a', now)).toContain('lipsă');
  expect(deferralBlocked({ ...task, viewingId: 'missing' }, null, null, null, 'a', now)).toContain('lipsă');
  expect(deferralBlocked({ ...task, status: 'completed' }, null, null, null, 'a', now)).not.toBeNull();
  expect(() => assertTaskEdit({ kind: 'update_task', taskId: 't', deferNonUrgent: true })).toThrow();
});
