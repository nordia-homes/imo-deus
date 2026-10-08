import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { taskPriority } from '../task-priorities';
const now = new Date('2026-10-08T10:00:00Z');
const task = { dueDate: '2026-10-09', contactId: 'c', propertyId: 'p' };
it('requires an offer on this property and ignores rejected offers', () => {
  const property = { status: 'Activ' };
  expect(taskPriority(task, { offers: [null, { propertyId: 'other', status: 'Acceptată' }] }, property, null, now).impact).toBe(0);
  expect(taskPriority(task, { offers: [{ propertyId: 'p', status: 'Refuzată' }] }, property, null, now).impact).toBe(0);
  expect(taskPriority(task, { offers: [{ propertyId: 'p', status: 'Acceptată' }] }, property, null, now).impact).toBe(50);
});
it('does not promote archived/lost clients or invent evidence for missing relations', () => {
  expect(taskPriority(task, { status: 'Pierdut', priority: 'Ridicată' }, null, null, now).urgent).toBe(false);
  expect(taskPriority(task, { archivedAt: '2026-01-01', status: 'În negociere' }, null, null, now).impact).toBe(0);
  expect(taskPriority(task, null, null, null, now).missingRelations).toEqual(['contact', 'property']);
});
it('keeps deadline urgency distinct from commercial impact and checks viewing relationships', () => {
  expect(taskPriority({ ...task, dueDate: '2026-10-07' }, null, null, null, now)).toMatchObject({ urgent: true, impact: 0 });
  const viewing = { status: 'completed', viewingDate: '2026-10-07T10:00:00Z', contactId: 'other', propertyId: 'p' };
  expect(taskPriority(task, { status: 'Nou' }, { status: 'Activ' }, viewing, now).impact).toBe(0);
  expect(taskPriority(task, { status: 'Nou' }, { status: 'Activ' }, { ...viewing, contactId: 'c' }, now).impact).toBe(20);
});
