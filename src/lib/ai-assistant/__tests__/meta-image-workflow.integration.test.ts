import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: null as any, fetch: vi.fn(), actor: null as any }));
vi.mock('@/firebase/admin', () => ({ get adminDb() { return mocks.db; } }));
import { prepareMetaImageProposal, executeMetaImageProposal } from '@/lib/meta-image-workflow';
import { chatTurn } from '../workspace';
import { mkdir, writeFile } from 'node:fs/promises';
import { VERSIONS } from '../models';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('conversational Meta image workflow', () => {
    const agencies: string[] = [], users: string[] = [];
    beforeAll(() => {
        if (!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST || ''))
            throw Error('Local emulator required');
        mocks.db = new Firestore({ projectId: 'demo-imodeus-meta-image-workflow' });
        vi.stubGlobal('fetch', mocks.fetch);
        vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-key');
    });
    afterAll(async () => {
        if (!mocks.db)
            return;
        for (const id of agencies) {
            await mocks.db.recursiveDelete(mocks.db.collection('agencies').doc(id));
            await mocks.db.collection('agencyPrivateIntegrations').doc(id + '__meta').delete();
        }
        for (const id of users)
            await mocks.db.collection('users').doc(id).delete();
        await mocks.db.terminate();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });
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
        mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
            const u = new URL(url);
            if (init?.method === 'HEAD') {
                expect(u.origin).toBe('https://example.invalid');
                return new Response(null, { headers: { 'content-type': 'image/jpeg' } });
            }
            expect(u.origin).toBe('https://graph.facebook.com');
            const id = u.pathname.split('/').at(-1)!;
            if (init?.method === 'POST') {
                const body = Object.fromEntries(new URLSearchParams(String(init.body)));
                if (id === 'adimages') {
                    expect(body.url).toBe(approval.imageUrl);
                    return Response.json({ hash: 'new' });
                }
                if (id === 'adcreatives') {
                    expect(JSON.parse(body.object_story_spec)).toEqual(objects['5'].object_story_spec);
                    objects['5'].name = body.name;
                    return Response.json({ id: '5' });
                }
                expect(id).toBe('3');
                expect(body).toEqual({ creative: '{"creative_id":"5"}' });
                objects['3'].creative.id = '5';
                return Response.json({ success: true });
            }
            if (id === 'adcreatives')
                return Response.json({ data: [objects['5']] });
            expect(objects[id]).toBeDefined();
            return Response.json(objects[id]);
        });
        const ctx = { agencyId, uid, role: 'admin', adminDb: mocks.db } as any;
        mocks.actor = ctx;
        const sessionId = randomUUID(), send = (prompt: string, requestId = randomUUID()) => chatTurn(ctx, { sessionId, requestId, prompt, currentRecord: { resource: 'properties', id: 'property' } });
        const prepare = () => prepareMetaImageProposal(agencyId, actor, { ...approval, campaignId: 'campaign' });
        const run = (proposalId: string) => executeMetaImageProposal(agencyId, 'campaign', actor, proposalId);
        return { campaign, property, member, grant, objects, approval, ctx, actor, send, sessionId, prepare, run };
    }
    it('completes master-0439 through persisted selection, approval, real route and provider readback', async () => {
        const f = await fixture(), prompt = 'Aplică doar optimizarea pe care am aprobat-o.';
        const first = await f.send(prompt);
        expect(first.message.cards?.[0].source).toBe('metaImageSelection');
        expect(mocks.fetch).not.toHaveBeenCalled();
        const second = await f.send('Imagine optimizare Meta: campaign/0');
        expect(second.message.cards?.[0].source).toBe('metaImageApproval');
        expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
        const id = String(second.message.cards![0].rows[0].id), requestId = randomUUID(), result = await f.send('Confirm optimizarea Meta: ' + id, requestId);
        expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');
        expect(result.message.planId).toBeUndefined();
        expect((await f.campaign.get()).data()).toMatchObject({ metaCreativeId: '5', imageUrl: f.approval.imageUrl, budgetAmount: 50, status: 'paused' });
        expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(3);
        const calls = mocks.fetch.mock.calls.length;
        expect((await f.send('Confirm optimizarea Meta: ' + id, requestId)).message.id).toBe(result.message.id);
        expect(mocks.fetch).toHaveBeenCalledTimes(calls);
        await mkdir('.tmp/jarvis-meta-image-workflow', { recursive: true });
        await writeFile('.tmp/jarvis-meta-image-workflow/master-0439.json', JSON.stringify({ scenarioId: 'master-0439', prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat, actual route and domain services, local Firestore, synthetic Meta. Single image replacement in PAUSED hierarchy only; no live certification.', runs: [{ phase: 'original', final: first.message }, { phase: 'selection', final: second.message }, { phase: 'approval', final: result.message }] }, null, 2));
    });
    it('does not accept an unsolicited approval', async () => { const f = await fixture(); const r = await f.send('Confirm optimizarea Meta: ' + 'a'.repeat(64)); expect(r.message.text).toContain('s-a schimbat'); expect(mocks.fetch).not.toHaveBeenCalled(); });
    it('rejects a changed property context', async () => { const f = await fixture(); await f.send('Schimbă imaginea campaniei Meta'); const r = await f.send('Imagine optimizare Meta: campaign/0'), id = r.message.cards![0].rows[0].id; await f.property.parent.doc('other').set({ agencyId: f.ctx.agencyId }); const result = await chatTurn(f.ctx, { sessionId: f.sessionId, requestId: randomUUID(), prompt: 'Confirm optimizarea Meta: ' + id, currentRecord: { resource: 'properties', id: 'other' } }); expect(result.message.text).not.toContain('Meta a confirmat'); expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false); });
    it('rejects an alternative photo changed after selection', async () => { const f = await fixture(); await f.send('Schimbă imaginea campaniei Meta'); await f.property.update({ images: [{ url: 'https://example.invalid/other.jpg' }] }); const r = await f.send('Imagine optimizare Meta: campaign/0'); expect(r.message.text).toContain('s-a schimbat'); expect(mocks.fetch).not.toHaveBeenCalled(); });
    it.each(['member', 'property', 'grant', 'campaign'])('rejects stale %s before uploading', async (kind) => { const f = await fixture(), p = await f.prepare(); mocks.fetch.mockClear(); if (kind === 'member')
        await f.member.update({ role: 'agent' }); if (kind === 'property')
        await f.property.update({ images: [] }); if (kind === 'grant')
        await f.grant.update({ connected: false }); if (kind === 'campaign')
        await f.campaign.update({ budgetAmount: 80 }); await expect(f.run(p.proposalId)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled(); });
    it.each(['1', '2', '3'])('rejects an active hierarchy object %s before preparing', async (id) => { const f = await fixture(); f.objects[id].status = 'ACTIVE'; await expect(f.prepare()).rejects.toThrow(); expect((await f.campaign.collection('imageProposals').get()).empty).toBe(true); });
    it.each(['text', 'budget', 'tracking'])('rejects external %s changes after approval before writes', async (kind) => { const f = await fixture(), p = await f.prepare(); if (kind === 'text')
        f.objects['4'].object_story_spec.link_data.message = 'other'; if (kind === 'budget')
        f.objects['1'].daily_budget = '9000'; if (kind === 'tracking')
        f.objects['4'].url_tags = 'new'; await expect(f.run(p.proposalId)).rejects.toThrow(); expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false); });
    it('recovers a lost creative response without duplicate creation', async () => { const f = await fixture(), p = await f.prepare(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); if (init?.method === 'POST' && new URL(url).pathname.endsWith('/adcreatives'))
        throw Error('lost'); return response; }); expect((await f.run(p.proposalId)).proof.onlyImageChanged).toBe(true); expect(mocks.fetch.mock.calls.filter(([url, init]) => init?.method === 'POST' && new URL(url).pathname.endsWith('/adcreatives'))).toHaveLength(1); });
    it('recovers lost replacement response and replays the persisted proof', async () => { const f = await fixture(), p = await f.prepare(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); if (init?.method === 'POST' && new URL(url).pathname.endsWith('/3'))
        throw Error('lost'); return response; }); const result = await f.run(p.proposalId); expect(result.proof.onlyImageChanged).toBe(true); const calls = mocks.fetch.mock.calls.length; expect(await f.run(p.proposalId)).toEqual(result); expect(mocks.fetch).toHaveBeenCalledTimes(calls); });
    it('does not repeat an image upload with an unknown result', async () => { const f = await fixture(), p = await f.prepare(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { if (init?.method === 'POST' && new URL(url).pathname.endsWith('/adimages'))
        throw Error('lost'); return original(url, init); }); await expect(f.run(p.proposalId)).rejects.toThrow(); await expect(f.run(p.proposalId)).rejects.toThrow(); expect(mocks.fetch.mock.calls.filter(([url, init]) => init?.method === 'POST' && new URL(url).pathname.endsWith('/adimages'))).toHaveLength(1); expect((await f.campaign.get()).data().metaCreativeId).toBe('4'); });
    it('does not apply when membership changes during upload', async () => { const f = await fixture(), p = await f.prepare(), original = mocks.fetch.getMockImplementation()!; mocks.fetch.mockImplementation(async (url, init) => { const response = await original(url, init); if (init?.method === 'POST' && new URL(url).pathname.endsWith('/adimages'))
        await f.member.update({ role: 'agent' }); return response; }); await expect(f.run(p.proposalId)).rejects.toThrow(); expect(f.objects['3'].creative.id).toBe('4'); });
    it('rejects another actor using the proposal', async () => { const f = await fixture(), p = await f.prepare(); mocks.fetch.mockClear(); await expect(executeMetaImageProposal(f.ctx.agencyId, 'campaign', { uid: 'someone', role: 'admin' }, p.proposalId)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
