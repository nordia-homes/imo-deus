import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn(), runner: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/facebook-cloud-server', async importOriginal => ({ ...await importOriginal<any>(), facebookRunnerRequest: mocks.runner }));
import { POST } from '@/app/api/marketing/facebook-cloud/jobs/route';
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
