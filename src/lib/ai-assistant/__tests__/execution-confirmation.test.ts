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

it('confirms deletion only from its committed receipt', () => {
  expect(executionConfirmation([{ kind: 'delete_viewing', result: { id: 'v', deleted: true } }])).toBe('Vizionare ștearsă. ID: v.');
  expect(executionConfirmation([{ kind: 'delete_viewing', result: { id: 'v', deleted: false } }])).toBe('');
});
it('confirms the appended note without claiming a new scheduling', () => {
  const result = executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2026-01-01T10:00:00Z', status: 'scheduled', appendedNote: 'Revine cu familia.' } }]);
  expect(result).toContain('Notă adăugată'); expect(result).toContain('Revine cu familia.'); expect(result).not.toContain('programată');
});

it('confirms both cancellation and the appended reason from the same receipt', () => {
  const result = executionConfirmation([{ kind: 'update_viewing', result: { viewingId: 'v', viewingDate: '2027-01-01T10:00:00Z', status: 'cancelled', appendedNote: 'Anulată de client.' } }]);
  expect(result).toContain('Vizionare anulată'); expect(result).toContain('Notă adăugată'); expect(result).toContain('Anulată de client.');
});
