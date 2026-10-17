import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: null as any, fetch: vi.fn(), actor: null as any }));
vi.mock('@/firebase/admin', () => ({ get adminDb() { return mocks.db; } }));
import { prepareMetaImageProposal, executeMetaImageProposal } from '@/lib/meta-image-workflow';
vi.mock('@/lib/meta-image-download',()=>({downloadMetaImage:async()=>({bytes:Buffer.from([255,216,255,1]),mime:'image/jpeg',extension:'jpg'})}));
import {resumeMetaImageProposal} from '../meta-image-resume';
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
        const images:Record<string,unknown>[]=[];
        mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
            const u = new URL(url);
            if (init?.method === 'HEAD') {
                expect(u.origin).toBe('https://example.invalid');
                return new Response(null, { headers: { 'content-type': 'image/jpeg' } });
            }
            expect(u.origin).toBe('https://graph.facebook.com');
            const id = u.pathname.split('/').at(-1)!;
            if (init?.method === 'POST') {
                if (id === 'adimages') {
                    expect(init.body).toBeInstanceOf(FormData);const file=(init.body as FormData).get('filename') as File;
                    expect(file.name).toMatch(/^imo_[a-f0-9-]+[.]jpg$/);expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([255,216,255,1]);
                    images.push({name:file.name,account_id:'6',hash:'new',status:'ACTIVE'});
                    return Response.json({ hash: 'new' });
                }
                const body = Object.fromEntries(new URLSearchParams(String(init.body)));
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
            if (id === 'adimages')return Response.json({data:images});
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
        return { campaign, property, member, grant, objects, images, approval, ctx, actor, send, sessionId, prepare, run };
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

    it('continues the full chat after a lost image upload response with only one upload',async()=>{
     const f=await fixture(),original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const result=await original(url,init);if(init?.method==='POST'&&new URL(url).pathname.endsWith('/adimages'))throw Error('lost');return result;});
     await f.send('Aplică doar optimizarea pe care am aprobat-o.');const offer=await f.send('Imagine optimizare Meta: campaign/0');const result=await f.send('Confirm optimizarea Meta: '+offer.message.cards![0].rows[0].id);
     expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');expect((await f.campaign.get()).data().metaCreativeId).toBe('5');expect(mocks.fetch.mock.calls.filter(([url,init])=>init?.method==='POST'&&new URL(url).pathname.endsWith('/adimages'))).toHaveLength(1);
    });
    it('reconciles later visibility without another upload or download',async()=>{const f=await fixture(),p=await f.prepare(),original=mocks.fetch.getMockImplementation()!;let visible=false;mocks.fetch.mockImplementation(async(url,init)=>{const u=new URL(url);if(u.pathname.endsWith('/adimages')&&init?.method!=='POST')return Response.json({data:visible?f.images:[]});const result=await original(url,init);if(init?.method==='POST'&&u.pathname.endsWith('/adimages'))throw Error('lost');return result;});await expect(f.run(p.proposalId)).rejects.toThrow();visible=true;expect((await f.run(p.proposalId)).proof.onlyImageChanged).toBe(true);expect(mocks.fetch.mock.calls.filter(([url,init])=>init?.method==='POST'&&new URL(url).pathname.endsWith('/adimages'))).toHaveLength(1);});
    it('recovers from the second page using only a cursor on the fixed account endpoint',async()=>{const f=await fixture(),p=await f.prepare(),original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const u=new URL(url);if(u.pathname.endsWith('/adimages')&&init?.method!=='POST'){expect(u.searchParams.get('name')).toBe(f.images[0].name);return Response.json(u.searchParams.has('after')?{data:f.images}:{data:[],paging:{next:'https://untrusted.invalid/ignored',cursors:{after:'second'}}});}const result=await original(url,init);if(init?.method==='POST'&&u.pathname.endsWith('/adimages'))throw Error('lost');return result;});expect((await f.run(p.proposalId)).proof.onlyImageChanged).toBe(true);});
    it.each(['account','deleted','missing-hash','duplicate','paging-loop','missing-cursor','missing-data'])('does not adopt ambiguous image recovery: %s',async mode=>{const f=await fixture(),p=await f.prepare(),original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const u=new URL(url);if(u.pathname.endsWith('/adimages')&&init?.method!=='POST'){const row={...f.images[0]};if(mode==='account')row.account_id='999';if(mode==='deleted')row.status='DELETED';if(mode==='missing-hash')delete row.hash;return Response.json(mode==='missing-data'?{}:mode==='paging-loop'||mode==='missing-cursor'?{data:[row],paging:{next:'next',cursors:mode==='paging-loop'?{after:'same'}:{}}}:{data:mode==='duplicate'?[row,{...row,hash:'another'}]:[row]});}const result=await original(url,init);if(init?.method==='POST'&&u.pathname.endsWith('/adimages'))throw Error('lost');return result;});await expect(f.run(p.proposalId)).rejects.toThrow();expect(f.objects['3'].creative.id).toBe('4');expect((await f.campaign.get()).data().metaCreativeId).toBe('4');});
    it('does not reinterpret legacy uncertain uploads as new uploads',async()=>{const f=await fixture(),p=await f.prepare();await f.campaign.collection('imageProposals').doc(p.proposalId).update({uploadStartedAt:new Date().toISOString()});await expect(f.run(p.proposalId)).rejects.toThrow('veche');expect(mocks.fetch.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);});
    it('rechecks membership before saving a recovered image',async()=>{const f=await fixture(),p=await f.prepare(),original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const result=await original(url,init);if(new URL(url).pathname.endsWith('/adimages')){if(init?.method==='POST')throw Error('lost');await f.member.update({role:'agent'});}return result;});await expect(f.run(p.proposalId)).rejects.toThrow();expect(f.objects['3'].creative.id).toBe('4');expect((await f.campaign.collection('imageProposals').doc(p.proposalId).get()).data().imageHash).toBeUndefined();});

    async function uncertainChat(){
     const f=await fixture(),original=mocks.fetch.getMockImplementation()!;let visible=false;
     mocks.fetch.mockImplementation(async(url,init)=>{const u=new URL(url);if(u.pathname.endsWith('/adimages')&&init?.method!=='POST')return Response.json({data:visible?f.images:[]});const result=await original(url,init);if(init?.method==='POST'&&u.pathname.endsWith('/adimages'))throw Error('lost');return result;});
     await f.send('Aplică doar optimizarea pe care am aprobat-o.');const offered=await f.send('Imagine optimizare Meta: campaign/0'),proposalId=String(offered.message.cards![0].rows[0].id),requestId=randomUUID();const uncertain=await f.send('Confirm optimizarea Meta: '+proposalId,requestId);
     expect(uncertain.message.text).not.toContain('Meta a confirmat schimbarea fotografiei');const ledger=f.campaign.parent.parent!.collection('assistantExecutions').doc(requestId+'-safe-0');expect((await ledger.get()).data().status).toBe('unknown');
     return {...f,proposalId,ledger,show:()=>{visible=true;}};
    }
    it('resumes through chat without repeating selection or approval and completes the original ledger',async()=>{
     const f=await uncertainChat();f.show();const requestId=randomUUID(),result=await f.send('Reia optimizarea Meta.',requestId);
     expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');expect((await f.ledger.get()).data()).toMatchObject({status:'completed',result:{completionSatisfied:true}});expect((await f.campaign.get()).data().metaCreativeId).toBe('5');
     expect(mocks.fetch.mock.calls.filter(([url,init])=>init?.method==='POST'&&new URL(url).pathname.endsWith('/adimages'))).toHaveLength(1);expect(mocks.fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(3);
     const count=mocks.fetch.mock.calls.length;expect((await f.send('Reia optimizarea Meta.',requestId)).message.id).toBe(result.message.id);expect(mocks.fetch).toHaveBeenCalledTimes(count);
     const done=await f.send('Reia optimizarea Meta.');expect(done.message.text).toContain('Nu există');expect(mocks.fetch).toHaveBeenCalledTimes(count);
    });
    it('allows an exact approved proposal to resume without reconstructing the prior offer',async()=>{const f=await uncertainChat();f.show();const result=await f.send('Reia optimizarea Meta: campaign/'+f.proposalId);expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');});
    it('keeps unknown state while the asset is invisible and later resumes successfully',async()=>{const f=await uncertainChat();await f.send('Reia optimizarea Meta.');expect((await f.ledger.get()).data().status).toBe('unknown');f.show();const result=await f.send('Continuă optimizarea Meta.');expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');expect((await f.ledger.parent.where('status','==','unknown').get()).empty).toBe(true);expect(mocks.fetch.mock.calls.filter(([url,init])=>init?.method==='POST'&&new URL(url).pathname.endsWith('/adimages'))).toHaveLength(1);});
    it.each(['actor','running','operation','resume-only','proposal'])('does not resume an ineligible original execution: %s',async kind=>{const f=await uncertainChat();f.show();if(kind==='actor')await f.ledger.update({actorId:'other'});if(kind==='running')await f.ledger.update({status:'running'});if(kind==='operation')await f.ledger.update({'action.operation':'meta_campaign_publish'});if(kind==='resume-only')await f.ledger.update({'action.body.resume':true});if(kind==='proposal')await f.ledger.update({'action.body.proposalId':'0'.repeat(64)});mocks.fetch.mockClear();const result=await f.send('Reia optimizarea Meta.');expect(result.message.text).not.toContain('Meta a confirmat schimbarea fotografiei');expect(mocks.fetch).not.toHaveBeenCalled();});
    it('does not authorize a direct resume from a prepared but never executed proposal',async()=>{const f=await fixture(),p=await f.prepare();mocks.fetch.mockClear();await expect(resumeMetaImageProposal(f.ctx,'campaign',p.proposalId)).rejects.toThrow();expect(mocks.fetch).not.toHaveBeenCalled();});
    it('respects a different current property on resume',async()=>{const f=await uncertainChat();f.show();await f.property.parent.doc('other').set({agencyId:f.ctx.agencyId});mocks.fetch.mockClear();const result=await chatTurn(f.ctx,{sessionId:f.sessionId,requestId:randomUUID(),prompt:'Reia optimizarea Meta.',currentRecord:{resource:'properties',id:'other'}});expect(result.message.text).toContain('Nu există');expect(mocks.fetch).not.toHaveBeenCalled();});
    it.each(['campaign','property','grant','member'])('does not resume after changing %s',async kind=>{const f=await uncertainChat();f.show();if(kind==='campaign')await f.campaign.update({budgetAmount:80});if(kind==='property')await f.property.update({images:[]});if(kind==='grant')await f.grant.update({connected:false});if(kind==='member')await f.member.update({role:'agent'});mocks.fetch.mockClear();if(kind==='member'){await expect(f.send('Reia optimizarea Meta.')).rejects.toThrow('Acces revocat');expect(mocks.fetch).not.toHaveBeenCalled();expect((await f.ledger.get()).data().status).toBe('unknown');return;}const result=await f.send('Reia optimizarea Meta.');expect(result.message.text).not.toContain('Meta a confirmat schimbarea fotografiei');expect(mocks.fetch).not.toHaveBeenCalled();expect((await f.ledger.get()).data().status).toBe('unknown');});
    it('rechecks the original execution before continuing after a provider read',async()=>{const f=await uncertainChat();f.show();const original=mocks.fetch.getMockImplementation()!;let changed=false;mocks.fetch.mockImplementation(async(url,init)=>{const result=await original(url,init);if(!changed){changed=true;await f.ledger.update({status:'cancelled'});}return result;});const posts=mocks.fetch.mock.calls.filter(([,init])=>init?.method==='POST').length;const result=await f.send('Reia optimizarea Meta.');expect(result.message.text).not.toContain('Meta a confirmat schimbarea fotografiei');expect(mocks.fetch.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(posts);expect((await f.ledger.get()).data().status).toBe('cancelled');});

    it('recovers an uncertain execution receipt after the CRM update was already committed',async()=>{const f=await uncertainChat();f.show();await f.run(f.proposalId);mocks.fetch.mockClear();const result=await f.send('Reia optimizarea Meta.');expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');expect((await f.ledger.get()).data().status).toBe('completed');expect(mocks.fetch).not.toHaveBeenCalled();});
    it('offers a choice for multiple approved uncertain proposals without dispatching',async()=>{const f=await uncertainChat();const other=f.campaign.parent.doc('other'),p=(await f.campaign.collection('imageProposals').doc(f.proposalId).get()).data();await other.set({...((await f.campaign.get()).data()),campaignName:'Other'});await other.collection('imageProposals').doc(f.proposalId).set({...p,campaignId:'other'});const ledger=(await f.ledger.get()).data();await f.ledger.parent.doc('other-ledger').set({...ledger,action:{...ledger.action,params:{campaignId:'other'}}});mocks.fetch.mockClear();const choice=await f.send('Reia optimizarea Meta.');expect(choice.message.cards?.[0].source).toBe('metaImageResumeSelection');expect(choice.message.cards?.[0].rows).toHaveLength(2);expect(mocks.fetch).not.toHaveBeenCalled();f.show();const result=await f.send('Reia optimizarea Meta: campaign/'+f.proposalId);expect(result.message.text).toContain('Meta a confirmat schimbarea fotografiei');expect((await f.ledger.parent.doc('other-ledger').get()).data().status).toBe('unknown');expect((await other.get()).data().metaCreativeId).toBe('4');});
});
