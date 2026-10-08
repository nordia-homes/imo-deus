import { expect, it } from 'vitest';
import { viewingConfirmation } from '../execution-confirmation';
it('confirms the saved viewing with buyer, property and Bucharest time', () => {
  const result = viewingConfirmation([{ kind: 'schedule_viewing', result: { viewingId: 'v', viewingDate: '2030-01-01T05:30:00Z', propertyTitle: 'Cișmigiu', contactName: 'Matei Alin' } }]);
  expect(result).toContain('07:30'); expect(result).toContain('Cișmigiu'); expect(result).toContain('Matei Alin'); expect(result).toContain('ID: v');
});
it('does not confirm proposals or unrelated receipts', () => {
  expect(viewingConfirmation([{ kind: 'schedule_viewing', viewingDate: '2030-01-01T05:30:00Z' }, { kind: 'create_contact', result: { contactId: 'c' } }])).toBe('');
});
