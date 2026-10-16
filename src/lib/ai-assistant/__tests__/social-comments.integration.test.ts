import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { seal } from '@/lib/communications/crypto';
import { chatTurn } from '../workspace';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('social comments through chat and integration service', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [], secrets: string[] = [];
  beforeAll(() => { if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required'); db = new Firestore({ projectId: 'demo-imodeus-social-comments' }); vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-local-test-key'); vi.stubGlobal('fetch', mocks.fetch); });
  beforeEach(() => { mocks.fetch.mockReset(); mocks.fetch.mockRejectedValue(new Error('Unexpected external call')); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); for (const id of secrets) await db.collection('communicationSecrets').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  async function fixture(channel = 'messenger') {
    const agencyId = randomUUID(), uid = randomUUID(), connectionId = randomUUID(); agencies.push(agencyId); users.push(uid); secrets.push(connectionId);
    const ctx = { agencyId, uid, role: 'admin', adminDb: db } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await profile.set({ agencyId, role: 'admin' }); await agency.set({ name: 'Synthetic' });
    const connection = agency.collection('channelConnections').doc(connectionId);
    await connection.set({ agencyId, channel, externalId: '123', status: 'connected', capabilities: { comments: { status: 'active' } } });
    await db.collection('communicationSecrets').doc(connectionId).set({ agencyId, token: seal('SYNTHETIC_TOKEN') });
    const post = agency.collection('socialPosts').doc('post');
    await post.set({ agencyId, propertyTitle: 'Cișmigiu', destinations: { [connectionId]: { channel, status: 'published', externalId: '123_456' } } });
    const sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === 'master-0379')!.text;
    const first = await chatTurn(ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: null });
    return { ctx, profile, post, connection, connectionId, sessionId, prompt, first, input: { sessionId, requestId: randomUUID(), prompt: 'Postare socială: post; Cont social: ' + connectionId, currentRecord: null } };
  }
  for (const channel of ['messenger', 'instagram']) it('reads original master-0379 on ' + channel + ' and replays without another provider request', async () => {
    const f = await fixture(channel);
    expect(f.first.message.cards?.[0].rows).toHaveLength(1); expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: [channel === 'messenger' ? { id: '9', message: 'Mai este disponibil?', from: { name: 'Alin', token: 'SECRET' }, created_time: '2026-10-16T04:30:00Z' } : { id: '9', text: 'Mai este disponibil?', username: 'Alin', timestamp: '2026-10-16T04:30:00Z', secret: 'SECRET' }], paging: { next: 'https://provider.invalid/SECRET' } }), { status: 200 }));
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.[0].source).toBe('socialComments');
    expect(result.message.cards?.[0].complete).toBe(false);
    expect(result.message.cards?.[0].rows[0].description).toContain('07:30');
    expect(result.message.cards?.[0].rows[0].text).toBe('Mai este disponibil?');
    expect(JSON.stringify(result)).not.toMatch(/SECRET|SYNTHETIC_TOKEN/);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.fetch.mock.calls[0]; expect(url).toContain('/123_456/comments?fields=' + (channel === 'messenger' ? 'id,message' : 'id,text')); expect(options.method).toBe('GET');
    expect((await chatTurn(f.ctx, f.input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect((await f.post.get()).data()?.destinations[f.connectionId].status).toBe('published');
    if (channel === 'messenger') { await mkdir('.tmp/jarvis-social-comments', { recursive: true }); await writeFile('.tmp/jarvis-social-comments/master-0379.json', JSON.stringify({ scenarioId: 'master-0379', prompt: f.prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat, explicit selection and existing social service on local Firestore; Meta HTTP response simulated.', runs: [{ phase: 'original', final: f.first.message }, { phase: 'selection', final: result.message }] }, null, 2)); }
  });
  it.each(['revoked', 'deleted', 'disconnected', 'unoffered'])('does not call Meta after %s', async reason => {
    const f = await fixture();
    if (reason === 'revoked') await f.profile.update({ agencyId: 'other' });
    if (reason === 'deleted') await f.post.update({ deletedAt: 'now' });
    if (reason === 'disconnected') await f.connection.update({ status: 'disconnected' });
    if (reason === 'unoffered') f.input.prompt = 'Postare socială: foreign; Cont social: ' + f.connectionId;
    if (reason === 'revoked') { await expect(chatTurn(f.ctx, f.input)).rejects.toThrow('Acces revocat'); expect(mocks.fetch).not.toHaveBeenCalled(); return; }
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.some(card => card.source === 'socialComments')).not.toBe(true); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not turn a provider failure into an empty successful list', async () => {
    const f = await fixture(); mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'SECRET', code: 1 } }), { status: 503 }));
    const result = await chatTurn(f.ctx, f.input); expect(result.message.text).toContain('Nu am putut'); expect(JSON.stringify(result)).not.toContain('SECRET');
  });
});
