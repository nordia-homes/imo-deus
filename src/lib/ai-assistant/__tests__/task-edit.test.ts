import { expect, it } from 'vitest';
import { assertTaskEdit } from '../task-edit';
it('rejects an ID/revision without any actual task change', () => {
  expect(() => assertTaskEdit({ kind: 'update_task', taskId: 't', expectedUpdatedAt: null })).toThrow('dueDate');
});
it('accepts rescheduling, state changes and explicit field clears', () => {
  expect(() => assertTaskEdit({ kind: 'update_task', taskId: 't', dueDate: '2030-01-01T09:00:00Z', startTime: '11:00' })).not.toThrow();
  expect(() => assertTaskEdit({ kind: 'update_task', taskId: 't', status: 'completed' })).not.toThrow();
  expect(() => assertTaskEdit({ kind: 'update_task', taskId: 't', contactId: null })).not.toThrow();
});
