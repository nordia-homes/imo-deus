import { describe, expect, it } from 'vitest';
import { operationResult } from '../operation-result';
import { resolveAction } from '../dependencies';
import { actionSchema } from '../contracts';
import { unconfirmedOperationResult } from '../operation-error';
describe('confirmed domain result binding', () => {
  it('blocks an ambiguous outreach dispatch and a nested failed job', () => {
    const result = operationResult('outreach_start', { call: { id: 'c', status: 'calling', providerErrorCode: 'vapi_create_unknown' } });
    expect(result.executionState).toBe('unknown');
    expect(result.note).toContain('incert');
    expect(unconfirmedOperationResult(result)).toBe(true);
    expect(unconfirmedOperationResult(operationResult('video_create', { job: { status: 'failed' } }))).toBe(true);
  });
  it('distinguishes queued requests, drafts, observed reads and verified final state', () => {
    expect(operationResult('video_create', { job: { status: 'queued' } })).toMatchObject({ executionState: 'queued' });
    expect(operationResult('meta_campaign_draft', { draft: { status: 'ready' } })).toMatchObject({ executionState: 'draft' });
    expect(operationResult('message_send', { status: 'delivered' })).toMatchObject({ executionState: 'succeeded', businessStatus: 'delivered' });
    expect(operationResult('read', { rows: [] }, true)).toMatchObject({ executionState: 'observed' });
    expect(operationResult('write', { ok: true })).toMatchObject({ executionState: 'accepted_unverified' });
  });
  it.each([['meta_campaign_draft', 'campaign', 'campaignId'], ['tiktok_post_draft', 'draft', 'draftId'], ['video_create', 'job', 'jobId'], ['sales_template_create', 'template', 'templateId']])('binds only an actual returned ID for %s', (operation, source, alias) => {
    const result = operationResult(operation, { [source]: { id: 'confirmed', accessToken: 'secret' } });
    expect(result[alias]).toBe('confirmed'); expect(result[source]).toEqual({ id: 'confirmed' });
    expect(operationResult(operation, { [source]: {} })).not.toHaveProperty(alias);
  });
  it('supports a TikTok draft dependency without inventing an ID', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_post_publish', params: { draftId: '@step:1:draftId' }, body: {}, query: {} });
    expect(resolveAction(action, [{ result: operationResult('tiktok_post_draft', { draft: { id: 'draft' } }) }])).toMatchObject({ params: { draftId: 'draft' } });
  });
  it('binds confirmed Studio assets and projects across import, project and render steps', () => {
    const asset = { result: operationResult('tiktok_studio_asset_create', { asset: { id: 'asset' } }) };
    const project = { result: operationResult('tiktok_studio_project_create', { project: { id: 'project' } }) };
    const create = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_project_create', params: {}, query: {}, body: { sourceAssetIds: ['@step:1:assetId'] } });
    expect(resolveAction(create, [asset])).toMatchObject({ body: { sourceAssetIds: ['asset'] } });
    const render = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_render', params: { projectId: '@step:2:projectId' }, body: {}, query: {} });
    expect(resolveAction(render, [asset, project])).toMatchObject({ params: { projectId: 'project' } });
    expect(() => resolveAction(render, [asset])).toThrow();
    expect(() => resolveAction(create, [{ result: { assetId: 'agency/other' } }])).toThrow();
  });
  it('reports a committed property attachment without treating arbitrary acceptance as success', () => {
    expect(operationResult('file_apply', { status: 'attached', mutationRevision: { resource: 'properties', id: 'p', before: null, after: 'now' } })).toMatchObject({ executionState: 'succeeded', businessStatus: 'attached' });
    expect(operationResult('file_apply', { status: 'attached' }).executionState).toBe('accepted_unverified');
  });
  it('binds the already generated script to a video job, without another model choice', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'video_create', params: { propertyId: 'p' }, query: {}, body: { aiPresenterScript: '@step:1:script' } });
    expect(resolveAction(action, [{ result: { script: 'Scenariul confirmat.' } }])).toMatchObject({ body: { aiPresenterScript: 'Scenariul confirmat.' } });
    expect(() => resolveAction(action, [])).toThrow();
  });
  it('blocks an unreviewable outbound message containing future text references', () => {
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conv' }, query: {}, body: { text: 'Ofertă @step:1:script' } });
    expect(() => resolveAction(action, [{ result: { script: 'Unreviewed text' } }])).toThrow('concreți');
  });
});
