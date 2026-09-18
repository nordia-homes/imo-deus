import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TikTokAccountPermissionRecord } from '../types';
import type { Workspace, Api } from '@/components/marketing/tiktok-ads/workspace-types';
vi.mock('@/firebase', () => ({ useStorage: () => null, useUser: () => ({ user: null }) }));
import { IdentityProfiles, AccountDiagnostics, DisconnectControl } from '@/components/marketing/tiktok-ads/AccountDiagnostics';
import { AdVideoPicker } from '@/components/marketing/tiktok-ads/AdVideoPicker';
import { PhonePreview } from '@/components/marketing/tiktok-ads/StudioPrimitives';

const api: Api = async <T,>() => ({} as T);
beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());
const permission = { advertiserId: 'account', username: 'same-profile', tiktokAccountId: 'direct', identityType: 'TT_USER', deliverAds: true, verificationStatus: 'verified' } as TikTokAccountPermissionRecord;
describe('TikTok workspace presentation', () => {
  it('shows one profile with two distinct authorization routes without combining permissions', () => {
    const html = renderToStaticMarkup(React.createElement(IdentityProfiles, { permissions: [permission, { ...permission, tiktokAccountId: 'business', identityType: 'BC_AUTH_TT', identityAuthorizedBcId: 'bc', onlyShowAsAds: true }] }));
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain('Autorizare directă TikTok');
    expect(html).toContain('Business Center');
    expect(html).toContain('2');
    expect(html.match(/Exclusiv reclame/g)).toHaveLength(2);
  });
  it('explains unsupported optional capabilities rather than displaying them as failed operations', () => {
    const workspace = { capabilities: [{ capability: 'LEAD_FORM_CREATE', executionAllowed: false }], operations: [] } as unknown as Workspace;
    const html = renderToStaticMarkup(React.createElement(AccountDiagnostics, { workspace }));
    expect(html).toContain('Crearea formularelor TikTok');
    expect(html).toContain('nu erori ale unor reclame');
    expect(html).toContain('Nu există operații recente');
  });
  it('keeps actual operation errors visible', () => {
    const workspace = { capabilities: [], operations: [{ operationId: 'failed', capability: 'AD_CREATE', status: 'failed', lastErrorCode: 'PERMISSION_MISSING', remoteOutcomeUnknown: true }] } as unknown as Workspace;
    const html = renderToStaticMarkup(React.createElement(AccountDiagnostics, { workspace }));
    expect(html).toContain('PERMISSION_MISSING');
    expect(html).toContain('Rezultatul extern este necunoscut');
  });
  it('lists both video sources only for the selected property and exposes file upload', () => {
    const video = { id: 'ai', propertyId: 'property', name: 'Video AI', url: 'ai.mp4', thumbnailUrl: null, durationSeconds: null };
    const html = renderToStaticMarkup(React.createElement(AdVideoPicker, { api, videos: [video, { ...video, id: 'upload', name: 'Video încărcat' }, { ...video, id: 'other', name: 'Altă proprietate', propertyId: 'other' }], propertyId: 'property', value: '', disabled: false, onSelected: () => {}, onBusy: () => {} }));
    expect(html).toContain('Video AI'); expect(html).toContain('Video încărcat');
    expect(html).not.toContain('Altă proprietate');
    expect(html).toContain('type="file"'); expect(html).toContain('accept="video/*"');
  });
  it('shows the disconnect entry for a connected Ads account', () => {
    expect(renderToStaticMarkup(React.createElement(DisconnectControl, { api, connected: true, onDisconnected: async () => {} }))).toContain('Deconectează TikTok Ads');
  });
  it('includes follow, save, share and audio-disc elements without invented statistics', () => {
    const html = renderToStaticMarkup(React.createElement(PhonePreview, {}));
    expect(html).toContain('tt-phone-record'); expect(html).toContain('lucide-bookmark');
    expect(html).toContain('lucide-plus'); expect(html.match(/class="tt-phone-action"/g)).toHaveLength(4);
    expect(html).not.toContain('2.352');
  });
});
