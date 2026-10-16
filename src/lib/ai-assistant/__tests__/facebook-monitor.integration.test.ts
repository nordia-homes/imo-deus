import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { readFacebookMonitor, tomorrowBucharest } from '../facebook-monitor';
import { chatTurn } from '../workspace';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Facebook persisted job monitoring', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-facebook-monitor' });
    mocks.fetch.mockRejectedValue(new Error('External requests forbidden')); vi.stubGlobal('fetch', mocks.fetch);
  });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await profile.set({ agencyId, role: 'agent' }); await agency.set({ name: 'Synthetic' });
    const jobs = agency.collection('facebookCloudPublishingJobs');
    const raw = { agencyId, ownerUid: uid, propertyId: 'property', propertyTitle: 'Cișmigiu', status: 'scheduled', scheduledAt: tomorrowBucharest(new Date()) + 'T07:00:00+03:00', leaseToken: 'SECRET', errorMessage: 'SECRET', groups: [{ name: 'Trimis', status: 'submitted' }, { name: 'Aprobare', status: 'pending_approval' }, { name: 'Eșuat', status: 'error', errorMessage: 'SECRET' }] };
    await jobs.doc('job').set(raw); await jobs.doc('foreign').set({ ...raw, ownerUid: 'other', propertyTitle: 'HIDDEN' }); await jobs.doc('wrong-agency').set({ ...raw, agencyId: 'other', propertyTitle: 'HIDDEN' });
    return { ctx, agency, profile, jobs, raw };
  }
  for (const scenarioId of ['master-0399', 'master-0400']) it('executes original daily/intervention report ' + scenarioId, async () => {
    const f = await fixture(); mocks.actor = f.ctx;
    const now = new Date().toISOString();
    const groups = [{ name: 'Trimis', status: 'submitted', submittedAt: now }, { name: 'Aprobare', status: 'pending_approval', submittedAt: now }, { name: 'Eșuat', status: 'error', failedAt: now, errorMessage: 'SECRET' }];
    await f.jobs.doc('job').update({ status: 'completed', actualStartedAt: now, groups });
    await f.jobs.doc('healthy').set({ ...f.raw, status: 'queued', groups: [{ name: 'A', status: 'queued' }], updatedAt: now, scheduledAt: now });
    await f.jobs.doc('deleted').set({ ...f.raw, deletedAt: now, actualStartedAt: now });
    const before = (await f.jobs.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === scenarioId)!.text, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].rows.map(row => row.id)).toEqual(['job']);
    expect(result.message.planId).toBeUndefined(); expect(JSON.stringify(result)).not.toMatch(/SECRET|HIDDEN/);
    if (scenarioId === 'master-0399') expect(result.message.text).toContain('trimiteri înregistrate azi: 2, erori înregistrate azi: 1');
    else expect(result.message.cards?.[0].rows[0].interventionReasons).toEqual(['Există erori de publicare; verifică grupurile afectate.']);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    expect((await f.jobs.get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))).toEqual(before);
    expect((await f.agency.collection('assistantSessions').doc(input.sessionId).collection('messages').get()).size).toBeGreaterThan(0);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-monitor', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-monitor/' + scenarioId + '-latest.json', JSON.stringify({ scenarioId, prompt: input.prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted application chat and local Firestore automatic publishing jobs; no external publication or refresh.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('reports empty results and rejects revoked access for both aggregate modes', async () => {
    const f = await fixture(); await f.jobs.doc('job').delete();
    for (const mode of ['today', 'attention'] as const) expect((await readFacebookMonitor(f.ctx, mode, [])).rows).toEqual([]);
    await f.profile.update({ role: 'disabled' });
    for (const mode of ['today', 'attention'] as const) await expect(readFacebookMonitor(f.ctx, mode, [])).rejects.toThrow('Acces');
  });
  it('uses Bucharest execution dates, not schedule or last edit dates', async () => {
    const f = await fixture(), now = new Date('2026-10-25T00:30:00Z');
    await f.jobs.doc('job').update({ actualStartedAt: '2026-10-24T21:30:00Z', groups: [] });
    await f.jobs.doc('yesterday').set({ ...f.raw, actualStartedAt: '2026-10-24T20:59:00Z', updatedAt: now.toISOString(), groups: [] });
    await f.jobs.doc('scheduled').set({ ...f.raw, scheduledAt: now.toISOString(), updatedAt: now.toISOString(), groups: [] });
    const result = await readFacebookMonitor(f.ctx, 'today', [], now);
    expect(result.rows.map(row => row.id)).toEqual(['job']); expect(result.text).toContain('2026-10-25');
  });
  for (const scenarioId of ['master-0359', 'master-0363', 'master-0364', 'master-0369', 'master-0370', 'master-0371']) it('executes original ' + scenarioId, async () => {
    const f = await fixture(); mocks.actor = f.ctx;
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const request = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, request);
    const rows = result.message.cards?.flatMap(card => card.rows) || [];
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: 'job', publicationConfirmed: false, counts: { error: 1, submitted: 1, pending_approval: 1 } });
    expect(result.message.text).toContain('nu confirmă publicarea'); expect(result.message.planId).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/SECRET|HIDDEN/);
    expect((await f.agency.collection('assistantSessions').doc(request.sessionId).collection('messages').get()).size).toBeGreaterThan(0);
    await f.jobs.doc('job').update({ status: 'completed' });
    if (scenarioId !== 'master-0364') { const next = await chatTurn(f.ctx, { ...request, requestId: randomUUID() }); expect(next.message.cards?.[0].rows[0]).toMatchObject({ status: 'completed', publicationConfirmed: false }); }
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-monitor', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-monitor/' + scenarioId + '-latest.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Original prompt through persisted chat and local Firestore job snapshots; no live Facebook refresh or publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it('requires selection for multiple jobs and revalidates ownership', async () => {
    const f = await fixture(); await f.jobs.doc('second').set(f.raw);
    expect((await readFacebookMonitor(f.ctx, 'status', [])).needsSelection).toBe(true);
    mocks.actor = f.ctx;
    const response = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt: 'Job Facebook: second', currentRecord: null });
    expect(response.message.cards?.[0].rows.map(row => row.id)).toEqual(['second']);
    const history: any[] = [{ role: 'assistant', cards: [{ source: 'facebookJobs', rows: [{ id: 'job' }] }] }];
    expect((await readFacebookMonitor(f.ctx, 'status', history)).rows.map(row => row.id)).toEqual(['job']);
    await f.jobs.doc('job').update({ ownerUid: 'other' });
    expect((await readFacebookMonitor(f.ctx, 'status', history)).rows).toEqual([]);
  });
  it('rejects revoked profile and excludes cancelled tomorrow jobs', async () => {
    const f = await fixture(); await f.jobs.doc('job').update({ status: 'cancelled' });
    expect((await readFacebookMonitor(f.ctx, 'tomorrow', [])).rows).toEqual([]);
    await f.profile.update({ agencyId: 'other' }); await expect(readFacebookMonitor(f.ctx, 'status', [])).rejects.toThrow('Acces');
  });
});
