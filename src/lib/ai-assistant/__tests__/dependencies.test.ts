import { describe, expect, it } from 'vitest';
import { actionSchema } from '../contracts';
import { resolveAction } from '../dependencies';
describe('compound action dependencies', () => {
  it.each([['propertyId', 'contactId'], ['contactId', 'propertyId'], ['assetId', 'projectId'], ['campaignId', 'draftId']])('refuses binding %s from a differently typed %s receipt', (field, source) => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_post_draft', body: { [field]: `@step:1:${source}` } });
    expect(() => resolveAction(action, [{ step: 1, result: { [source]: 'same-id' } }])).toThrow('Tipul identificatorului');
  });
  it.each([2, 0, '1'])('refuses an out-of-order or malformed saved step number %s', step => {
    const action = actionSchema.parse({ kind: 'update_contact', contactId: '@step:1:contactId', patch: { status: 'Contactat' } });
    expect(() => resolveAction(action, [{ step, result: { contactId: 'c' } }])).toThrow('numărului pasului');
  });
  it.each(['x'.repeat(181), '@step:2:contactId', 'bad/id'])('refuses an invalid or unresolved receipt identifier', id => {
    const action = actionSchema.parse({ kind: 'update_contact', contactId: '@step:1:contactId', patch: { status: 'Contactat' } });
    expect(() => resolveAction(action, [{ step: 1, result: { contactId: id } }])).toThrow('identificatorul');
  });
  it('retains valid asset arrays and binds only the requested previous step without changing the proposal', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_project_create', body: { sourceAssetIds: ['@step:2:assetId', '@step:1:assetId'] } });
    expect(resolveAction(action, [{ step: 1, result: { assetId: 'first' } }, { step: 2, result: { assetId: 'second' } }])).toMatchObject({ body: { sourceAssetIds: ['second', 'first'] } });
    expect(action).toMatchObject({ body: { sourceAssetIds: ['@step:2:assetId', '@step:1:assetId'] } });
  });
  it('binds a property list using property IDs only and preserves literal IDs and order', () => {
    const action = actionSchema.parse({ kind: 'recommend_properties', contactId: 'c', propertyIds: ['existing', '@step:1:propertyId'] });
    expect(resolveAction(action, [{ step: 1, result: { propertyId: 'new-property' } }])).toMatchObject({ propertyIds: ['existing', 'new-property'] });
    const wrong = actionSchema.parse({ ...action, propertyIds: ['@step:1:contactId'] });
    expect(() => resolveAction(wrong, [{ step: 1, result: { contactId: 'c' } }])).toThrow('Tipul identificatorului');
  });
  it('rejects mismatched step numbers for verified video and generated scripts too', () => {
    const video = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_asset_create', body: { url: '@step:1:videoUrl' } });
    const script = actionSchema.parse({ kind: 'existing_operation', operation: 'video_create', params: { propertyId: 'p' }, body: { aiPresenterScript: '@step:1:script' } });
    const prior = [{ step: 2, outputs: { videoUrl: 'https://fixture.example/video.mp4' }, result: { script: 'Text verificat' } }];
    expect(() => resolveAction(video, prior)).toThrow('numărului pasului');
    expect(() => resolveAction(script, prior)).toThrow('numărului pasului');
  });
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
