import { describe, expect, it } from 'vitest';
import { actionSchema } from '../contracts';
import { resolveAction } from '../dependencies';
describe('compound action dependencies', () => {
  it('uses only a confirmed earlier contact id', () => {
    const action = actionSchema.parse({ kind: 'schedule_viewing', contactId: '@step:1:contactId', propertyId: 'p', viewingDate: '2027-01-01T12:00:00Z' });
    expect(resolveAction(action, [{ result: { contactId: 'new-contact' } }])).toMatchObject({ contactId: 'new-contact' });
  });
  it('rejects future, missing and unrelated result fields', () => {
    const make = (id: string) => actionSchema.parse({ kind: 'update_contact', contactId: id, patch: { status: 'Contactat' } });
    expect(() => resolveAction(make('@step:2:contactId'), [{ result: { contactId: 'c' } }])).toThrow();
    expect(() => resolveAction(make('@step:1:contactId'), [{ result: { queued: true } }])).toThrow();
    expect(() => resolveAction(make('@step:1:secret'), [{ result: { secret: 'c' } }])).toThrow();
  });
  it('does not substitute arbitrary text with result data', () => {
    expect(resolveAction(actionSchema.parse({ kind: 'create_task', description: '@step:1:contactId', dueDate: '2027-01-01T12:00:00Z' }), [{ result: { contactId: 'c' } }])).toMatchObject({ description: '@step:1:contactId' });
  });
});
