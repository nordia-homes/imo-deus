import { describe, expect, it } from 'vitest';
import { operationResult } from '../operation-result';
import { resolveAction } from '../dependencies';
import { actionSchema } from '../contracts';
describe('confirmed domain result binding', () => {
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
