import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { readSocialDashboard } from '../social-dashboard';
import { chatTurn } from '../workspace';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('social dashboard through persisted chat', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => { if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required'); db = new Firestore({ projectId: 'demo-imodeus-social-dashboard' }); mocks.fetch.mockRejectedValue(new Error('External calls forbidden')); vi.stubGlobal('fetch', mocks.fetch); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture(role = 'admin') {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { agencyId, uid, role, adminDb: db } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await agency.set({ name: 'Synthetic' }); await profile.set({ agencyId, role });
    const connections = agency.collection('channelConnections');
    const raw = { agencyId, channel: 'messenger', name: 'Pagina agenției', status: 'connected', token: 'SECRET', capabilities: { publish: { status: 'active', reason: 'SECRET' }, comments: { status: 'active' }, insights: { status: 'active' } } };
    await connections.doc('healthy').set(raw);
    await connections.doc('blocked').set({ ...raw, channel: 'instagram', name: 'Instagram', capabilities: { publish: { status: 'reconnect_required', reason: 'SECRET' } } });
    await connections.doc('foreign').set({ ...raw, agencyId: 'other', name: 'HIDDEN' });
    await connections.doc('deleted').set({ ...raw, deletedAt: 'now', name: 'HIDDEN' });
    await connections.doc('wa').set({ ...raw, channel: 'whatsapp', name: 'HIDDEN' });
    const posts = agency.collection('socialPosts');
    const post = { agencyId, createdAt: new Date().toISOString(), propertyId: 'property', propertyTitle: 'Cișmigiu', text: 'SECRET', status: 'needs_review', destinations: { blocked: { status: 'failed', error: 'SECRET' } } };
    await posts.doc('post').set(post); await posts.doc('foreign').set({ ...post, agencyId: 'other', propertyTitle: 'HIDDEN' });
    return { ctx, agency, profile, connections, posts };
  }
  for (const scenarioId of ['master-0385', 'master-0387']) it('executes original ' + scenarioId, async () => {
    const f = await fixture(), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
    const before = (await f.posts.get()).docs.map(doc => doc.data());
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined();
    expect(result.message.cards?.[0].rows.map(row => row.id)).toEqual(scenarioId === 'master-0385' ? ['blocked'] : ['blocked', 'healthy']);
    if (scenarioId === 'master-0387') expect(result.message.cards?.find(card => card.source === 'socialPosts')?.rows.map(row => row.id)).toEqual(['post']);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|HIDDEN/); expect(result.message.text).toContain('Nu am verificat live');
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    expect((await f.posts.get()).docs.map(doc => doc.data())).toEqual(before); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-social-dashboard', { recursive: true }); await writeFile('.tmp/jarvis-social-dashboard/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Original persisted chat and local Firestore social configuration/history. No live Meta diagnostic or external publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('keeps social post history admin-only and rejects revoked membership', async () => {
    const f = await fixture('agent'); const report = await readSocialDashboard(f.ctx, 'dashboard');
    expect(report.posts).toEqual([]); expect(report.connections).toHaveLength(2); expect(report.text).toContain('administratorului');
    await f.profile.update({ agencyId: 'other' }); await expect(readSocialDashboard(f.ctx, 'dashboard')).rejects.toThrow('Acces');
  });
  it('rereads changed connection capability and handles empty configuration', async () => {
    const f = await fixture(); await f.connections.doc('blocked').update({ status: 'disconnected' });
    expect((await readSocialDashboard(f.ctx, 'problems')).connections[0].status).toBe('disconnected');
    for (const doc of (await f.connections.get()).docs) await doc.ref.delete();
    expect((await readSocialDashboard(f.ctx, 'dashboard')).connections).toEqual([]);
  });
});
