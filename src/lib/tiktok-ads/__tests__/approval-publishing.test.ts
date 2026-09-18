import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAdDraft } from '../workspace-model';

const state = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), resources: { ad: [] as Record<string, unknown>[], adgroup: [] as Record<string, unknown>[], campaign: [] as Record<string, unknown>[] }, calls: [] as Array<Record<string, unknown>>, creationCount: 0, cache: new Map<string, unknown>(), failActivation: false, failCreation: false, failRead: false, budget: '50' }));
vi.mock('@/firebase/admin', () => {
  const ref = (path: string) => ({ path, id: path.split('/').at(-1), collection: (name: string) => ref(`${path}/${name}`), doc: (id: string) => ref(`${path}/${id}`), where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }), get: async () => ({ exists: state.docs.has(path), data: () => state.docs.get(path) }) });
  return { adminDb: { collection: ref, runTransaction: async (fn: (tx: unknown) => unknown) => fn({ get: (r: ReturnType<typeof ref>) => r.get(), update: (r: ReturnType<typeof ref>, patch: Record<string, unknown>) => state.docs.set(r.path, { ...state.docs.get(r.path), ...patch }), set: (r: ReturnType<typeof ref>, data: Record<string, unknown>) => state.docs.set(r.path, data) }) } };
});
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (...items: unknown[]) => items, serverTimestamp: () => 'timestamp' } }));
vi.mock('../policy', () => ({ assertActorPolicy: vi.fn(), assertAdvertiserWriteEligibility: vi.fn(), assertKillSwitches: vi.fn() }));
const caps = ['AD_CREATE', 'CREATIVE_UPLOAD', 'SPARK_NEW_VIDEO_AD_ONLY', 'AD_RESUME', 'ADGROUP_RESUME', 'CAMPAIGN_RESUME', 'AD_READ', 'ADGROUP_READ', 'CAMPAIGN_READ'];
vi.mock('../store', () => ({
  getAdvertiser: async () => ({ currency: 'RON', timezone: 'UTC', version: 1, billingReadiness: 'ready' }),
  getOwnedStudioVideoAsset: async () => ({ id: 'video', propertyId: 'property', url: 'https://example.com/video.mp4' }),
  loadToolCache: async () => ['AD_CREATE', 'CREATIVE_UPLOAD', 'AD_RESUME', 'ADGROUP_RESUME', 'CAMPAIGN_RESUME', 'AD_READ', 'ADGROUP_READ', 'CAMPAIGN_READ'].map(name => ({ name, inputSchema: { type: 'object', properties: Object.fromEntries(['adgroup_id', 'adgroup_ids', 'ad_id', 'ad_ids', 'campaign_id', 'campaign_ids', 'ad_name', 'page', 'page_size'].map(key => [key, {}])) } })),
}));
vi.mock('@/lib/tiktok-ads', () => ({
  discoverTikTokAdsCapabilities: async () => caps.map(capability => ({ capability, toolName: capability, executionAllowed: true })),
  authorizeTikTokSpend: async () => ({ token: 'authorized' }),
  executeTikTokAdsOperation: async (request: Record<string, unknown>) => {
    state.calls.push(request);
    const capability = String(request.capability);
    const base = { status: 'succeeded', operationId: 'operation', createdResourceIds: [] };
    if (capability === 'ADVERTISER_STATUS' || capability === 'BILLING_READINESS') return base;
    if (capability.endsWith('_READ')) {
      const kind = capability.replace('_READ', '').toLowerCase() as keyof typeof state.resources;
      if (kind === 'adgroup') state.resources.adgroup[0].budget = state.budget;
      return { ...base, status: state.failRead ? 'failed' : 'succeeded', remoteResult: { list: state.resources[kind], page_info: { total_page: 1 } } };
    }
    if (capability === 'SPARK_NEW_VIDEO_AD_ONLY') {
      const key = String(request.idempotencyKey);
      if (state.cache.has(key)) return state.cache.get(key);
      if (state.failCreation) return { ...base, status: 'pending_recovery' };
      state.creationCount++;
      state.resources.ad.push({ ad_id: 'new-ad', ad_name: 'New', adgroup_id: 'group', operation_status: 'DISABLE' });
      const result = { ...base, createdResourceIds: [{ resourceType: 'ad', resourceId: 'new-ad' }] };
      state.cache.set(key, result); return result;
    }
    if (capability.endsWith('_RESUME')) {
      if (state.failActivation) return { ...base, status: 'failed' };
      expect(request.authorizationToken).toBe('authorized');
      const kind = capability.replace('_RESUME', '').toLowerCase() as keyof typeof state.resources;
      const payload = request.payload as Record<string, unknown>;
      state.resources[kind].find(row => row[`${kind}_id`] === payload[`${kind}_id`])!.operation_status = 'ENABLE';
      return base;
    }
    throw new Error(`Unexpected capability: ${capability}`);
  },
}));
import { previewPublication, publishApprovedDraft } from '../approval-publishing';
const path = 'agencies/agency/tiktokWorkspaceDrafts/draft';
beforeEach(() => {
  state.docs.clear(); state.cache.clear(); state.calls = []; state.creationCount = 0; state.failActivation = false; state.failCreation = false; state.failRead = false; state.budget = '50';
  state.docs.set('agencies/agency/properties/property', {});
  state.docs.set(path, { id: 'draft', advertiserId: 'account', ownerUid: 'agent', version: 1, status: 'submitted', data: { ...emptyAdDraft, name: 'Home', propertyId: 'property', identityId: 'profile', text: 'Home tour', assetId: 'video', url: 'https://example.com', adgroupId: 'group' } });
  state.resources = { campaign: [{ campaign_id: 'campaign', campaign_name: 'Campaign', operation_status: 'DISABLE' }], adgroup: [{ adgroup_id: 'group', campaign_id: 'campaign', adgroup_name: 'Group', operation_status: 'DISABLE', budget: '50' }], ad: [{ ad_id: 'other-ad', ad_name: 'Other', adgroup_id: 'group', operation_status: 'ENABLE' }] };
});
describe('Approved publication orchestrator (mocked provider)', () => {
  it('denies agents before any provider call', async () => {
    await expect(previewPublication('agency', 'agent', 'agent', 'draft', 1)).rejects.toThrow(/administrator/);
    await expect(publishApprovedDraft('agency', 'agent', 'agent', 'draft', 1, 'x')).rejects.toThrow(/administrator/);
    expect(state.calls).toHaveLength(0);
  });
  it('previews other ads affected by enabling parents without spending', async () => {
    const preview = await previewPublication('agency', 'admin', 'admin', 'draft', 1);
    expect(preview.affectedAds.map(ad => ad.id)).toEqual(['other-ad']);
    expect(preview.budget).toBe('50');
    expect(state.calls.every(call => !String(call.capability).endsWith('_RESUME'))).toBe(true);
  });
  it('requires exact revision and consent, then activates leaf-to-parent and notifies the owner', async () => {
    await expect(publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, 'invalid')).rejects.toThrow();
    const preview = await previewPublication('agency', 'admin', 'admin', 'draft', 1);
    const result = await publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, preview.token);
    expect(result.status).toBe('published');
    expect(state.calls.filter(call => String(call.capability).endsWith('_RESUME')).map(call => call.capability)).toEqual(['AD_RESUME', 'ADGROUP_RESUME', 'CAMPAIGN_RESUME']);
    expect(state.docs.get(path)?.publishRevision).toBe(1);
    expect(state.docs.has('users/agent/notifications/tiktok-draft-2-published')).toBe(true);
    await expect(publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, preview.token)).rejects.toThrow();
    expect(state.creationCount).toBe(1);
  });
  it('rejects changed remote budget before creating or activating', async () => {
    const preview = await previewPublication('agency', 'admin', 'admin', 'draft', 1);
    state.budget = '100';
    await expect(publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, preview.token)).rejects.toThrow(/modificat/);
    expect(state.creationCount).toBe(0);
  });
  it('never activates after an uncertain creation result', async () => {
    const preview = await previewPublication('agency', 'admin', 'admin', 'draft', 1);
    state.failCreation = true;
    expect((await publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, preview.token)).status).toBe('publication_failed');
    expect(state.calls.some(call => String(call.capability).endsWith('_RESUME'))).toBe(false);
  });
  it('retries the same creation key after activation failure without duplicating ads', async () => {
    const preview = await previewPublication('agency', 'admin', 'admin', 'draft', 1);
    state.failActivation = true;
    expect((await publishApprovedDraft('agency', 'admin', 'admin', 'draft', 1, preview.token)).status).toBe('publication_failed');
    await expect(previewPublication('agency', 'another-admin', 'admin', 'draft', 2)).rejects.toThrow(/administratorul/);
    state.failActivation = false;
    const retry = await previewPublication('agency', 'admin', 'admin', 'draft', 2);
    expect((await publishApprovedDraft('agency', 'admin', 'admin', 'draft', 2, retry.token)).status).toBe('published');
    expect(state.creationCount).toBe(1);
  });
  it('fails closed when the hierarchy cannot be read or another request owns the lease', async () => {
    state.failRead = true;
    await expect(previewPublication('agency', 'admin', 'admin', 'draft', 1)).rejects.toThrow(/Citirea/);
    state.failRead = false;
    state.docs.set(path, { ...state.docs.get(path), leaseUntil: Date.now() + 60000 });
    await expect(previewPublication('agency', 'admin', 'admin', 'draft', 1)).rejects.toThrow(/în curs/);
  });
});
