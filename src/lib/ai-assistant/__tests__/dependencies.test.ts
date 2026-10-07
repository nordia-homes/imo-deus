import { describe, expect, it } from 'vitest';
import { actionSchema } from '../contracts';
import { resolveAction } from '../dependencies';
describe('compound action dependencies', () => {
  it('pins a future render to the saved project version without mutating its approval payload', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_render', params: { projectId: '@step:1:projectId' } });
    expect(resolveAction(action, [{ result: { projectId: 'project', project: { id: 'project', version: 3 } } }])).toMatchObject({ params: { projectId: 'project' }, body: { expectedVersion: 3 } });
    expect(action).toMatchObject({ params: { projectId: '@step:1:projectId' }, body: {} });
  });
  it.each([undefined, { id: 'other', version: 1 }, { id: 'project' }, { id: 'project', version: 0 }])('refuses unconfirmed future render version: %j', project => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_render', params: { projectId: '@step:1:projectId' } });
    expect(() => resolveAction(action, [{ result: { projectId: 'project', project } }])).toThrow('Versiunea');
  });
  it('does not replace a conflicting explicitly approved version', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_render', params: { projectId: '@step:1:projectId' }, body: { expectedVersion: 1 } });
    expect(() => resolveAction(action, [{ result: { projectId: 'project', project: { id: 'project', version: 2 } } }])).toThrow('Versiunea');
  });
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
