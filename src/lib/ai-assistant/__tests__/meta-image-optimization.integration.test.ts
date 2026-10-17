import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: null as any, fetch: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ get adminDb() { return mocks.db; } }));
import { applyMetaImageOptimization } from '@/lib/meta-marketing';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('persisted Meta image optimization', () => {
    const agencies: string[] = [], users: string[] = [];
    beforeAll(() => { if (!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ''))
        throw Error('Local emulator required'); mocks.db = new Firestore({ projectId: 'demo-imodeus-meta-image' }); vi.stubGlobal('fetch', mocks.fetch); vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-key'); });
    afterAll(async () => { if (!mocks.db)
        return; for (const id of agencies) {
        await mocks.db.recursiveDelete(mocks.db.collection('agencies').doc(id));
        await mocks.db.collection('agencyPrivateIntegrations').doc(id + '__meta').delete();
    } for (const id of users)
        await mocks.db.collection('users').doc(id).delete(); await mocks.db.terminate(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
    async function fixture() {
        const agencyId = randomUUID(), uid = randomUUID();
        agencies.push(agencyId);
        users.push(uid);
        const actor = { uid, role: 'admin' }, agency = mocks.db.collection('agencies').doc(agencyId), campaign = agency.collection('metaCampaignDrafts').doc('campaign'), property = agency.collection('properties').doc('property'), member = mocks.db.collection('users').doc(uid), grant = mocks.db.collection('agencyPrivateIntegrations').doc(agencyId + '__meta');
        await member.set({ agencyId, role: 'admin' });
        await property.set({ agencyId, images: [{ url: 'https://example.invalid/new.jpg' }] });
        await campaign.set({ agencyId, propertyId: 'property', status: 'paused', creativeFormat: 'single_image', metaCampaignId: '1', metaAdSetId: '2', metaAdId: '3', metaCreativeId: '4', imageUrl: 'https://example.invalid/old.jpg', budgetAmount: 50 });
        const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update('synthetic-key').digest(), iv), encrypted = Buffer.concat([cipher.update('synthetic-token'), cipher.final()]);
        await grant.set({ agencyId, connected: true, selectedAdAccount: { id: 'act_6' }, encryptedAccessToken: 'v1:' + iv.toString('base64') + ':' + cipher.getAuthTag().toString('base64') + ':' + encrypted.toString('base64') });
        const approval = { expectedRevision: hash((await campaign.get()).data()), propertyRevision: hash((await property.get()).data()), grantRevision: hash((await grant.get()).data()), newCreativeId: '5', imageHash: 'new', imageUrl: 'https://example.invalid/new.jpg' };
        const story = (image_hash: string) => ({ page_id: '7', link_data: { message: 'Identic', name: 'Titlu', link: 'https://example.invalid', image_hash } });
        const objects: Record<string, any> = { '1': { id: '1', account_id: '6', status: 'PAUSED', daily_budget: '5000' }, '2': { id: '2', account_id: '6', campaign_id: '1', status: 'PAUSED' }, '3': { id: '3', account_id: '6', campaign_id: '1', adset_id: '2', status: 'PAUSED', creative: { id: '4' } }, '4': { id: '4', account_id: '6', object_story_spec: story('old') }, '5': { id: '5', account_id: '6', object_story_spec: story('new') } };
        mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => { const u = new URL(url); expect(u.origin).toBe('https://graph.facebook.com'); const id = u.pathname.split('/').at(-1)!; expect(objects[id]).toBeDefined(); if (init?.method === 'POST') {
            expect(id).toBe('3');
            expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ creative: '{"creative_id":"5"}' });
            objects['3'].creative.id = '5';
            return Response.json({ success: true });
        } return Response.json(objects[id]); });
        return { campaign, property, member, grant, objects, approval, run: () => applyMetaImageOptimization(agencyId, 'campaign', actor, approval) };
    }
    it('persists verified image change and replays without provider requests', async () => { const f = await fixture(), property = (await f.property.get()).data(); const proof = await f.run(); expect(proof.onlyImageChanged).toBe(true); expect((await f.campaign.get()).data()).toMatchObject({ metaCreativeId: '5', imageUrl: f.approval.imageUrl, mediaItems: [{ type: 'image', url: f.approval.imageUrl, source: 'property' }], budgetAmount: 50, status: 'paused' }); expect((await f.property.get()).data()).toEqual(property); const count = mocks.fetch.mock.calls.length; expect(await f.run()).toEqual(proof); expect(mocks.fetch).toHaveBeenCalledTimes(count); expect((await f.campaign.collection('imageOptimizations').get()).docs[0].data().state).toBe('completed'); });
    it('recovers a lost response with a single write', async () => { const f = await fixture(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const result = await original(url, init); if (init?.method === 'POST')
        throw Error('lost'); return result; }); expect((await f.run()).onlyImageChanged).toBe(true); expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1); });
    it('does not redispatch unknown writes and reconciles later visibility', async () => { const f = await fixture(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { if (init?.method === 'POST')
        throw Error('uncertain'); return original(url, init); }); await expect(f.run()).rejects.toThrow(); await expect(f.run()).rejects.toThrow(); expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1); f.objects['3'].creative.id = '5'; expect((await f.run()).onlyImageChanged).toBe(true); expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1); });
    it.each(['member', 'property', 'grant', 'campaign'])('rejects stale %s before provider calls', async (kind) => { const f = await fixture(); if (kind === 'member')
        await f.member.update({ role: 'agent' }); if (kind === 'property')
        await f.property.update({ images: [] }); if (kind === 'grant')
        await f.grant.update({ connected: false }); if (kind === 'campaign')
        await f.campaign.update({ budgetAmount: 80 }); await expect(f.run()).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled(); });
    it('rejects text changes before creating an intent', async () => { const f = await fixture(); f.objects['5'].object_story_spec.link_data.message = 'Different'; await expect(f.run()).rejects.toThrow(); expect((await f.campaign.collection('imageOptimizations').get()).empty).toBe(true); expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false); });
    it('keeps concurrent CRM changes and leaves the intent unresolved', async () => { const f = await fixture(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const result = await original(url, init); if (init?.method === 'POST')
        await f.campaign.update({ budgetAmount: 80 }); return result; }); await expect(f.run()).rejects.toThrow(); expect((await f.campaign.get()).data()).toMatchObject({ budgetAmount: 80, metaCreativeId: '4' }); expect((await f.campaign.collection('imageOptimizations').get()).docs[0].data().state).toBe('pending'); });
    it('does not recreate a campaign deleted during the external request', async () => { const f = await fixture(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const result = await original(url, init); if (init?.method === 'POST')
        await f.campaign.delete(); return result; }); await expect(f.run()).rejects.toThrow(); expect((await f.campaign.get()).exists).toBe(false); });
});
