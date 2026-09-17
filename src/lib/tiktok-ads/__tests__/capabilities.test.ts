import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_CLASSIFICATION,
  OPERATION_CLASS,
  hashToolSchema,
  resolveTikTokCapabilities,
} from '../capabilities';
import { TIKTOK_CAPABILITIES, type TikTokMcpTool } from '../types';

function tool(name: string, description: string, properties: Record<string, { type: string }> = {}, required: string[] = []): TikTokMcpTool {
  return { name, description, inputSchema: { type: 'object', properties, required } };
}

const officialShapeTools: TikTokMcpTool[] = [
  tool('advertiser_get', 'Get authorized advertiser ad accounts'),
  tool('advertiser_info', 'Get advertiser ad account details status', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
  tool('bc_ad_account_create', 'Create an ad account', { bc_id: { type: 'string' } }, ['bc_id']),
  tool('bc_balance_get', 'Get balance and billing status', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
  tool('/bc/asset/account/authorization/', 'Obtain TikTok account ad delivery authorization link', { advertiser_id: { type: 'string' } }),
  tool('/identity/get/', 'Get TikTok account delivery permission and authorization status', { advertiser_id: { type: 'string' } }),
  tool('identity_video_get', 'Get posts and video assets under identity', { advertiser_id: { type: 'string' } }),
  tool('video_upload', 'Upload a video', { advertiser_id: { type: 'string' }, video_url: { type: 'string' } }, ['advertiser_id', 'video_url']),
  tool('campaign_get', 'Get campaigns', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
  tool('campaign_create', 'Create a campaign', { advertiser_id: { type: 'string' }, campaign_name: { type: 'string' }, objective_type: { type: 'string' }, operation_status: { type: 'string' } }, ['advertiser_id', 'campaign_name', 'objective_type']),
  tool('campaign_update', 'Update a campaign', { advertiser_id: { type: 'string' }, campaign_id: { type: 'string' } }, ['advertiser_id', 'campaign_id']),
  tool('campaign_status_update', 'Update campaign operation status enable disable pause resume', { advertiser_id: { type: 'string' }, campaign_id: { type: 'string' }, operation_status: { type: 'string' } }),
  tool('adgroup_get', 'Get ad groups', { advertiser_id: { type: 'string' } }),
  tool('adgroup_create', 'Create an ad group', { advertiser_id: { type: 'string' }, campaign_id: { type: 'string' }, adgroup_name: { type: 'string' }, operation_status: { type: 'string' } }),
  tool('adgroup_update', 'Update an ad group', { advertiser_id: { type: 'string' }, adgroup_id: { type: 'string' } }),
  tool('adgroup_status_update', 'Update ad group operation status pause resume enable disable', { advertiser_id: { type: 'string' }, adgroup_id: { type: 'string' }, operation_status: { type: 'string' } }),
  tool('ad_get', 'Get ads', { advertiser_id: { type: 'string' } }),
  tool('ad_create', 'Create ads', { advertiser_id: { type: 'string' }, adgroup_id: { type: 'string' }, ad_name: { type: 'string' }, operation_status: { type: 'string' } }),
  tool('ad_update', 'Update ads', { advertiser_id: { type: 'string' }, ad_id: { type: 'string' } }),
  tool('ad_status_update', 'Update ad operation status pause resume enable disable', { advertiser_id: { type: 'string' }, ad_id: { type: 'string' }, operation_status: { type: 'string' } }),
  tool('ad_review_info', 'Get ad review info', { advertiser_id: { type: 'string' }, ad_id: { type: 'string' } }),
  tool('targeting_search', 'Search targeting interests and locations', { advertiser_id: { type: 'string' } }),
  tool('report_integrated_get', 'Run a synchronous report', { advertiser_id: { type: 'string' } }),
  tool('page_library_get', 'Get Instant Form page library and fields', { advertiser_id: { type: 'string' } }),
  tool('lead_get', 'Get and retrieve leads', { advertiser_id: { type: 'string' } }),
  tool('subscription_subscribe', 'Create a webhook subscription', { app_id: { type: 'string' } }),
  tool('account_verification_status', 'Get account verification status', { advertiser_id: { type: 'string' } }),
];

describe('TikTok capability registry', () => {
  it('recognizes exact ad endpoints even when official descriptions mention ad groups and campaigns', () => {
    const tools = officialShapeTools.map(candidate => candidate.name.startsWith('ad_') ? { ...candidate, description: `${candidate.description}. Manage ads within an ad group and campaign.` } : candidate);
    const matrix = new Map(resolveTikTokCapabilities(tools).map(item => [item.capability, item]));
    for (const capability of ['AD_READ', 'AD_CREATE', 'AD_UPDATE', 'AD_PAUSE', 'AD_RESUME'] as const) expect(matrix.get(capability)?.available).toBe(true);
    expect(matrix.get('SPARK_NEW_VIDEO_AD_ONLY')?.available).toBe(true);
  });
  it('classifies every registry capability exactly once', () => {
    expect(Object.keys(CAPABILITY_CLASSIFICATION).sort()).toEqual([...TIKTOK_CAPABILITIES].sort());
    expect(Object.keys(OPERATION_CLASS).sort()).toEqual([...TIKTOK_CAPABILITIES].sort());
    expect(CAPABILITY_CLASSIFICATION.ADVERTISER_PROVISION).toBe('EXTERNAL_APPROVAL_REQUIRED');
    expect(CAPABILITY_CLASSIFICATION.LEAD_FORM_CREATE).toBe('CURRENTLY_UNSUPPORTED');
  });

  it('derives the ads-only workflow from discovered official tool schemas', () => {
    const matrix = resolveTikTokCapabilities(officialShapeTools);
    const byCapability = new Map(matrix.map((item) => [item.capability, item]));
    expect(byCapability.get('CAMPAIGN_CREATE')?.available).toBe(true);
    expect(byCapability.get('SPARK_NEW_VIDEO_AD_ONLY')?.available).toBe(true);
    expect(byCapability.get('SPARK_EXISTING_POST')?.available).toBe(true);
    expect(byCapability.get('LEAD_FORM_CREATE')?.schemaStatus).toBe('unsupported');
    expect(byCapability.get('ADVERTISER_PROVISION')?.executionAllowed).toBe(false);
    expect(byCapability.get('EVENT_SUBSCRIBE')).toMatchObject({ available: true, executionAllowed: false });
    expect(byCapability.get('EVENT_SUBSCRIBE')?.reason).toMatch(/polling/i);
  });

  it('fails closed when a write schema changes', () => {
    const first = resolveTikTokCapabilities(officialShapeTools);
    const previous = new Map(first.map((item) => [item.capability, item]));
    const changed = officialShapeTools.map((candidate) => candidate.name === 'campaign_create'
      ? { ...candidate, inputSchema: { ...candidate.inputSchema, properties: { ...candidate.inputSchema.properties, new_required_field: { type: 'string' } }, required: [...(candidate.inputSchema.required || []), 'new_required_field'] } }
      : candidate);
    const next = resolveTikTokCapabilities(changed, previous);
    expect(next.find((item) => item.capability === 'CAMPAIGN_CREATE')).toMatchObject({ available: false, executionAllowed: false, schemaStatus: 'changed' });
    const stillBlocked = resolveTikTokCapabilities(changed, new Map(next.map((item) => [item.capability, item])));
    expect(stillBlocked.find((item) => item.capability === 'CAMPAIGN_CREATE')).toMatchObject({ available: false, executionAllowed: false, schemaStatus: 'changed' });
  });

  it('hashes schemas deterministically', () => {
    const left = tool('x', 'x', { b: { type: 'string' }, a: { type: 'number' } });
    const right = tool('x', 'x', { a: { type: 'number' }, b: { type: 'string' } });
    expect(hashToolSchema(left)).toBe(hashToolSchema(right));
  });

  it('rejects semantically wrong schemas even when their descriptions contain matching words', () => {
    const wrongTools = [
      tool('music_search', 'Search music to upload with a video', {
        filtering: { type: 'object' },
        music_scene: { type: 'string' },
        search_type: { type: 'string' },
      }),
      tool('campaign_copy_task_create', 'Create a campaign copy task', {
        advertiser_id: { type: 'string' },
        campaign_ids: { type: 'array' },
      }, ['advertiser_id', 'campaign_ids']),
    ];
    const matrix = resolveTikTokCapabilities(wrongTools);
    expect(matrix.find((item) => item.capability === 'CREATIVE_UPLOAD')).toMatchObject({ available: false, toolName: null });
    expect(matrix.find((item) => item.capability === 'CAMPAIGN_CREATE')).toMatchObject({ available: false, toolName: null });
  });

  it('never maps unrelated full-catalog tools from description keywords', () => {
    const wrongTools = [
      tool('asset_bind_quota_get', 'Get quota for an ad asset'),
      tool('smart_plus_ad_get', 'Get TikTok account ad authorization details'),
    ];
    const matrix = new Map(resolveTikTokCapabilities(wrongTools).map((item) => [item.capability, item]));
    expect(matrix.get('AD_READ')).toMatchObject({ available: false, toolName: null });
    expect(matrix.get('TIKTOK_ACCOUNT_AUTHORIZE')).toMatchObject({ available: false, toolName: null });
  });

  it('does not treat endpoint-name suffixes as official endpoint matches', () => {
    const matrix = new Map(resolveTikTokCapabilities([
      tool('payment_portfolio_advertiser_get', 'Get advertisers from a payment portfolio'),
      tool('file_image_ad_update', 'Update image files used by ads'),
    ]).map((item) => [item.capability, item]));
    expect(matrix.get('ADVERTISER_DISCOVERY')).toMatchObject({ available: false, toolName: null });
    expect(matrix.get('AD_UPDATE')).toMatchObject({ available: false, toolName: null });
  });

  it('prefers OAuth advertiser discovery over other advertiser endpoints', () => {
    const oauth = tool('/oauth2/advertiser/get/', 'Get authorized advertisers');
    const generic = tool('/advertiser/get/', 'Get advertisers');
    const matrix = new Map(resolveTikTokCapabilities([generic, oauth]).map((item) => [item.capability, item]));
    expect(matrix.get('ADVERTISER_DISCOVERY')).toMatchObject({ available: true, toolName: '/oauth2/advertiser/get/' });
  });

  it('prefers advertiser balance over the Business Center aggregate balance', () => {
    const advertiserBalance = tool('/advertiser/balance/get/', 'Get advertiser balance', { bc_id: { type: 'string' } }, ['bc_id']);
    const businessCenterBalance = tool('/bc/balance/get/', 'Get Business Center balance', { bc_id: { type: 'string' } }, ['bc_id']);
    const matrix = new Map(resolveTikTokCapabilities([businessCenterBalance, advertiserBalance]).map((item) => [item.capability, item]));
    expect(matrix.get('BILLING_READINESS')).toMatchObject({ available: true, toolName: '/advertiser/balance/get/' });
  });

  it('deduplicates equivalent full-catalog representations of one endpoint', () => {
    const schema = { advertiser_id: { type: 'string' } };
    const matrix = new Map(resolveTikTokCapabilities([
      tool('/identity/get/', 'Get identities', schema, ['advertiser_id']),
      tool('identity_get', 'Get identities', schema, ['advertiser_id']),
    ]).map((item) => [item.capability, item]));
    expect(matrix.get('TIKTOK_PERMISSION_READ')).toMatchObject({ available: true, schemaStatus: 'compatible' });
  });

  it('selects the richer schema when full-catalog aliases differ', () => {
    const matrix = new Map(resolveTikTokCapabilities([
      tool('/advertiser/info/', 'Get advertiser information', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
      tool('advertiser_info_get', 'Get advertiser information', {
        advertiser_ids: { type: 'array' },
        fields: { type: 'array' },
      }, ['advertiser_ids']),
    ]).map((item) => [item.capability, item]));
    expect(matrix.get('ADVERTISER_STATUS')).toMatchObject({ available: true, schemaStatus: 'compatible', toolName: 'advertiser_info_get' });
  });

  it('does not disable valid input for an unusable optional output schema', () => {
    const candidate = tool('advertiser_info_get', 'Get advertiser information', {
      advertiser_ids: { type: 'array' },
    }, ['advertiser_ids']);
    candidate.outputSchema = { type: 'definitely-not-a-json-schema-type' };
    const matrix = new Map(resolveTikTokCapabilities([candidate]).map((item) => [item.capability, item]));
    expect(matrix.get('ADVERTISER_STATUS')).toMatchObject({ available: true, schemaStatus: 'compatible' });
  });

  it('prefers exact manual endpoint names over specialized create tools', () => {
    const manual = tool('/campaign/create/', 'Create a Manual Campaign', {
      advertiser_id: { type: 'string' }, campaign_name: { type: 'string' }, objective_type: { type: 'string' },
    });
    const specialized = tool('/smart_plus/campaign/create/', 'Create an Upgraded Smart+ Campaign', {
      advertiser_id: { type: 'string' }, campaign_name: { type: 'string' }, objective_type: { type: 'string' },
    });
    const matrix = resolveTikTokCapabilities([specialized, manual]);
    expect(matrix.find((item) => item.capability === 'CAMPAIGN_CREATE')?.toolName).toBe('/campaign/create/');
  });

  it('recognizes full-disclosure endpoint names even when descriptions are generic', () => {
    const flatTools = [
      tool('/identity/get/', 'Get identity list', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
      tool('/file/video/ad/upload/', 'Upload file', { advertiser_id: { type: 'string' }, upload_type: { type: 'string' }, video_url: { type: 'string' } }, ['advertiser_id', 'upload_type']),
      tool('/campaign/status/update/', 'Update status', { advertiser_id: { type: 'string' }, campaign_ids: { type: 'array' }, operation_status: { type: 'string' } }),
      tool('/report/integrated/get/', 'Integrated data', { advertiser_id: { type: 'string' } }, ['advertiser_id']),
    ];
    const matrix = new Map(resolveTikTokCapabilities(flatTools).map((item) => [item.capability, item]));
    expect(matrix.get('TIKTOK_PERMISSION_READ')?.toolName).toBe('/identity/get/');
    expect(matrix.get('CREATIVE_UPLOAD')?.toolName).toBe('/file/video/ad/upload/');
    expect(matrix.get('CAMPAIGN_ACTIVATE')?.toolName).toBe('/campaign/status/update/');
    expect(matrix.get('REPORT_READ')?.toolName).toBe('/report/integrated/get/');
  });
});
