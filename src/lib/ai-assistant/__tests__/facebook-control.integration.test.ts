import { withAssistantPrincipal, INTERNAL_PRINCIPAL_HEADER } from '../principal';
import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn(), runner: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/facebook-cloud-server', async importOriginal => ({ ...await importOriginal<any>(), facebookRunnerRequest: mocks.runner }));
import { PATCH, DELETE } from '@/app/api/marketing/facebook-cloud/jobs/[jobId]/route';
import { commitFacebookControl } from '@/lib/facebook-job-control';
import { chatTurn } from '../workspace';
import { tomorrowBucharest } from '../facebook-monitor';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Facebook controls through real chat and handlers', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-facebook-control' }); vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(() => { mocks.fetch.mockReset().mockRejectedValue(new Error('External requests forbidden')); mocks.runner.mockReset(); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture(mode = 'local') {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any;
    mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    const groups = [{ name: 'Vânzări', url: 'https://www.facebook.com/groups/sale', purpose: 'sale' }];
    await agency.set({ facebookGroups: groups }); await profile.set({ agencyId, role: 'agent' });
    await agency.collection('properties').doc('property').set({ title: 'Cișmigiu', transactionType: 'Vanzare' });
    const connection = agency.collection('facebookCloudConnections').doc('connection');
    await connection.set({ agencyId, ownerUid: uid, status: 'connected', runnerMode: mode, deviceId: 'device', label: 'Cont' });
    const device = agency.collection('facebookLocalRunnerDevices').doc('device'); await device.set({ ownerUid: uid, status: 'online' });
    const raw = { id: 'job', agencyId, ownerUid: uid, propertyId: 'property', propertyTitle: 'Cișmigiu', connectionId: 'connection', runnerMode: mode, deviceId: 'device', status: 'scheduled', scheduledAt: tomorrowBucharest(new Date()) + 'T04:00:00.000Z', updatedAt: new Date().toISOString(), groups: groups.map(g => ({ ...g, status: 'queued' })), currentGroupIndex: 0 };
    const job = agency.collection('facebookCloudPublishingJobs').doc('job'); await job.set(raw);
    mocks.runner.mockImplementation(async (_path, options) => ({ job: options?.method === 'PATCH' ? { ...raw, ...JSON.parse(options.body), groups: JSON.parse(options.body).groups.map((g: any) => ({ ...g, status: 'queued' })) } : { ...raw, status: 'cancelled' } }));
    return { ctx, agency, profile, connection, device, job, raw };
  }
  function request(method: string, body: any) { return new NextRequest('http://localhost/api/marketing/facebook-cloud/jobs/job', { method, headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  function moveBody(f: any) { return { connectionId: 'connection', groupUrls: f.raw.groups.map((g: any) => g.url), scheduledAt: tomorrowBucharest(new Date()) + 'T05:00:00.000Z', expectedUpdatedAt: f.raw.updatedAt }; }
  for (const mode of ['local', 'cloud']) for (const scenarioId of ['master-0365', 'master-0366']) it('executes ' + scenarioId + ' with ' + mode + ' runner', async () => {
    const f = await fixture(mode), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined();
    const row = (await f.job.get()).data()!;
    expect(row.status).toBe(scenarioId === 'master-0365' ? 'scheduled' : 'cancelled');
    expect(result.message.text).toContain(scenarioId === 'master-0365' ? 'a fost reprogramat' : 'a fost anulat');
    if (scenarioId === 'master-0365') { expect(result.message.text).toContain('08:00'); expect(row.groups).toEqual(f.raw.groups); expect(row.connectionId).toBe('connection'); }
    const repeat = await chatTurn(f.ctx, input); expect(repeat.message.id).toBe(result.message.id);
    expect(mocks.runner).toHaveBeenCalledTimes(mode === 'cloud' ? 1 : 0); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-control', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-control/' + scenarioId + '-' + mode + '-latest.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Real chat/autonomy/API and local Firestore. Runner ' + mode + '; cloud transport simulated, no external publications.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it('continues an ambiguous selection without another permission step', async () => {
    const f = await fixture(); await f.agency.collection('facebookCloudPublishingJobs').doc('second').set({ ...f.raw, id: 'second' });
    const sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Anulează jobul dacă fluxul suportă anularea.', currentRecord: null });
    expect(first.message.text).toContain('Job Facebook: ID'); expect((await f.job.get()).data()?.status).toBe('scheduled');
    const next = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Job Facebook: second', currentRecord: null });
    expect(next.message.text).toContain('a fost anulat'); expect((await f.agency.collection('facebookCloudPublishingJobs').doc('second').get()).data()?.status).toBe('cancelled'); expect((await f.job.get()).data()?.status).toBe('scheduled');
  });
  it.each(['owner', 'agency', 'revision', 'started', 'device', 'connection', 'profile'])('blocks stale or inaccessible control: %s', async change => {
    const f = await fixture();
    if (change === 'owner') await f.job.update({ ownerUid: 'other' });
    if (change === 'agency') await f.job.update({ agencyId: 'other' });
    if (change === 'revision') await f.job.update({ updatedAt: '2000-01-01T00:00:00.000Z' });
    if (change === 'started') await f.job.update({ status: 'running', leaseToken: 'secret' });
    if (change === 'device') await f.device.update({ revokedAt: 'now' });
    if (change === 'connection') await f.connection.update({ status: 'needs_reauthentication' });
    if (change === 'profile') await f.profile.update({ role: 'disabled' });
    const response = await PATCH(request('PATCH', moveBody(f)), { params: Promise.resolve({ jobId: 'job' }) });
    expect(response.status).toBeGreaterThanOrEqual(400); expect((await f.job.get()).data()?.scheduledAt).toBe(f.raw.scheduledAt); expect(mocks.runner).not.toHaveBeenCalled();
  });
  it('does not overwrite a concurrent runner claim', async () => {
    const f = await fixture(), snapshot = await f.job.get(); await f.job.update({ status: 'running', leaseToken: 'secret' });
    await expect(commitFacebookControl(db as any, f.ctx.agencyId, f.ctx.uid, snapshot as any, { status: 'scheduled' }, false)).rejects.toThrow('schimbat'); expect((await f.job.get()).data()?.status).toBe('running');
  });
  it('does not cancel completed work and is idempotent for cancelled work', async () => {
    const f = await fixture(); await f.job.update({ status: 'completed' });
    expect((await DELETE(request('DELETE', {}), { params: Promise.resolve({ jobId: 'job' }) })).status).toBe(409);
    await f.job.update({ status: 'cancelled' }); expect((await DELETE(request('DELETE', {}), { params: Promise.resolve({ jobId: 'job' }) })).status).toBe(200);
    expect((await f.job.get()).data()?.status).toBe('cancelled');
  });
  it.each(['wrong-owner', 'wrong-time', 'unconfirmed', 'timeout', 'race'])('does not confirm unreliable cloud response: %s', async variant => {
    const f = await fixture('cloud');
    mocks.runner.mockImplementation(async () => {
      if (variant === 'timeout') throw new Error('Runner timeout');
      if (variant === 'race') await f.job.update({ status: 'running' });
      return { job: { ...f.raw, scheduledAt: moveBody(f).scheduledAt, ...(variant === 'wrong-owner' ? { ownerUid: 'other' } : variant === 'wrong-time' ? { scheduledAt: f.raw.scheduledAt } : variant === 'unconfirmed' ? { status: 'running' } : {}) } };
    });
    expect((await PATCH(request('PATCH', moveBody(f)), { params: Promise.resolve({ jobId: 'job' }) })).status).toBeGreaterThanOrEqual(400);
    expect((await f.job.get()).data()?.scheduledAt).toBe(f.raw.scheduledAt);
  });
  it('serializes cancellation against a simultaneous reschedule', async () => {
    const f = await fixture();
    const invoke = (handler: typeof PATCH, method: string, body: any) => withAssistantPrincipal(f.ctx, async () => {
      const req = request(method, body); req.headers.set('authorization', INTERNAL_PRINCIPAL_HEADER);
      return handler(req, { params: Promise.resolve({ jobId: 'job' }) });
    });
    const results = await Promise.all([
      invoke(PATCH, 'PATCH', moveBody(f)),
      invoke(DELETE, 'DELETE', { expectedUpdatedAt: f.raw.updatedAt }),
    ]);
    expect(results.filter(result => result.ok)).toHaveLength(1);
    const outcomes = await Promise.all(results.map(async result => ({ status: result.status, body: await result.json() })));
    expect(outcomes.filter(result => result.status === 409), JSON.stringify(outcomes)).toHaveLength(1);
  });
  it('cancels future local work without erasing submitted group evidence', async () => {
    const f = await fixture(); const groups = [{ ...f.raw.groups[0], status: 'submitted', submittedAt: new Date().toISOString() }];
    await f.job.update({ status: 'running', groups, leaseToken: 'secret', leaseExpiresAt: Date.now() + 60000 });
    const result = await DELETE(request('DELETE', {}), { params: Promise.resolve({ jobId: 'job' }) });
    expect(result.status).toBe(200); expect((await f.job.get()).data()).toMatchObject({ status: 'cancelled', groups, leaseToken: null, leaseExpiresAt: null });
  });
  it.each(['owner', 'agency', 'unconfirmed', 'timeout'])('does not cancel through an invalid cloud result: %s', async variant => {
    const f = await fixture('cloud');
    mocks.runner.mockImplementation(async () => {
      if (variant === 'timeout') throw new Error('Timeout');
      return { job: { ...f.raw, status: 'cancelled', ...(variant === 'owner' ? { ownerUid: 'other' } : variant === 'agency' ? { agencyId: 'other' } : { status: 'running' }) } };
    });
    expect((await DELETE(request('DELETE', {}), { params: Promise.resolve({ jobId: 'job' }) })).status).toBeGreaterThanOrEqual(400);
    expect((await f.job.get()).data()?.status).toBe('scheduled');
  });
  it('rechecks group eligibility at commit', async () => {
    const f = await fixture(); const snapshot = await f.job.get();
    await f.agency.update({ facebookGroups: [{ name: 'Alt grup', url: 'https://www.facebook.com/groups/other', purpose: 'sale' }] });
    await expect(commitFacebookControl(db as any, f.ctx.agencyId, f.ctx.uid, snapshot as any, { ...f.raw, scheduledAt: moveBody(f).scheduledAt }, false)).rejects.toThrow('Grupurile');
    expect((await f.job.get()).data()?.scheduledAt).toBe(f.raw.scheduledAt);
  });
  it('rejects a deleted cloud account before contacting the runner', async () => {
    const f = await fixture('cloud'); await f.connection.update({ deletedAt: new Date().toISOString() });
    expect((await PATCH(request('PATCH', moveBody(f)), { params: Promise.resolve({ jobId: 'job' }) })).status).toBe(403);
    expect(mocks.runner).not.toHaveBeenCalled(); expect((await f.job.get()).data()?.scheduledAt).toBe(f.raw.scheduledAt);
  });
});
