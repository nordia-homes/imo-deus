import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { reviewActivity } from '../today-review';
const now = new Date('2026-10-08T10:00:00Z'); // 13:00 Bucharest
const task = { agentId: 'a', status: 'open', dueDate: '2026-10-08' };
const viewing = { agentId: 'a', status: 'scheduled', viewingDate: '2026-10-08T09:00:00Z', duration: 60 };
it('distinguishes elapsed task hours from date-only pending work', () => {
  expect(reviewActivity('tasks', task, 'a', now)).toMatchObject({ category: 'untimed_task', at: null });
  expect(reviewActivity('tasks', { ...task, startTime: '12:59' }, 'a', now)).toMatchObject({ category: 'overdue_task' });
  expect(reviewActivity('tasks', { ...task, startTime: '13:00' }, 'a', now).state).toBe('excluded');
  expect(reviewActivity('tasks', { ...task, startTime: '14:00' }, 'a', now).state).toBe('excluded');
});
it('uses the Bucharest date and ISO clock for legacy tasks', () => {
  expect(reviewActivity('tasks', { ...task, dueDate: '2026-10-07T21:30:00Z' }, 'a', now)).toMatchObject({ category: 'overdue_task' });
  expect(reviewActivity('tasks', { ...task, dueDate: '2026-10-08T20:59:00Z' }, 'a', now).state).toBe('excluded');
  expect(reviewActivity('tasks', { ...task, dueDate: '2026-10-08T21:01:00Z' }, 'a', now).state).toBe('excluded');
});
it('does not classify ongoing viewings or WhatsApp confirmations as completed visits', () => {
  expect(reviewActivity('viewings', viewing, 'a', now)).toMatchObject({ category: 'viewing_outcome_missing' });
  expect(reviewActivity('viewings', { ...viewing, duration: 61 }, 'a', now).state).toBe('excluded');
  expect(reviewActivity('viewings', { ...viewing, confirmations: { client: { status: 'confirmed' } } }, 'a', now)).toMatchObject({ category: 'viewing_outcome_missing' });
});
it.each(['completed', 'cancelled'])('excludes %s appointments and other agents', status => {
  expect(reviewActivity('viewings', { ...viewing, status }, 'a', now).state).toBe('excluded');
  expect(reviewActivity('viewings', viewing, 'colleague', now).state).toBe('excluded');
  expect(reviewActivity('tasks', { ...task, status: 'completed' }, 'a', now).state).toBe('excluded');
});
it('does not mix previous days into today or call invalid data a clean calendar', () => {
  expect(reviewActivity('tasks', { ...task, dueDate: '2026-10-07' }, 'a', now).state).toBe('excluded');
  for (const dueDate of [null, 'invalid', '2026-02-30', '2026-10-08T12:00:00']) expect(reviewActivity('tasks', { ...task, dueDate }, 'a', now).state).toBe('invalid');
  expect(reviewActivity('tasks', { ...task, startTime: '25:00' }, 'a', now).state).toBe('invalid');
  for (const duration of [0, -1, '60', NaN]) expect(reviewActivity('viewings', { ...viewing, duration }, 'a', now).state).toBe('invalid');
});
it('does not guess a clock during the repeated hour in Bucharest', () => {
  expect(reviewActivity('tasks', { ...task, dueDate: '2026-10-25', startTime: '03:30' }, 'a', new Date('2026-10-25T10:00:00Z')).state).toBe('invalid');
});
it('preserves an explicit instant when a task supplies the repeated local clock', () => {
  const result = reviewActivity('tasks', { ...task, dueDate: '2026-10-25T00:30:00Z', startTime: '03:30' }, 'a', new Date('2026-10-25T10:00:00Z'));
  expect(result).toMatchObject({ category: 'overdue_task', at: '2026-10-25T00:30:00.000Z' });
});
