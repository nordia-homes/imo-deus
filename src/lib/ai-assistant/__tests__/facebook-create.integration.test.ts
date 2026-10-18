import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn(), runner: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/facebook-cloud-server', async importOriginal => ({ ...await importOriginal<any>(), facebookRunnerRequest: mocks.runner }));
vi.mock('@/lib/facebook-local-server', async importOriginal => ({ ...await importOriginal<any>(), requireFacebookLocalDevice: async () => ({ adminDb: mocks.actor.adminDb, agencyId: mocks.actor.agencyId, ownerUid: mocks.actor.uid, deviceId: 'device' }) }));
import { POST } from '@/app/api/marketing/facebook-cloud/jobs/route';
import { POST as claimLocalJob } from '@/app/api/marketing/facebook-local/runner/claim/route';
import { createFacebookJob } from '@/lib/facebook-job-create';
import { chatTurn } from '../workspace';
import { tomorrowBucharest } from '../facebook-monitor';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Facebook creation through real application handlers', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-facebook-create' }); vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(() => { mocks.fetch.mockReset().mockRejectedValue(new Error('External requests forbidden')); mocks.runner.mockReset(); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture(mode = 'local') {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    const groups = [{ name: 'Vânzări', url: 'https://www.facebook.com/groups/sale', purpose: 'sale' }, { name: 'Chirii', url: 'https://www.facebook.com/groups/rent', purpose: 'rent' }];
    await agency.set({ facebookGroups: groups }); await profile.set({ agencyId, role: 'agent' });
    const property = agency.collection('properties').doc('property'); await property.set({ title: 'Apartament Cișmigiu', transactionType: 'Vanzare', defaultFacebookConnectionId: 'connection' });
    const connection = agency.collection('facebookCloudConnections').doc('connection');
    await connection.set({ agencyId, ownerUid: uid, status: 'connected', runnerMode: mode, deviceId: 'device', label: 'Cont' });
    const device = agency.collection('facebookLocalRunnerDevices').doc('device'); await device.set({ ownerUid: uid, status: 'online' });
    mocks.runner.mockImplementation(async (_path, options) => { const data = JSON.parse(options.body); return { job: { ...data, status: data.scheduledAt ? 'scheduled' : 'queued', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })), leaseToken: 'DO-NOT-COPY' } }; });
    const body = { propertyId: 'property', connectionId: 'connection', groupUrls: [groups[0].url], scheduledAt: tomorrowBucharest(new Date()) + 'T04:00:00.000Z', requestId: randomUUID() };
    return { ctx, agency, profile, property, connection, device, body, jobs: agency.collection('facebookCloudPublishingJobs') };
  }
  async function call(body: any) { return POST(new NextRequest('http://localhost/api/marketing/facebook-cloud/jobs', { method: 'POST', headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' }, body: JSON.stringify(body) })); }
  it('executes master-0395 after scheduling and detects a subsequent persisted time change', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    const job = (await f.jobs.get()).docs[0], raw = job.data();
    await f.jobs.doc('another').set({ ...raw, id: 'another', propertyId: 'other' });
    const scenarioId = 'master-0395', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].rows).toHaveLength(1);
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ id: job.id, scheduleMatches: true, activeScheduleConfirmed: true, publicationConfirmed: false });
    expect(result.message.text).toContain('07:00');
    expect((await job.ref.get()).data()).toEqual(raw);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    await job.ref.update({ scheduledAt: new Date(Date.parse(raw.scheduledAt) + 3600000).toISOString() });
    const changed = await chatTurn(f.ctx, { ...input, requestId: randomUUID() });
    expect(changed.message.text).toContain('DIFERĂ'); expect(changed.message.cards?.[0].rows[0].scheduleMatches).toBe(false);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-schedule-check', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-schedule-check/master-0395.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual scheduling through chat/executor/POST, followed by persisted-time reread and comparison on local Firestore. Cloud transport simulated.', runs: [{ phase: 'original', final: result.message }, { phase: 'changed-time', final: changed.message }] }, null, 2));
  });
  for (const mode of ['local', 'cloud']) it.each(['deleted', 'foreign-agency', 'Vândut', 'Închiriat', 'Inactiv'])('refuses unavailable property before reservation (' + mode + '): %s', async variant => {
    const f = await fixture(mode);
    await f.property.update(variant === 'deleted' ? { deletedAt: 'now' } : variant === 'foreign-agency' ? { agencyId: 'other' } : { status: variant });
    const response = await call(f.body);
    expect(response.status).toBeGreaterThanOrEqual(400); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  for (const scenarioId of ['master-0358', 'master-0362']) it('continues original immediate creation after group selection: ' + scenarioId, async () => {
    const f = await fixture('cloud'), sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    await f.property.update({ description: 'Descriere CRM exactă\nCu paragrafe.', images: ['https://example.com/photo.jpg'] });
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: { resource: 'properties', id: 'property' } });
    const groups = first.message.cards?.find(card => card.source === 'facebookGroups')?.rows || [];
    expect(groups).toHaveLength(1); expect((await f.jobs.get()).empty).toBe(true);
    const input = { sessionId, requestId: randomUUID(), prompt: 'Grupuri Facebook: ' + groups[0].id, currentRecord: null };
    const final = await chatTurn(f.ctx, input);
    expect(final.message.planId).toBeUndefined();
    expect(final.message.text).toContain('a fost creat');
    expect(final.message.text).not.toContain('Nu au fost trimise mesaje sau publicate anunțuri');
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    expect(jobs.docs[0].data()).toMatchObject({ propertyId: 'property', scheduledAt: null, status: 'queued' });
    const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
    expect(payload.propertyDescription).toBe('Descriere CRM exactă\nCu paragrafe.'); expect(payload.propertyImages).toEqual(['https://example.com/photo.jpg']);
    expect(payload.groups.map((g: any) => g.url)).toEqual(f.body.groupUrls);
    await chatTurn(f.ctx, input); expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-cloud.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Chat, explicit group selection, autonomous executor and real POST on local Firestore; cloud transport simulated. Job creation only, not Facebook publication certification.', runs: [{ phase: 'original', final: first.message }, { phase: 'selection', final: final.message }] }, null, 2));
  });
  it('executes the real Rosetti command without a model, preserves CRM content and never duplicates the job', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.property.update({ title: 'CA Rosetti | Ultra central | Complet renovat | Balcon generos', propertyType: 'Garsonieră', description: 'Text CRM EXACT.\nFără rescriere.', images: ['https://example.com/2.jpg','https://example.com/1.jpg'] });
    await f.agency.collection('properties').doc('house').set({title:'CA Rosetti | Ultra central',propertyType:'Casa',transactionType:'Vanzare'});
    for (let i=0;i<12;i++) await f.agency.collection('facebookCloudConnections').doc('extra'+i).set({ agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'cloud' });
    const input = {sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din C.A. Rosetti, ultracentral, pe grupurile Facebook.',currentRecord:null};
    const result = await chatTurn(f.ctx,input);
    expect(result.message.text).toContain('a fost creat');
    expect(result.message.text).not.toContain('Limita Jarvis');
    expect(result.message.planId).toBeUndefined();
    expect((await f.jobs.get()).size).toBe(1);
    const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
    expect(payload).toMatchObject({propertyId:'property',connectionId:'connection',propertyDescription:'Text CRM EXACT.\nFără rescriere.',propertyImages:['https://example.com/2.jpg','https://example.com/1.jpg']});
    expect(payload.groups.map((g:any)=>g.url)).toEqual(['https://www.facebook.com/groups/sale']);
    await chatTurn(f.ctx,input);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('asks only for an ambiguous account and resumes the original command', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.property.update({defaultFacebookConnectionId:null});
    await f.agency.collection('facebookCloudConnections').doc('other').set({agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'cloud'});
    const first = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din Cișmigiu pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='facebookConnections')?.rows).toHaveLength(2);
    expect((await f.jobs.get()).empty).toBe(true);
    const result = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Cont Facebook: connection',currentRecord:null});
    expect(result.message.text).toContain('a fost creat'); expect((await f.jobs.get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('continues Rosetti with the chosen existing automatic local runner and preserves exact content', async () => {
    const f=await fixture('local'),sessionId=randomUUID();
    await f.property.update({defaultFacebookConnectionId:null,title:'CA Rosetti | Ultra central | Complet renovat | Balcon generos',propertyType:'Garsonieră',description:'Exact CRM.',images:['https://example.com/original.jpg']});
    for(let i=0;i<12;i++) await f.agency.collection('facebookCloudConnections').doc('other'+i).set({agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'local',deviceId:'device'});
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din C.A. Rosetti, ultracentral, pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='facebookConnections')?.rows).toHaveLength(13);
    const input={sessionId,requestId:randomUUID(),prompt:'Cont Facebook: connection',currentRecord:null};
    const result=await chatTurn(f.ctx,input); expect(result.message.text).toContain('a fost creat');
    expect((await f.jobs.get()).size).toBe(1);
    const response=await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim',{method:'POST'}));
    expect(response.status).toBe(200);const {claim}=await response.json();
    expect(claim.property).toMatchObject({description:'Exact CRM.',images:['https://example.com/original.jpg']});
    await chatTurn(f.ctx,input);expect((await f.jobs.get()).size).toBe(1);expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.runner).not.toHaveBeenCalled();
  });
  it('asks for an ambiguous property and revalidates the selected ID', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.agency.collection('properties').doc('other').set({...((await f.property.get()).data()),title:'Alt apartament Cișmigiu'});
    const first = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din Cismigiu pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='properties')?.rows).toHaveLength(2);
    expect((await f.jobs.get()).empty).toBe(true);
    const result = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Proprietate: property',currentRecord:null});
    expect(result.message.text).toContain('a fost creat'); expect((await f.jobs.get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(['foreign','revoked','device-revoked'])('does not publish using an unavailable configured account: %s',async variant=>{
    const f=await fixture('cloud');
    await f.connection.update(variant==='device-revoked'?{runnerMode:'local'}:variant==='foreign'?{ownerUid:'someone-else'}:{status:'needs_reauthentication'});
    if(variant==='device-revoked') await f.device.update({revokedAt:'now'});
    const result=await chatTurn(f.ctx,{sessionId:randomUUID(),requestId:randomUUID(),prompt:'Publică apartamentul din Cismigiu pe grupurile Facebook.',currentRecord:null});
    expect(result.message.text).not.toContain('a fost creat'); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('revalidates selected groups instead of publishing to removed destinations', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Creează jobul de publicare Facebook.', currentRecord: { resource: 'properties', id: 'property' } });
    const id = first.message.cards!.find(card => card.source === 'facebookGroups')!.rows[0].id;
    await f.agency.update({ facebookGroups: [{ name: 'Nou', url: 'https://www.facebook.com/groups/new', purpose: 'sale' }] });
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Grupuri Facebook: ' + id, currentRecord: null });
    expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  it.each(['foreign-group', 'revoked-account', 'different-property'])('does not execute invalid continuation: %s', async variant => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Creează jobul de publicare Facebook.', currentRecord: { resource: 'properties', id: 'property' } });
    const id = first.message.cards!.find(card => card.source === 'facebookGroups')!.rows[0].id;
    if (variant === 'revoked-account') await f.connection.update({ status: 'needs_reauthentication' });
    if (variant === 'different-property') await f.agency.collection('properties').doc('other').set({ ...(await f.property.get()).data(), title: 'Altă proprietate' });
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Grupuri Facebook: ' + (variant === 'foreign-group' ? 'abcdef' : id), currentRecord: variant === 'different-property' ? { resource: 'properties', id: 'other' } : null });
    expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  for (const mode of ['local', 'cloud']) it('publishes CRM description and photos, never the conversation draft: ' + mode, async () => {
    const f = await fixture(mode), sessionId = randomUUID();
    const description = 'Descrierea agentului: Cișmigiu.\n\nText păstrat EXACT — fără reformulare.';
    const images = ['https://example.com/photo-2.jpg', 'https://example.com/photo-1.jpg'];
    await f.property.update({ description, images, price: 130000, amenities: ['Balcon'] });
    const draft = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Pregătește textul postării pentru proprietate.', currentRecord: { resource: 'properties', id: 'property' } });
    expect(draft.message.cards?.find(card => card.source === 'facebookPostDraft')?.rows[0].text).not.toBe(description);
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    expect(jobs.docs[0].data().postDraft).toBeUndefined();
    if (mode === 'cloud') {
      expect(mocks.runner).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
      expect(payload.propertyDescription).toBe(description); expect(payload.propertyImages).toEqual(images);
    } else {
      await jobs.docs[0].ref.update({ scheduledAt: new Date(Date.now() - 60000).toISOString() });
      const response = await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim', { method: 'POST' }));
      expect(response.status).toBe(200);
      const { claim } = await response.json();
      expect(claim.property.description).toBe(description); expect(claim.property.images).toEqual(images);
      expect(mocks.runner).not.toHaveBeenCalled();
    }
    expect((await f.property.get()).data()).toMatchObject({ description, images });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const mode of ['local', 'cloud']) it('executes master-0357 through chat with ' + mode, async () => {
    const f = await fixture(mode), scenarioId = 'master-0357', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('a fost creat și programat');
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    const job = jobs.docs[0].data(); expect(bucharestInputFromIso(job.scheduledAt)).toEqual({ date: tomorrowBucharest(new Date()), time: '07:00' });
    expect(job.groups.map((g: any) => g.url)).toEqual(f.body.groupUrls); expect(job.propertyId).toBe('property'); expect(job.status).toBe('scheduled'); expect(job.leaseToken).toBeUndefined();
    await chatTurn(f.ctx, input); expect((await f.jobs.get()).size).toBe(1); expect(mocks.runner).toHaveBeenCalledTimes(mode === 'cloud' ? 1 : 0); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true }); await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-' + mode + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat/autonomy/POST and local Firestore; ' + mode + ' runner, cloud transport simulated.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it('executes master-0360 without scheduling a disconnected account', async () => {
    const f = await fixture(); await f.connection.update({ status: 'needs_reauthentication' });
    const scenarioId = 'master-0360', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const result = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null });
    expect(result.message.text).toContain('blocate acum: 1'); expect((await f.jobs.get()).empty).toBe(true);
    const attempted = await call(f.body); expect(attempted.status).toBe(409); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true }); await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-local.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Chat guard and actual POST refusal against disconnected account on local Firestore.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('continues after choosing one of multiple matching properties', async () => {
    const f = await fixture(); await f.agency.collection('properties').doc('SecondID').set({ ...(await f.property.get()).data(), title: 'Apartament Cişmigiu 2' });
    const sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === 'master-0357')!.text;
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: null }); expect(first.message.text).toContain('Proprietate: ID'); expect((await f.jobs.get()).empty).toBe(true);
    const result = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Proprietate: SecondID', currentRecord: null }); expect(result.message.text).toContain('a fost creat și programat'); expect((await f.jobs.get()).docs[0].data().propertyId).toBe('SecondID');
  });
  it('serializes concurrent identical requests and rejects payload changes', async () => {
    const f = await fixture();
    const results = await Promise.all([1, 2].map(() => createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner)));
    expect(results.filter(row => row.created)).toHaveLength(1); expect(results[0].job.id).toBe(results[1].job.id); expect((await f.jobs.get()).size).toBe(1);
    await expect(createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, { ...f.body, scheduledAt: tomorrowBucharest(new Date()) + 'T05:00:00.000Z' }, mocks.runner)).rejects.toThrow('altei comenzi');
  });
  it('serializes distinct concurrent requests for the same publication', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([1, 2].map(() => createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, { ...f.body, requestId: randomUUID() }, mocks.runner)));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1); expect((await f.jobs.get()).size).toBe(1);
  });
  it.each(['timeout', 'wrong-owner', 'wrong-groups'])('fences an unconfirmed cloud dispatch: %s', async variant => {
    const f = await fixture('cloud'); mocks.runner.mockImplementation(async (_path, options) => {
      if (variant === 'timeout') throw new Error('Timeout'); const data = JSON.parse(options.body);
      return { job: { ...data, status: 'scheduled', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })), ...(variant === 'wrong-owner' ? { ownerUid: 'other' } : { groups: [] }) } };
    });
    expect((await call(f.body)).status).toBe(409); expect((await call(f.body)).status).toBe(409); expect((await call({ ...f.body, requestId: randomUUID() })).status).toBe(409);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect((await f.jobs.get()).size).toBe(1); expect((await f.jobs.get()).docs[0].data().dispatchState).toBe('unknown');
  });
  it.each(['owner', 'agency', 'deleted', 'reconnect', 'device', 'profile', 'groups'])('rejects invalid creation: %s', async variant => {
    const f = await fixture();
    if (variant === 'owner') await f.connection.update({ ownerUid: 'other' });
    if (variant === 'agency') await f.connection.update({ agencyId: 'other' });
    if (variant === 'deleted') await f.connection.update({ deletedAt: 'now' });
    if (variant === 'reconnect') await f.connection.update({ status: 'needs_reauthentication' });
    if (variant === 'device') await f.device.update({ revokedAt: 'now' });
    if (variant === 'profile') await f.profile.update({ role: 'disabled' });
    if (variant === 'groups') f.body.groupUrls = ['https://www.facebook.com/groups/rent'];
    expect((await call(f.body)).status).toBeGreaterThanOrEqual(400); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  it.each(['error', 'needs_reauthentication'])('does not restart an existing %s job as a new publication', async status => {
    const f = await fixture(); await call(f.body); const job = (await f.jobs.get()).docs[0];
    await job.ref.update({ status, groups: [{ name: 'Vânzări', url: f.body.groupUrls[0], status: 'submitted' }] });
    expect((await call({ ...f.body, requestId: randomUUID() })).status).toBe(409); expect((await f.jobs.get()).size).toBe(1);
  });
  it('does not dispatch a cloud replay while the first request is still pending', async () => {
    const f = await fixture('cloud'); let release!: () => void, started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.runner.mockImplementation(async (_path, options) => { started(); await gate; const data = JSON.parse(options.body); return { job: { ...data, status: 'scheduled', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })) } }; });
    const first = createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner);
    try { await entered; await expect(createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner)).rejects.toThrow('nu este confirmată'); }
    finally { release(); }
    await first; expect(mocks.runner).toHaveBeenCalledTimes(1); expect((await f.jobs.get()).size).toBe(1);
  });
  it('finds an apartment by Romanian location without matching a house in the same area', async () => {
    const f = await fixture(); await f.property.update({ title: 'Două camere centrale', propertyType: 'Apartament', location: 'București, Cişmigiu' });
    await f.agency.collection('properties').doc('house').set({ ...(await f.property.get()).data(), propertyType: 'Casa', title: 'Casă Cișmigiu' });
    const result = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    expect(result.message.text).toContain('a fost creat și programat'); expect((await f.jobs.get()).docs[0].data().propertyId).toBe('property');
  });
});
