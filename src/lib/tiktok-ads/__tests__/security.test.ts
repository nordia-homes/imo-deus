import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateJsonSchema } from '../mcp-client';
import { OPERATION_CLASS } from '../capabilities';
import { decryptTikTokSecret, encryptTikTokSecret } from '../crypto';
import { forceAdsOnlyCreatePayload, forceDisabledCreatePayload } from '../mcp-adapter';
import { assertActorPolicy, assertAdsOnlyPayload, assertAdvertiserWriteEligibility, assertCapabilityPayloadBoundaries, assertFreshTikTokAccountPermissions, assertKillSwitches, assertSignificantChangeSafeguard, issueSpendAuthorization, validateMoneyPayload } from '../policy';
import { assertTikTokVideoMetadata, parseFfmpegVideoMetadata, validateRemoteVideo } from '../media-security';
import { parseOperationBody } from '../request-validation';
import type { JsonSchema, TikTokAccountPermissionRecord, TikTokAdvertiserRecord } from '../types';

afterEach(() => {
  delete process.env.TIKTOK_READS_ENABLED;
  delete process.env.TIKTOK_WRITES_ENABLED;
  delete process.env.TIKTOK_SPEND_MUTATIONS_ENABLED;
  delete process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY;
  delete process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
});

describe('TikTok Ads safety policy', () => {
  it('never allows the ads-only workflow to enter organic publishing', () => {
    expect(() => assertAdsOnlyPayload({ adsOnly: true, video: {}, ad: {} })).not.toThrow();
    expect(() => assertAdsOnlyPayload({ adsOnly: true, operation: 'video.publish' })).toThrow(/organic/i);
    expect(() => assertAdsOnlyPayload({ show_on_profile: true })).toThrow();
    expect(() => assertAdsOnlyPayload({ adsOnly: false })).toThrow();
    const source = readFileSync(resolve(process.cwd(), 'src/lib/tiktok-ads/mcp-adapter.ts'), 'utf8');
    expect(source).not.toContain("from '@/lib/tiktok-marketing'");
    expect(source).not.toContain('/v2/post/publish/');
    expect(source).not.toContain('video.publish');
  });

  it('blocks AI and non-admin writes', async () => {
    expect(() => assertActorPolicy({ uid: 'u', role: 'admin', type: 'ai' }, 'CAMPAIGN_UPDATE')).toThrow(/AI-ul/);
    expect(() => assertActorPolicy({ uid: 'u', role: 'agent', type: 'human' }, 'CAMPAIGN_UPDATE')).toThrow(/administrator/);
    expect(() => assertActorPolicy({ uid: 'u', role: 'admin', type: 'system' }, 'CAMPAIGN_ACTIVATE')).toThrow(/utilizator uman/);
    await expect(issueSpendAuthorization({
      organizationId: 'org',
      actor: { uid: 'u', role: 'admin', type: 'ai' },
      capability: 'CAMPAIGN_ACTIVATE',
      advertiserId: 'adv',
      payload: {},
    })).rejects.toThrow(/AI-ul/);
  });

  it('keeps spend mutations disabled by default and supports independent kill switches', () => {
    expect(() => assertKillSwitches('CAMPAIGN_READ')).not.toThrow();
    expect(OPERATION_CLASS.SPARK_NEW_VIDEO_AD_ONLY).toBe('NON_FINANCIAL_WRITE');
    expect(OPERATION_CLASS.SPARK_EXISTING_POST).toBe('NON_FINANCIAL_WRITE');
    expect(() => assertKillSwitches('SPARK_NEW_VIDEO_AD_ONLY')).not.toThrow();
    expect(() => assertKillSwitches('CAMPAIGN_ACTIVATE')).toThrow(/oprite/);
    process.env.TIKTOK_SPEND_MUTATIONS_ENABLED = 'true';
    expect(() => assertKillSwitches('CAMPAIGN_ACTIVATE')).not.toThrow();
    process.env.TIKTOK_READS_ENABLED = 'false';
    expect(() => assertKillSwitches('REPORT_READ')).toThrow(/Citirile/);
  });

  it('uses exact decimal input and advertiser currency precision', () => {
    expect(validateMoneyPayload({ budget: '123.45' }, { currency: 'EUR', currencyPrecision: 2 })).toHaveLength(1);
    expect(validateMoneyPayload({ budget_mode: 'BUDGET_MODE_DAY', bid_type: 'BID_TYPE_NO_BID' }, { currency: null, currencyPrecision: null })).toHaveLength(0);
    expect(() => validateMoneyPayload({ budget: 123.45 }, { currency: 'EUR', currencyPrecision: 2 })).toThrow(/floating point/);
    expect(() => validateMoneyPayload({ bid: '1.234' }, { currency: 'EUR', currencyPrecision: 2 })).toThrow(/precizia/);
    expect(() => validateMoneyPayload({ budget: '12.00' }, { currency: null, currencyPrecision: null })).toThrow(/Currency/);
  });

  it('prevents generic updates from bypassing spend policy', () => {
    expect(() => assertCapabilityPayloadBoundaries('CAMPAIGN_UPDATE', { budget: '100.00' })).toThrow(/capabilities dedicate/);
    expect(() => assertCapabilityPayloadBoundaries('ADGROUP_UPDATE', { operation_status: 'ENABLE' })).toThrow(/capabilities dedicate/);
    expect(() => assertSignificantChangeSafeguard('BUDGET_UPDATE', { budget: '130.00', _imodeus: { previousAmount: '100.00' } }, 2)).toThrow(/confirmare/);
    expect(() => assertSignificantChangeSafeguard('BUDGET_UPDATE', { budget: '130.00', _imodeus: { previousAmount: '100.00', significantChangeApproved: true } }, 2)).not.toThrow();
  });

  it('requires a positively authorized, approved and active advertiser before writes', () => {
    const advertiser: TikTokAdvertiserRecord = {
      organizationId: 'org', advertiserId: 'adv', authorized: true, selected: true,
      status: 'ACTIVE', reviewStatus: 'APPROVED', discoveredAt: new Date().toISOString(), version: 3,
    };
    expect(() => assertAdvertiserWriteEligibility(advertiser)).not.toThrow();
    expect(() => assertAdvertiserWriteEligibility({ ...advertiser, authorized: false })).toThrow(/nu mai este autorizat/);
    expect(() => assertAdvertiserWriteEligibility({ ...advertiser, reviewStatus: 'PENDING_REVIEW' })).toThrow(/review/);
    expect(() => assertAdvertiserWriteEligibility({ ...advertiser, reviewStatus: 'NOT_APPROVED' })).toThrow(/respins/);
    expect(() => assertAdvertiserWriteEligibility({ ...advertiser, status: 'SUSPENDED' })).toThrow(/eligibil/);
    expect(() => assertAdvertiserWriteEligibility({ ...advertiser, status: null, reviewStatus: null })).toThrow(/nu este confirmată/);
  });

  it('requires fresh, complete TikTok account permissions for each Spark workflow', () => {
    const permission: TikTokAccountPermissionRecord = {
      organizationId: 'org', advertiserId: 'adv', tiktokAccountId: 'identity',
      deliverAds: true, existingPosts: true, publishAndManageNewVideos: true, onlyShowAsAds: true,
      lastVerifiedAt: new Date().toISOString(), verificationStatus: 'verified',
    };
    expect(() => assertFreshTikTokAccountPermissions(permission, 'existing_post')).not.toThrow();
    expect(() => assertFreshTikTokAccountPermissions(permission, 'new_video_ads_only')).not.toThrow();
    expect(() => assertFreshTikTokAccountPermissions({
      ...permission,
      identityType: 'TT_USER',
      identityAuthorizedBcId: null,
      permissionEvidence: 'advertiser_identity',
      publishAndManageNewVideos: false,
      onlyShowAsAds: false,
    }, 'new_video_ads_only')).not.toThrow();
    expect(() => assertFreshTikTokAccountPermissions({ ...permission, existingPosts: false }, 'existing_post')).toThrow(/Existing posts/);
    expect(() => assertFreshTikTokAccountPermissions({ ...permission, onlyShowAsAds: false }, 'new_video_ads_only')).toThrow(/Only show as ads/);
    expect(() => assertFreshTikTokAccountPermissions({
      ...permission,
      publishAndManageNewVideos: false,
      onlyShowAsAds: false,
      identityType: 'BC_AUTH_TT',
      identityAuthorizedBcId: 'bc-1',
      permissionEvidence: 'advertiser_identity',
    }, 'new_video_ads_only')).not.toThrow();
    expect(() => assertFreshTikTokAccountPermissions({ ...permission, lastVerifiedAt: 'invalid' }, 'existing_post')).toThrow(/timestamp invalid/);
    expect(() => assertFreshTikTokAccountPermissions({ ...permission, lastVerifiedAt: new Date(Date.now() - 16 * 60_000).toISOString() }, 'existing_post')).toThrow(/stale/);
    expect(() => assertFreshTikTokAccountPermissions({ ...permission, lastVerifiedAt: new Date(Date.now() + 6 * 60_000).toISOString() }, 'existing_post')).toThrow(/timestamp invalid/);
  });

  it('forces every created campaign, ad group and ad to DISABLE', () => {
    const schema: JsonSchema = { type: 'object', properties: { operation_status: { type: 'string' } } };
    for (const capability of ['CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'AD_CREATE'] as const) {
      expect(forceDisabledCreatePayload(capability, {}, schema)).toEqual({ operation_status: 'DISABLE' });
      expect(() => forceDisabledCreatePayload(capability, { operation_status: 'ENABLE' }, schema)).toThrow(/server/);
    }
    expect(forceDisabledCreatePayload('CREATIVE_UPLOAD', { name: 'video' }, schema)).toEqual({ name: 'video' });
  });

  it('forces ads-only delivery using the provider dark-post contract', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        ad_configuration: {
          type: 'object',
          properties: { dark_post_status: { type: 'string' } },
        },
      },
    };
    expect(forceAdsOnlyCreatePayload({}, schema)).toEqual({ ad_configuration: { dark_post_status: 'ON' } });
    expect(() => forceAdsOnlyCreatePayload({ ad_configuration: { dark_post_status: 'OFF' } }, schema)).toThrow(/server/);
  });

  it('uses purpose-bound AES-GCM encryption and supports controlled key rotation', () => {
    const oldKey = 'a'.repeat(32);
    process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY = oldKey;
    const encrypted = encryptTikTokSecret('secret-value', 'lead-pii');
    expect(decryptTikTokSecret(encrypted, 'lead-pii')).toBe('secret-value');
    expect(() => decryptTikTokSecret(encrypted, 'oauth-token')).toThrow(/format invalid/);
    process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY = 'b'.repeat(32);
    process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY_PREVIOUS = oldKey;
    expect(decryptTikTokSecret(encrypted, 'lead-pii')).toBe('secret-value');
    process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY = 'too-short';
    delete process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    expect(() => encryptTikTokSecret('secret')).toThrow(/cel puțin 32/);
  });

  it('rejects private-network media URLs before making a request', async () => {
    await expect(validateRemoteVideo('http://127.0.0.1/video.mp4')).rejects.toThrow(/HTTPS/);
    await expect(validateRemoteVideo('https://127.0.0.1/video.mp4')).rejects.toThrow(/privată/);
    await expect(validateRemoteVideo('https://[::1]/video.mp4')).rejects.toThrow(/privată/);
    await expect(validateRemoteVideo('https://100.64.0.1/video.mp4')).rejects.toThrow(/privată/);
    await expect(validateRemoteVideo('https://192.0.2.1/video.mp4')).rejects.toThrow(/privată/);
    await expect(validateRemoteVideo('https://[2001:db8::1]/video.mp4')).rejects.toThrow(/privată/);
  });

  it('validates decoded video dimensions, duration, bitrate, and codec metadata', () => {
    const metadata = parseFfmpegVideoMetadata(
      'Duration: 00:00:30.00, start: 0.000000, bitrate: 1200 kb/s\nStream #0:0: Video: h264, yuv420p, 1080x1920, 1150 kb/s, 30 fps',
      4_500_000
    );
    expect(metadata).toMatchObject({ width: 1080, height: 1920, durationSeconds: 30, codec: 'h264' });
    expect(() => assertTikTokVideoMetadata(metadata!)).not.toThrow();
    expect(() => assertTikTokVideoMetadata({ ...metadata!, width: 720, height: 1024 })).toThrow(/Dimensiunile/);
    expect(() => assertTikTokVideoMetadata({ ...metadata!, durationSeconds: 601 })).toThrow(/10 minute/);
    expect(() => assertTikTokVideoMetadata({ ...metadata!, bitrateKbps: 515 })).toThrow(/516/);
  });

  it('validates discovered schemas instead of accepting best-effort payloads', () => {
    const schema: JsonSchema = { type: 'object', properties: { advertiser_id: { type: 'string' }, budget: { type: 'number', minimum: 10, maximum: 100 } }, required: ['advertiser_id', 'budget'], additionalProperties: false };
    expect(validateJsonSchema({ advertiser_id: '123', budget: 10 }, schema)).toEqual({ ok: true, errors: [] });
    expect(validateJsonSchema({ advertiser_id: '123' }, schema).ok).toBe(false);
    expect(validateJsonSchema({ advertiser_id: '123', budget: '10' }, schema).ok).toBe(false);
    expect(validateJsonSchema({ advertiser_id: '123', budget: 101 }, schema).ok).toBe(false);
  });

  it('rejects unknown operation fields and prototype-pollution payloads', () => {
    expect(() => parseOperationBody({ capability: 'CAMPAIGN_READ', payload: {}, surprise: true })).toThrow();
    const polluted = JSON.parse('{"capability":"CAMPAIGN_READ","payload":{"constructor":{"prototype":{"admin":true}}}}');
    expect(() => parseOperationBody(polluted)).toThrow(/interzis/);
  });

  it('keeps TikTok server-managed data inaccessible to client rules', () => {
    for (const file of ['firestore.rules', 'src/firestore.rules']) {
      const rules = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(rules).toContain("collectionId == 'tiktokAdvertisers'");
      expect(rules).toContain("collectionId == 'tiktokLeadReferences'");
      expect(rules).toContain("collectionId == 'tiktokMediaMappings'");
      expect(rules).toContain('match /agencyPrivateIntegrations/{documentId}');
      expect(rules).toContain('match /tiktokAdsJobs/{documentId}');
      expect(rules).toContain('!isServerManagedAgencyCollection(collectionId)');
    }
  });
});
