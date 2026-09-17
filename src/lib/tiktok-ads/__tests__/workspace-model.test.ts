import { describe, expect, it } from 'vitest';
import { accountTimeToUtc, buildAdInputs, emptyAdDraft, reportingRows, rowsFor, schemaInput, schemaMissing } from '../workspace-model';
import type { JsonSchema } from '../types';

const object = (keys: string[]): JsonSchema => ({ type: 'object', properties: Object.fromEntries(keys.map(key => [key, { type: 'string' }])) });
describe('TikTok workspace mapping', () => {
  it('converts the advertiser schedule to UTC across seasons', () => {
    expect(accountTimeToUtc('2026-09-17T12:00', 'Europe/Bucharest')).toBe('2026-09-17 09:00:00');
    expect(accountTimeToUtc('2026-12-17T12:00', 'Europe/Bucharest')).toBe('2026-12-17 10:00:00');
    expect(accountTimeToUtc('2026-09-17T12:00', 'Asia/Kolkata')).toBe('2026-09-17 06:30:00');
  });
  it('rejects ambiguous, missing, invalid dates and unknown timezones', () => {
    expect(() => accountTimeToUtc('2026-10-25T03:30', 'Europe/Bucharest')).toThrow();
    expect(() => accountTimeToUtc('2026-03-29T03:30', 'Europe/Bucharest')).toThrow();
    expect(() => accountTimeToUtc('2026-02-30T12:00', 'UTC')).toThrow();
    expect(() => accountTimeToUtc('2026-09-17T12:00', 'unknown')).toThrow();
  });
  it('promotes an existing post without requiring upload or campaign creation schemas', () => {
    const inputs = buildAdInputs({ ...emptyAdDraft, mode: 'post', adgroupId: 'group', postId: 'post', name: 'Home' }, { AD_CREATE: object(['adgroup_id', 'tiktok_item_id', 'ad_name']) });
    expect(inputs.ad).toEqual({ adgroup_id: 'group', tiktok_item_id: 'post', ad_name: 'Home' });
    expect(inputs.video).toEqual({});
  });
  it('maps video views and account-local schedule to TikTok values', () => {
    const inputs = buildAdInputs({ ...emptyAdDraft, objective: 'VIDEO_VIEWS', start: '2026-10-01T12:30', end: '2026-10-02T12:30', budget: '50.00' }, { AD_CREATE: object([]), CAMPAIGN_CREATE: object(['objective_type']), CREATIVE_UPLOAD: object([]), ADGROUP_CREATE: object(['optimization_goal', 'promotion_type', 'billing_event', 'schedule_start_time', 'schedule_end_time', 'budget']) });
    expect(inputs.adGroup).toEqual({ optimization_goal: 'ENGAGED_VIEW', billing_event: 'CPV', schedule_start_time: '2026-10-01 12:30:00', schedule_end_time: '2026-10-02 12:30:00', budget: '50.00' });
  });
  it('constructs native creative arrays using only discovered fields', () => {
    const schema: JsonSchema = { type: 'object', properties: { creatives: { type: 'array', items: { type: 'object', required: ['ad_name', 'video_id'], properties: { ad_name: { type: 'string' }, video_id: { type: 'string' } } } } } };
    const result = schemaInput(schema, { ad_name: 'Property', unsupported: 'ignored' });
    expect(result).toEqual({ creatives: [{ ad_name: 'Property' }] });
    expect(schemaMissing(schema, result)).toEqual(['creatives.video_id']);
    expect(schemaMissing(schema, result, ['video_id'])).toEqual([]);
  });
  it('does not lose a rich resource when a nested object repeats its ID', () => {
    expect(rowsFor({ data: { list: [{ ad_id: 'a', ad_name: 'Home', operation_status: 'DISABLE', metadata: { ad_id: 'a' } }] } }, 'ad')).toMatchObject([{ id: 'a', name: 'Home', status: 'DISABLE' }]);
  });
  it('flattens report dimensions and metrics exactly once', () => {
    expect(reportingRows({ data: { list: [{ dimensions: { ad_id: 'a', stat_time_day: '2026-09-01' }, metrics: { spend: '2.5', conversion: '3' } }] } })).toEqual([{ ad_id: 'a', stat_time_day: '2026-09-01', spend: '2.5', conversion: '3' }]);
  });
  it('fails closed without a discovered schema', () => { expect(() => schemaInput(undefined, {})).toThrow(); });
});
