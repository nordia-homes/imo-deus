import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
vi.mock('../actions', () => ({}));
import { agendaMatches, taskDueDay } from '../task-agenda';
import { explicitlyRequestedSafeAction, requestAuthorizedCrmAction, safeAutonomousAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
it('interprets date-only and ISO deadlines by the Bucharest day', () => {
  expect(taskDueDay('2026-10-08')).toBe('2026-10-08');
  expect(taskDueDay('2026-10-07T21:30:00Z')).toBe('2026-10-08');
  expect(taskDueDay('2026-10-25T22:30:00Z')).toBe('2026-10-26');
  expect(taskDueDay('2026-02-30')).toBeNull();
  expect(taskDueDay('2026-10-08T17:00:00')).toBeNull();
});
it('keeps old overdue tasks, excludes completed/colleagues, and treats today separately', () => {
  const now = new Date('2026-10-08T10:00:00Z'), row = { agentId: 'a', status: 'open', dueDate: '2026-07-01' };
  expect(agendaMatches(row, 'overdue', 'a', now)).toBe(true);
  expect(agendaMatches({ ...row, status: 'completed' }, 'overdue', 'a', now)).toBe(false);
  expect(agendaMatches(row, 'overdue', 'b', now)).toBe(false);
  expect(agendaMatches({ ...row, dueDate: '2026-10-08T06:00:00Z' }, 'overdue', 'a', now)).toBe(false);
  expect(agendaMatches({ ...row, dueDate: '2026-10-08' }, 'today', 'a', now)).toBe(true);
});
it('keeps deletion under optional task policy and confirms only a committed deletion', () => {
  const action = { kind: 'delete_task' as const, taskId: 't' };
  expect(safeAutonomousAction(action)).toBe(true);
  expect(requestAuthorizedCrmAction(action)).toBe(false);
  expect(explicitlyRequestedSafeAction(action, 'Șterge taskul duplicat.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Nu șterge taskul duplicat.')).toBe(false);
  expect(executionConfirmation([{ kind: 'delete_task', result: { id: 't', deleted: true } }])).toContain('Task șters');
  expect(executionConfirmation([{ kind: 'delete_task', result: { id: 't', deleted: false } }])).toBe('');
});
