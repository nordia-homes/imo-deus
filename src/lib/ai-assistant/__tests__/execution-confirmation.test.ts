import { expect, it } from 'vitest';
import { viewingConfirmation, executionConfirmation } from '../execution-confirmation';
it('confirms committed task state and time without confirming proposals', () => {
  expect(executionConfirmation([{ kind: 'create_task', result: { taskId: 't', description: 'Sună-l pe Andrei', status: 'open', dueDate: '2026-10-09T07:00:00Z', startTime: '10:00' } }])).toContain('2026-10-09, 10:00, ora Bucureștiului');
  expect(executionConfirmation([{ kind: 'update_task', result: { taskId: 't', status: 'completed' } }])).toContain('Task finalizat');
  expect(executionConfirmation([{ kind: 'create_task', taskId: 't' }])).toBe('');
});
it('confirms the saved viewing with buyer, property and Bucharest time', () => {
  const result = viewingConfirmation([{ kind: 'schedule_viewing', result: { viewingId: 'v', viewingDate: '2030-01-01T05:30:00Z', propertyTitle: 'Cișmigiu', contactName: 'Matei Alin' } }]);
  expect(result).toContain('07:30'); expect(result).toContain('Cișmigiu'); expect(result).toContain('Matei Alin'); expect(result).toContain('ID: v');
});
it('does not confirm proposals or unrelated receipts', () => {
  expect(viewingConfirmation([{ kind: 'schedule_viewing', viewingDate: '2030-01-01T05:30:00Z' }, { kind: 'create_contact', result: { contactId: 'c' } }])).toBe('');
});

it.each([['scheduled', 'actualizată'], ['completed', 'efectuată'], ['cancelled', 'anulată']])('confirms committed viewing state %s', (status, label) => {
  expect(executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2030-01-01T05:30:00Z', status } }])).toContain(`Vizionare ${label}`);
});
