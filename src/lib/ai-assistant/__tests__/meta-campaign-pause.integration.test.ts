import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: null as any, fetch: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ get adminDb() { return mocks.db; } }));
import { pauseMetaCampaignDraft } from '../../meta-marketing';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('persisted verified Meta pause', () => {
  const agencies: string[] = [];
  beforeAll(() => {
    if (!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    mocks.db = new Firestore({ projectId: 'demo-imodeus-meta-pause' });
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-pause-test-key'); vi.stubGlobal('fetch', mocks.fetch);
  });
  afterAll(async () => {
    if (!mocks.db) return;
    for (const id of agencies) { await mocks.db.recursiveDelete(mocks.db.collection('agencies').doc(id)); await mocks.db.collection('agencyPrivateIntegrations').doc(id + '__meta').delete(); }
    await mocks.db.terminate(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
  async function fixture() {
    const agencyId = randomUUID(); agencies.push(agencyId);
    const agency = mocks.db.collection('agencies').doc(agencyId);
    const campaign = agency.collection('metaCampaignDrafts').doc('selected');
    const other = agency.collection('metaCampaignDrafts').doc('other');
    const property = agency.collection('properties').doc('property');
    const grant = mocks.db.collection('agencyPrivateIntegrations').doc(agencyId + '__meta');
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update('synthetic-pause-test-key').digest(), iv);
    const encrypted = Buffer.concat([cipher.update('synthetic-token'), cipher.final()]);
    await grant.set({ agencyId, connected: true, selectedAdAccount: { id: 'act_456' }, encryptedAccessToken: `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}` });
    await campaign.set({ agencyId, propertyId: 'property', status: 'published', metaCampaignId: '123', updatedAt: 'before' });
    await other.set({ agencyId, propertyId: 'property', status: 'published', metaCampaignId: '999' });
    await property.set({ metaMarketing: { latestCampaignDraftId: 'selected', status: 'published', retained: true } });
    let paused = false;
    mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      const parsed = new URL(url); expect(parsed.origin).toBe('https://graph.facebook.com'); expect(parsed.pathname).toBe('/v23.0/123');
      if (init?.method === 'POST') { expect(String(init.body)).toBe('status=PAUSED'); paused = true; return Response.json({ success: true }); }
      return Response.json({ id: '123', account_id: '456', status: paused ? 'PAUSED' : 'ACTIVE', effective_status: paused ? 'PAUSED' : 'ACTIVE' });
    });
    return { agencyId, campaign, other, property, grant, run: () => pauseMetaCampaignDraft(agencyId, 'selected') };
  }
  it('persists provider evidence and updates only the selected campaign and its current pointer', async () => {
    const f = await fixture(); const before = (await f.other.get()).data(); const result = await f.run();
    expect(result.status).toBe('paused'); expect((await f.campaign.get()).data().providerPauseVerification.effectiveStatus).toBe('PAUSED');
    expect((await f.property.get()).data().metaMarketing).toMatchObject({ status: 'paused', retained: true }); expect((await f.other.get()).data()).toEqual(before);
  });
  it('does not replace the pointer to another campaign', async () => {
    const f = await fixture(); await f.property.update({ 'metaMarketing.latestCampaignDraftId': 'other' }); const before = (await f.property.get()).data();
    await f.run(); expect((await f.property.get()).data()).toEqual(before);
  });
  it.each(['draft', 'ready', 'publishing', 'deleted', 'completed'])('does not call Meta for local status %s', async status => {
    const f = await fixture(); await f.campaign.update({ status }); await expect(f.run()).rejects.toThrow('publicată'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('refuses a missing provider identifier', async () => {
    const f = await fixture(); await f.campaign.update({ metaCampaignId: null }); await expect(f.run()).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not trust stale local paused status', async () => {
    const f = await fixture(); await f.campaign.update({ status: 'paused' }); await f.run(); expect(mocks.fetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
  it('does not save paused when Meta remains active', async () => {
    const f = await fixture(); mocks.fetch.mockImplementation(async () => Response.json({ id: '123', account_id: '456', status: 'ACTIVE', effective_status: 'ACTIVE' }));
    await expect(f.run()).rejects.toThrow('nu a confirmat'); expect((await f.campaign.get()).data().status).toBe('published');
  });
  it('rejects a provider campaign belonging to another account before POST', async () => {
    const f = await fixture(); mocks.fetch.mockImplementation(async () => Response.json({ id: '123', account_id: '999', status: 'ACTIVE', effective_status: 'ACTIVE' }));
    await expect(f.run()).rejects.toThrow('identitatea'); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not overwrite a changed campaign after provider readback', async () => {
    const f = await fixture(); const original = mocks.fetch.getMockImplementation()!; let reads = 0;
    mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); if (init?.method !== 'POST' && ++reads === 2) await f.campaign.update({ status: 'error', headline: 'changed' }); return response; });
    await expect(f.run()).rejects.toThrow('schimbat'); expect((await f.campaign.get()).data()).toMatchObject({ status: 'error', headline: 'changed' });
  });
  it('blocks POST when the connection is revoked during preflight', async () => {
    const f = await fixture(); const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); await f.grant.update({ connected: false }); return response; });
    await expect(f.run()).rejects.toThrow('schimbat'); expect(mocks.fetch).toHaveBeenCalledTimes(1); expect((await f.campaign.get()).data().status).toBe('published');
  });
  it('does not recreate a missing property', async () => {
    const f = await fixture(); await f.property.delete(); await f.run(); expect((await f.property.get()).exists).toBe(false);
  });
  it('persists a pause confirmed after the POST response is lost', async () => {
    const f = await fixture(); const original = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); if (init?.method === 'POST') throw new Error('Synthetic lost response'); return response; });
    await f.run(); expect((await f.campaign.get()).data().status).toBe('paused');
    expect(mocks.fetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
  it.each([{ connected: false }, { agencyId: 'foreign' }])('refuses an unavailable or foreign grant %j', async patch => {
    const f = await fixture(); await f.grant.update(patch); await expect(f.run()).rejects.toThrow('Reconectează'); expect(mocks.fetch).not.toHaveBeenCalled();
  });

});
