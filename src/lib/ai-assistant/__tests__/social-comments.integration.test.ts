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
  async function fixture(channel = 'messenger', scenarioId = 'master-0379') {
    const agencyId = randomUUID(), uid = randomUUID(), connectionId = randomUUID(); agencies.push(agencyId); users.push(uid); secrets.push(connectionId);
    const ctx = { agencyId, uid, role: 'admin', adminDb: db } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await profile.set({ agencyId, role: 'admin' }); await agency.set({ name: 'Synthetic' });
    const connection = agency.collection('channelConnections').doc(connectionId);
    await connection.set({ agencyId, channel, externalId: '123', status: 'connected', capabilities: { comments: { status: 'active' } } });
    await db.collection('communicationSecrets').doc(connectionId).set({ agencyId, token: seal('SYNTHETIC_TOKEN') });
    const post = agency.collection('socialPosts').doc('post');
    await post.set({ agencyId, propertyTitle: 'Cișmigiu', destinations: { [connectionId]: { channel, status: 'published', externalId: '123_456' } } });
    const sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
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
  for (const channel of ['messenger', 'instagram']) it('executes master-0384 on ' + channel + ' without inventing comment failure', async () => {
    vi.stubEnv('META_APP_ID', 'synthetic-app'); vi.stubEnv('META_APP_SECRET', 'synthetic-secret');
    const f = await fixture(channel, 'master-0384');
    await f.connection.update({ parentId: '123' });
    expect(f.first.message.cards?.[0].source).toBe('socialDiagnosticsRequest');
    mocks.fetch.mockImplementation(async (url: string, options: any) => {
      expect(options.method).toBe('GET');
      const path = new URL(url).pathname;
      const data = path.endsWith('/debug_token') ? { data: { app_id: 'synthetic-app', is_valid: true, scopes: ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement', 'instagram_basic', 'instagram_manage_comments'] } }
        : path.endsWith('/me') ? { id: '123' }
        : path.endsWith('/posts') || path.endsWith('/media') ? { data: [{ id: '123_456' }] } : { id: '123_456' };
      return new Response(JSON.stringify(data), { status: 200 });
    });
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.[0].source).toBe('socialDiagnostics');
    expect(result.message.cards?.[0].rows.find(row => row.id === 'direct')?.description).toBe('confirmat');
    expect(result.message.text).toContain('Nu verifică citirea comentariilor');
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_TOKEN|synthetic-secret|comentarii este refuzată/);
    expect(mocks.fetch).toHaveBeenCalledTimes(4);
    expect((await chatTurn(f.ctx, f.input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(4);
    expect(mocks.fetch.mock.calls.some(([url]) => url.includes(channel === 'instagram' ? '/123/media?' : '/123/posts?'))).toBe(true);
    if (channel === 'messenger') await writeFile('.tmp/jarvis-social-comments/master-0384.json', JSON.stringify({ scenarioId: 'master-0384', prompt: f.prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat, explicit selection and diagnostic service on local Firestore; four Meta GET probes simulated.', runs: [{ phase: 'original', final: f.first.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  it('reports unknown diagnostic evidence without exposing raw provider errors', async () => {
    const f = await fixture('messenger', 'master-0384');
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'SECRET diagnostic failure' } }), { status: 503 }));
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.[0].rows.find(row => row.id === 'token')?.description).toBe('necunoscut');
    expect(result.message.cards?.[0].rows.find(row => row.id === 'direct')?.description).toBe('neconfirmat');
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  for (const channel of ['messenger', 'instagram']) it('continues across comment pages on ' + channel + ' using only encoded cursors', async () => {
    const f = await fixture(channel); const cursor = 'a&fields=secret/next?';
    mocks.fetch.mockImplementation(async (url: string) => {
      const parsed = new URL(url); expect(parsed.hostname).toBe('graph.facebook.com'); expect(parsed.pathname).toContain('/123_456/comments');
      const next = parsed.searchParams.get('after');
      if (next !== null) expect(next).toBe(cursor);
      const row = (id: string, date: string) => channel === 'instagram' ? { id, text: id, timestamp: date } : { id, message: id, created_time: date };
      return new Response(JSON.stringify(next === null ? { data: [row('1', '2026-10-16T04:00:00Z')], paging: { next: 'https://untrusted.invalid/token', cursors: { after: cursor } } } : { data: [row('1', '2026-10-16T04:00:00Z'), row('2', '2026-10-16T05:00:00Z')] }), { status: 200 });
    });
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.[0].rows.map(row => row.id)).toEqual(['2', '1']);
    expect(result.message.cards?.[0].complete).toBe(true); expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toMatch(/untrusted|fields=secret/);
    expect((await chatTurn(f.ctx, f.input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['repeat', 'failure', 'limit'])('retains verified comments and reports incomplete pagination on %s', async reason => {
    const f = await fixture(); let page = 0;
    mocks.fetch.mockImplementation(async () => {
      page++;
      if (reason === 'failure' && page === 2) return new Response(JSON.stringify({ error: { message: 'SECRET' } }), { status: 503 });
      return new Response(JSON.stringify({ data: [{ id: String(page), message: 'Text' }], paging: { next: 'https://untrusted.invalid', cursors: { after: reason === 'repeat' ? 'same' : 'cursor-' + page } } }), { status: 200 });
    });
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.[0].complete).toBe(false);
    expect(result.message.cards?.[0].rows.length).toBe(reason === 'limit' ? 10 : reason === 'repeat' ? 2 : 1);
    expect(mocks.fetch).toHaveBeenCalledTimes(reason === 'limit' ? 10 : 2);
    expect(result.message.text).toContain('Lista este incompletă'); expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it.each(['revoked', 'changed'])('stops before next provider page when access or destination is %s', async reason => {
    const f = await fixture();
    mocks.fetch.mockImplementation(async () => {
      if (reason === 'revoked') await f.profile.update({ role: 'agent' });
      else await f.post.update({ ['destinations.' + f.connectionId + '.externalId']: '123_789' });
      return new Response(JSON.stringify({ data: [{ id: '1', message: 'Text' }], paging: { next: 'https://untrusted.invalid', cursors: { after: 'next' } } }), { status: 200 });
    });
    if (reason === 'revoked') { await expect(chatTurn(f.ctx, f.input)).rejects.toThrow('Acces revocat'); expect(mocks.fetch).toHaveBeenCalledTimes(1); return; }
    const result = await chatTurn(f.ctx, f.input);
    expect(result.message.cards?.some(card => card.source === 'socialComments')).not.toBe(true); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('resumes at page eleven using a private checkpoint and replays without another fetch', async () => {
    const f = await fixture();
    mocks.fetch.mockImplementation(async (url: string) => {
      const cursor = new URL(url).searchParams.get('after'); const page = cursor ? Number(cursor.split('-')[1]) + 1 : 1;
      return new Response(JSON.stringify({ data: [{ id: String(page), message: 'Page ' + page }], ...(page < 11 ? { paging: { next: 'https://untrusted.invalid', cursors: { after: 'PRIVATE-' + page } } } : {}) }), { status: 200 });
    });
    const first = await chatTurn(f.ctx, f.input);
    const pointer = first.message.cards?.find(card => card.source === 'socialCommentsContinuation')?.rows[0].id;
    expect(pointer).toBeTruthy(); expect(JSON.stringify(first)).not.toContain('PRIVATE'); expect(mocks.fetch).toHaveBeenCalledTimes(10);
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Continuă comentariile' };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].rows.map(row => row.id)).toEqual(['11']); expect(result.message.cards?.[0].complete).toBe(true);
    expect(result.message.cards?.some(card => card.source === 'socialCommentsContinuation')).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(11); expect(new URL(mocks.fetch.mock.calls[10][0]).searchParams.get('after')).toBe('PRIVATE-10');
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(11);
  });
  it.each(['expired', 'owner', 'destination'])('rejects a %s checkpoint before provider calls', async reason => {
    const f = await fixture(); let page = 0;
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ data: [], paging: { next: 'https://untrusted.invalid', cursors: { after: 'cursor-' + ++page } } }), { status: 200 }));
    const first = await chatTurn(f.ctx, f.input);
    const id = first.message.cards?.find(card => card.source === 'socialCommentsContinuation')?.rows[0].id as string;
    const ref = db.collection('agencies').doc(f.ctx.agencyId).collection('assistantResultSets').doc(id);
    if (reason === 'expired') await ref.update({ expiresAt: 0 });
    if (reason === 'owner') await ref.update({ ownerId: 'someone-else' });
    if (reason === 'destination') await f.post.update({ ['destinations.' + f.connectionId + '.externalId']: '123_999' });
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Continuă comentariile' });
    expect(result.message.text).toContain('Nu am putut'); expect(mocks.fetch).toHaveBeenCalledTimes(10);
  });
  it('does not manufacture a continuation when the last answer offers none', async () => {
    const f = await fixture();
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Continuă comentariile' });
    expect(result.message.text).toContain('Nu există'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(['http-error', 'invalid-response'])('keeps the resume cursor after %s and finishes on retry', async failure => {
    const f = await fixture(); let failNext = true;
    mocks.fetch.mockImplementation(async (url: string) => {
      const cursor = new URL(url).searchParams.get('after'); const page = cursor ? Number(cursor.split('-')[1]) + 1 : 1;
      if (page === 11 && failNext) {
        failNext = false;
        return new Response(JSON.stringify(failure === 'http-error' ? { error: { message: 'SECRET provider error' } } : { unexpected: 'SECRET invalid page' }), { status: failure === 'http-error' ? 503 : 200 });
      }
      return new Response(JSON.stringify({ data: [{ id: String(page), message: 'Page ' + page }], ...(page < 11 ? { paging: { next: 'https://untrusted.invalid', cursors: { after: 'PRIVATE-' + page } } } : {}) }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    const retryInput = { ...f.input, requestId: randomUUID(), prompt: 'Continuă comentariile' };
    const failed = await chatTurn(f.ctx, retryInput);
    expect(failed.message.cards?.[0].complete).toBe(false); expect(failed.message.cards?.[0].rows).toEqual([]);
    expect(failed.message.cards?.some(card => card.source === 'socialCommentsContinuation')).toBe(true);
    expect(failed.message.text).toContain('Lista este incompletă'); expect(JSON.stringify(failed)).not.toMatch(/SECRET|PRIVATE/);
    expect(mocks.fetch).toHaveBeenCalledTimes(11);
    expect((await chatTurn(f.ctx, retryInput)).message.id).toBe(failed.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(11);
    const recovered = await chatTurn(f.ctx, { ...retryInput, requestId: randomUUID() });
    expect(recovered.message.cards?.[0].complete).toBe(true); expect(recovered.message.cards?.[0].rows.map(row => row.id)).toEqual(['11']);
    expect(recovered.message.cards?.some(card => card.source === 'socialCommentsContinuation')).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(12);
    expect(mocks.fetch.mock.calls.slice(10).map(([url]) => new URL(url).searchParams.get('after'))).toEqual(['PRIVATE-10', 'PRIVATE-10']);
  });
  it('executes master-0389 using channel-specific counters and preserves missing values', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.insights.status': 'active' });
    const instagramId = randomUUID(); secrets.push(instagramId);
    const agency = db.collection('agencies').doc(f.ctx.agencyId);
    await agency.collection('channelConnections').doc(instagramId).set({ agencyId: f.ctx.agencyId, channel: 'instagram', externalId: '789', status: 'connected', capabilities: { insights: { status: 'active' } } });
    await db.collection('communicationSecrets').doc(instagramId).set({ agencyId: f.ctx.agencyId, token: seal('SYNTHETIC_TOKEN') });
    await agency.collection('socialPosts').doc('instagram').set({ agencyId: f.ctx.agencyId, propertyTitle: 'Cișmigiu', destinations: { [instagramId]: { status: 'published', externalId: '789' } } });
    await agency.collection('socialPosts').doc('foreign').set({ agencyId: 'other', propertyTitle: 'HIDDEN', destinations: { [instagramId]: { status: 'published', externalId: '789' } } });
    mocks.fetch.mockImplementation(async (url: string) => {
      const data = new URL(url).pathname.endsWith('/789') ? { like_count: 8, comments_count: 2, token: 'SECRET' } : { likes: { summary: { total_count: 0 } }, shares: { count: 4 }, private: 'SECRET' };
      return new Response(JSON.stringify(data), { status: 200 });
    });
    const prompt = corpus.scenarios.find(row => row.id === 'master-0389')!.text;
    const input = { ...f.input, requestId: randomUUID(), prompt };
    const result = await chatTurn(f.ctx, input);
    const rows = result.message.cards?.[0].rows || [];
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.channel === 'messenger')).toMatchObject({ likes: 0, comments: null, shares: 4 });
    expect(rows.find(row => row.channel === 'instagram')).toMatchObject({ likes: 8, comments: 2, shares: null });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|HIDDEN|SYNTHETIC_TOKEN/);
    expect(result.message.text).toContain('totaluri cumulative'); expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(2);
    await writeFile('.tmp/jarvis-social-comments/master-0389.json', JSON.stringify({ scenarioId: 'master-0389', prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual persisted chat and social insights service on local Firestore; Facebook and Instagram HTTP counters simulated.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('shows unavailable metrics without claiming zero or exposing provider errors', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.insights.status': 'active' });
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'SECRET error' } }), { status: 503 }));
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Compară performanța postărilor disponibile.' });
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ available: false, likes: null, comments: null, shares: null });
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('limits comparison calls to twenty destinations and reports the remaining scope', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.insights.status': 'active' });
    const batch = db.batch();
    for (let i = 0; i < 21; i++) batch.set(f.post.parent.doc('extra-' + i), { agencyId: f.ctx.agencyId, propertyTitle: 'Test', destinations: { [f.connectionId]: { status: 'published', externalId: '123_' + (1000 + i) } } });
    await batch.commit();
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ likes: { summary: { total_count: 1 } } }), { status: 200 }));
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Compară performanța postărilor disponibile.' });
    expect(result.message.cards?.[0].rows).toHaveLength(20); expect(result.message.cards?.[0].complete).toBe(false);
    expect(result.message.text).toContain('22'); expect(mocks.fetch).toHaveBeenCalledTimes(20);
  });
  for (const scenarioId of ['master-0380', 'master-0381']) it('executes ' + scenarioId + ' through the real executor and handler without duplicate effects', async () => {
    const f = await fixture(); let posts = 0;
    mocks.fetch.mockImplementation(async (_url: string, options: any) => {
      if (options.method === 'POST') { posts++; if (scenarioId === 'master-0380') expect(JSON.parse(options.body)).toEqual({ message: 'Bună ziua! Este disponibil.' }); return new Response(JSON.stringify(scenarioId === 'master-0380' ? { id: '9_10' } : { success: true }), { status: 200 }); }
      return new Response(JSON.stringify({ data: [{ id: '9', message: 'Mai este disponibil?' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const original = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt });
    expect(original.message.cards?.[0].source).toBe('socialCommentActionRequest');
    const input = { ...f.input, requestId: randomUUID(), prompt: scenarioId === 'master-0380' ? 'Răspuns social: 9 | Bună ziua! Este disponibil.' : 'Comentariu social: 9' };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('Meta a confirmat'); expect(posts).toBe(1);
    if (scenarioId === 'master-0380') expect(result.message.text).not.toContain('Nu au fost trimise mesaje');
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(posts).toBe(1);
    await writeFile('.tmp/jarvis-social-comments/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual persisted chat, executor ledger and communications handler on local Firestore; Meta GET/POST simulated.', runs: [{ phase: 'original', final: original.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  it('refuses Instagram likes before a write', async () => {
    const f = await fixture('instagram');
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: '9', text: 'Salut' }] }), { status: 200 }));
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Dă like comentariului dacă funcția este suportată.' });
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Comentariu social: 9' });
    expect(result.message.text).toContain('nu permite'); expect(result.message.planId).toBeUndefined();
    expect(mocks.fetch.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });
  it('does not confirm or repeat an uncertain like response', async () => {
    const f = await fixture(); let posts = 0;
    mocks.fetch.mockImplementation(async (_url: string, options: any) => {
      if (options.method === 'POST') { posts++; return new Response('{}', { status: 200 }); }
      return new Response(JSON.stringify({ data: [{ id: '9', message: 'Salut' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Dă like comentariului dacă funcția este suportată.' });
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Comentariu social: 9' };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.text).not.toContain('Meta a confirmat'); expect(posts).toBe(1);
    await chatTurn(f.ctx, input); expect(posts).toBe(1);
  });
  it('replies on Instagram with the exact supplied text', async () => {
    const f = await fixture('instagram'); let posts = 0;
    mocks.fetch.mockImplementation(async (url: string, options: any) => {
      if (options.method === 'POST') { posts++; expect(new URL(url).pathname).toMatch(/\/9\/replies$/); expect(JSON.parse(options.body)).toEqual({ message: 'Da, disponibil.' }); return new Response(JSON.stringify({ id: '10' }), { status: 200 }); }
      return new Response(JSON.stringify({ data: [{ id: '9', text: 'Salut' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Răspunde comentariului selectat.' });
    const missing = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Răspuns social: 9' });
    expect(missing.message.text).toContain('Lipsește textul'); expect(posts).toBe(0);
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Răspuns social: 9 | Da, disponibil.' });
    expect(result.message.text).toContain('Meta a confirmat'); expect(posts).toBe(1);
  });
  for (const reason of ['disconnected', 'comment-removed']) it('prevents writes after ' + reason, async () => {
    const f = await fixture(); let removed = false; let posts = 0;
    mocks.fetch.mockImplementation(async (_url: string, options: any) => {
      if (options.method === 'POST') posts++;
      return new Response(JSON.stringify({ data: removed ? [] : [{ id: '9', message: 'Salut' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Dă like comentariului dacă funcția este suportată.' });
    if (reason === 'disconnected') await f.connection.update({ status: 'disconnected' }); else removed = true;
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Comentariu social: 9' });
    expect(result.message.text).not.toContain('Meta a confirmat'); expect(posts).toBe(0);
  });
  for (const channel of ['messenger', 'instagram']) it('executes a reply to a comment beyond the first membership page on ' + channel, async () => {
    const f = await fixture(channel); let pages = 0, posts = 0;
    const cursor = 'opaque+cursor&other=value';
    mocks.fetch.mockImplementation(async (url: string, options: any) => {
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('graph.facebook.com');
      if (options.method === 'POST') { posts++; expect(JSON.parse(options.body)).toEqual({ message: 'Da.' }); return new Response(JSON.stringify({ id: 'reply_1' }), { status: 200 }); }
      if (parsed.searchParams.get('fields') === 'id') {
        pages++;
        if (pages === 1) return new Response(JSON.stringify({ data: [{ id: 'other' }], paging: { next: 'https://untrusted.invalid/', cursors: { after: cursor } } }), { status: 200 });
        expect(parsed.searchParams.get('after')).toBe(cursor); expect(parsed.searchParams.has('other')).toBe(false);
      }
      return new Response(JSON.stringify({ data: [{ id: '9', message: 'Salut', text: 'Salut' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Răspunde comentariului selectat.' });
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Răspuns social: 9 | Da.' };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.text).toContain('Meta a confirmat'); expect(pages).toBe(2); expect(posts).toBe(1);
    await chatTurn(f.ctx, input); expect(posts).toBe(1); expect(pages).toBe(2);
  });
  for (const reason of ['repeated', 'missing', 'invalid-page', 'provider-error', 'changed-post', 'disconnected', 'changed-after-match', 'changed-account', 'exhausted']) it('does not write when membership pagination encounters ' + reason, async () => {
    const f = await fixture(); let pages = 0, posts = 0;
    mocks.fetch.mockImplementation(async (url: string, options: any) => {
      if (options.method === 'POST') posts++;
      if (new URL(url).searchParams.get('fields') === 'id') {
        pages++;
        if (reason === 'invalid-page') return new Response('{}', { status: 200 });
        if (reason === 'provider-error' && pages === 2) return new Response('{}', { status: 503 });
        if (reason === 'changed-post' || reason === 'changed-after-match') await f.post.update({ ['destinations.' + f.connectionId + '.externalId']: '123_999' });
        if (reason === 'disconnected') await f.connection.update({ status: 'disconnected' });
        if (reason === 'changed-account') await f.connection.update({ externalId: '999' });
        if (reason === 'exhausted') return new Response(JSON.stringify({ data: [] }), { status: 200 });
        if (reason === 'changed-after-match') return new Response(JSON.stringify({ data: [{ id: '9' }] }), { status: 200 });
        return new Response(JSON.stringify({ data: [], paging: { next: 'https://untrusted.invalid/', ...(reason === 'missing' ? {} : { cursors: { after: 'same' } }) } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [{ id: '9', message: 'Salut' }] }), { status: 200 });
    });
    await chatTurn(f.ctx, f.input);
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Dă like comentariului dacă funcția este suportată.' });
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Comentariu social: 9' });
    expect(result.message.text).not.toContain('Meta a confirmat'); expect(posts).toBe(0); expect(pages).toBeLessThanOrEqual(2);
  });
  it('executes master-0390 with live-read simulated counters and persisted media formats', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.insights.status': 'active' });
    await f.post.update({ images: [] });
    for (const [id, images] of [['457', []], ['458', ['https://example.test/a']], ['459', ['https://example.test/b']]] as const) await f.post.parent.doc(id).set({ agencyId: f.ctx.agencyId, images, destinations: { [f.connectionId]: { status: 'published', externalId: '123_' + id } } });
    mocks.fetch.mockImplementation(async (url: string, options: any) => {
      expect(options.method).toBe('GET');
      return new Response(JSON.stringify({ likes: { summary: { total_count: /458|459/.test(new URL(url).pathname) ? 8 : 2 } }, comments: { summary: { total_count: 0 } } }), { status: 200 });
    });
    const prompt = corpus.scenarios.find(row => row.id === 'master-0390')!.text;
    const input = { ...f.input, requestId: randomUUID(), prompt };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].source).toBe('socialRecommendation');
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ recommendedFormat: 'photo', evidence: 'observed_sample', excluded: 0 });
    expect(result.message.text).toContain('nu o promisiune'); expect(result.message.text).toContain('Nu am creat sau publicat');
    expect(mocks.fetch).toHaveBeenCalledTimes(4); await chatTurn(f.ctx, input); expect(mocks.fetch).toHaveBeenCalledTimes(4);
    expect((await db.collection('communicationSocialJobs').where('agencyId', '==', f.ctx.agencyId).get()).empty).toBe(true);
    await writeFile('.tmp/jarvis-social-comments/master-0390.json', JSON.stringify({ scenarioId: 'master-0390', prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat and current Firestore social history; actual insights service with simulated Meta counters, no publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('executes master-0393 with current connection state and no provider calls', async () => {
    const f = await fixture('instagram'); await f.connection.update({ 'capabilities.publish.status': 'reconnect_required' });
    const prompt = corpus.scenarios.find(row => row.id === 'master-0393')!.text;
    const input = { ...f.input, requestId: randomUUID(), prompt };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].source).toBe('socialPlatformRules');
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ publishStatus: 'reconnect_required' });
    expect(result.message.text).toContain('2200'); expect(result.message.text).toContain('maximum 10'); expect(result.message.text).toContain('nu confirmă publicarea');
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_TOKEN'); expect(mocks.fetch).not.toHaveBeenCalled();
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    await writeFile('.tmp/jarvis-social-comments/master-0393.json', JSON.stringify({ scenarioId: 'master-0393', prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat and current local Firestore connection state; same Instagram limits as publishing validator. No external calls.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('does not invent a winning format when provider counters are unavailable', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.insights.status': 'active' }); await f.post.update({ images: [] });
    mocks.fetch.mockImplementation(async () => new Response('{}', { status: 503 }));
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Recomandă ce tip de postare să fac data viitoare.' });
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ evidence: 'insufficient_comparable_data', recommendedFormat: null, excluded: 1 });
  });
  it('describes an initial experiment when the published history is empty', async () => {
    const f = await fixture(); await f.post.delete();
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Recomandă ce tip de postare să fac data viitoare.' });
    expect(result.message.text).toContain('experiment inițial'); expect(result.message.cards?.[0].rows).toEqual([]); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const channel of ['messenger', 'instagram']) it('creates master-0376 as an actual saved CRM draft on ' + channel, async () => {
    const f = await fixture(channel); await f.connection.update({ 'capabilities.publish.status': 'active' });
    const property = db.collection('agencies').doc(f.ctx.agencyId).collection('properties').doc('property');
    await property.set({ status: 'Activ', title: 'Cișmigiu', description: 'Descriere veche', price: 125000, images: [{ url: 'https://example.test/old.jpg' }] });
    const prompt = corpus.scenarios.find(row => row.id === 'master-0376')!.text;
    const original = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt, currentRecord: { resource: 'properties', id: 'property' } });
    expect(original.message.cards?.[0].source).toBe('socialDraftRequest');
    const description = '  Apartament în Cișmigiu.\nDescrierea exactă din CRM.  ';
    await property.update({ description, images: [{ url: 'https://example.test/new.jpg' }], price: 119000 });
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Cont pentru ciorna sociala: ' + f.connectionId, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('a fost salvată'); expect(result.message.text).toContain('nu este publicată');
    const posts = await f.post.parent.where('contentSource', '==', 'crm').get(); expect(posts.size).toBe(1);
    expect(posts.docs[0].data()).toMatchObject({ text: description, images: ['https://example.test/new.jpg'], status: 'draft', propertyPrice: 119000, destinations: { [f.connectionId]: { status: 'draft', channel } } });
    expect((await db.collection('communicationSocialJobs').doc(posts.docs[0].id).get()).exists).toBe(false);
    await chatTurn(f.ctx, input); expect((await f.post.parent.where('contentSource', '==', 'crm').get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
    if (channel === 'messenger') await writeFile('.tmp/jarvis-social-comments/master-0376.json', JSON.stringify({ scenarioId: 'master-0376', prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat, actual executor ledger and atomic social draft service on local Firestore; synthetic connection credentials, no provider calls.', runs: [{ phase: 'original', final: original.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  for (const reason of ['disconnected', 'inactive', 'missing-description', 'instagram-too-long', 'unoffered', 'changed-page']) it('does not create a social draft after ' + reason, async () => {
    const f = await fixture(reason === 'instagram-too-long' ? 'instagram' : 'messenger'); await f.connection.update({ 'capabilities.publish.status': 'active' });
    const property = db.collection('agencies').doc(f.ctx.agencyId).collection('properties').doc('property');
    await property.set({ status: 'Activ', description: 'Descriere', images: [{ url: 'https://example.test/a.jpg' }] });
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Creează o postare socială pentru proprietatea deschisă.', currentRecord: { resource: 'properties', id: 'property' } });
    if (reason === 'disconnected') await f.connection.update({ status: 'disconnected' });
    if (reason === 'inactive') await property.update({ status: 'Inactiv' });
    if (reason === 'missing-description') await property.update({ description: '' });
    if (reason === 'instagram-too-long') await property.update({ description: 'x'.repeat(2201) });
    if (reason === 'changed-page') await property.parent.doc('other').set({ status: 'Activ', description: 'Other' });
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Cont pentru ciorna sociala: ' + (reason === 'unoffered' ? 'other' : f.connectionId), currentRecord: reason === 'changed-page' ? { resource: 'properties', id: 'other' } : null });
    expect(result.message.text).not.toContain('a fost salvată'); expect((await f.post.parent.where('contentSource', '==', 'crm').get()).empty).toBe(true); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('creates one domain draft under concurrent retries with the same request id', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.publish.status': 'active' });
    await db.collection('agencies').doc(f.ctx.agencyId).collection('properties').doc('property').set({ status: 'Activ', description: 'Exact CRM', images: [] });
    const { createPropertySocialDraft } = await import('@/lib/communications/social-property-draft');
    const body = { requestId: randomUUID(), propertyId: 'property', connectionId: f.connectionId };
    const results = await Promise.all([createPropertySocialDraft(db as any, f.ctx, body), createPropertySocialDraft(db as any, f.ctx, body)]);
    expect(results[0].postId).toBe(results[1].postId); expect((await f.post.parent.where('contentSource', '==', 'crm').get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const reason of ['profile', 'connection']) it('rechecks ' + reason + ' in the draft write transaction', async () => {
    const f = await fixture(); await f.connection.update({ 'capabilities.publish.status': 'active' });
    await db.collection('agencies').doc(f.ctx.agencyId).collection('properties').doc('property').set({ status: 'Activ', description: 'Exact CRM', images: [] });
    const { createPropertySocialDraft } = await import('@/lib/communications/social-property-draft');
    const wrapped = { collection: db.collection.bind(db), runTransaction: async (fn: any) => { if (reason === 'profile') await f.profile.update({ role: 'agent' }); else await f.connection.update({ externalId: '999' }); return db.runTransaction(fn); } } as any;
    await expect(createPropertySocialDraft(wrapped, f.ctx, { requestId: randomUUID(), propertyId: 'property', connectionId: f.connectionId })).rejects.toThrow();
    expect((await f.post.parent.where('contentSource', '==', 'crm').get()).empty).toBe(true); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  async function scheduleFixture(channel = 'messenger') {
    const f = await fixture(channel); await f.connection.update({ 'capabilities.publish.status': 'active' });
    const property = db.collection('agencies').doc(f.ctx.agencyId).collection('properties').doc('property');
    await property.set({ status: 'Activ', title: 'Cișmigiu', description: 'Exact CRM', price: 120000, images: [{ url: 'https://example.test/a.jpg' }] });
    const { createPropertySocialDraft } = await import('@/lib/communications/social-property-draft');
    const draft = await createPropertySocialDraft(db as any, f.ctx, { requestId: randomUUID(), propertyId: 'property', connectionId: f.connectionId });
    const { tomorrowBucharest } = await import('../facebook-monitor');
    const date = tomorrowBucharest(new Date());
    return { ...f, property, draftId: draft.postId, date, selection: 'Programare sociala: ' + draft.postId + ' | ' + date + ' 07:30' };
  }
  for (const scenarioId of ['master-0377', 'master-0394']) it('executes ' + scenarioId + ' with the same persisted Bucharest time in post and queue', async () => {
    const f = await scheduleFixture();
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const original = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt });
    expect(original.message.cards?.[0].source).toBe('socialScheduleRequest');
    const input = { ...f.input, requestId: randomUUID(), prompt: f.selection };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('07:30, ora Bucureștiului'); expect(result.message.text).toContain('Publicarea efectivă nu este încă confirmată');
    const { bucharestLocalToIso } = await import('@/lib/bucharest-time');
    const scheduledAt = bucharestLocalToIso(f.date, '07:30');
    const post = (await f.post.parent.doc(f.draftId).get()).data(), job = (await db.collection('communicationSocialJobs').doc(f.draftId).get()).data();
    expect(post).toMatchObject({ status: 'queued', scheduledAt }); expect(job).toMatchObject({ status: 'queued', scheduledAt, postId: f.draftId });
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    const { drainSocial } = await import('@/lib/communications/social'); await drainSocial(db as any);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await writeFile('.tmp/jarvis-social-comments/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat, executor, atomic social post + worker queue on local Firestore. Future scheduling verified by readback; no provider publication.', runs: [{ phase: 'original', final: original.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  for (const reason of ['description', 'images', 'price', 'disconnected', 'draft-edited', 'past']) it('does not queue stale or invalid social scheduling: ' + reason, async () => {
    const f = await scheduleFixture();
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Programează postarea prin canalul suportat.' });
    if (reason === 'description') await f.property.update({ description: 'Changed' });
    if (reason === 'images') await f.property.update({ images: [{ url: 'https://example.test/new.jpg' }] });
    if (reason === 'price') await f.property.update({ price: 119000 });
    if (reason === 'disconnected') await f.connection.update({ status: 'disconnected' });
    if (reason === 'draft-edited') await f.post.parent.doc(f.draftId).update({ text: 'Changed' });
    const prompt = reason === 'past' ? 'Programare sociala: ' + f.draftId + ' | 2020-01-01 07:30' : f.selection;
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt });
    expect(result.message.text).not.toContain('Aceeași oră este salvată'); expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).exists).toBe(false); expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('draft'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('publishes a due scheduled CRM draft once through the existing worker with simulated Meta receipts', async () => {
    const f = await scheduleFixture();
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Programează postarea prin canalul suportat.' });
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: f.selection });
    const due = '2020-01-01T00:00:00.000Z';
    await f.post.parent.doc(f.draftId).update({ scheduledAt: due });
    await db.collection('communicationSocialJobs').doc(f.draftId).update({ scheduledAt: due });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '456' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: '123_789' }), { status: 200 }));
    const { drainSocial } = await import('@/lib/communications/social');
    await drainSocial(db as any);
    expect((await f.post.parent.doc(f.draftId).get()).data()).toMatchObject({ status: 'published', destinations: { [f.connectionId]: { status: 'published', externalId: '123_789' } } });
    expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('completed');
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(String(mocks.fetch.mock.calls[1][1].body)).toContain('Exact CRM');
    await drainSocial(db as any); expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it('blocks a queued CRM post at worker time when the description changes', async () => {
    const f = await scheduleFixture();
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Programează postarea prin canalul suportat.' });
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: f.selection });
    await f.property.update({ description: 'Changed after scheduling' });
    await db.collection('communicationSocialJobs').doc(f.draftId).update({ scheduledAt: '2020-01-01T00:00:00.000Z' });
    const { drainSocial } = await import('@/lib/communications/social'); await drainSocial(db as any);
    expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('needs_review');
    expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('blocked'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('executes master-0378 through targeted worker and persists confirmed publication without duplicate replay', async () => {
    const f = await scheduleFixture();
    const prompt = corpus.scenarios.find(row => row.id === 'master-0378')!.text;
    const original = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt });
    expect(original.message.cards?.[0].source).toBe('socialPublishRequest'); expect(mocks.fetch).not.toHaveBeenCalled();
    // An unrelated due job must not be consumed by this command.
    const unrelated = db.collection('communicationSocialJobs').doc(randomUUID());
    await unrelated.set({ agencyId: 'unrelated', status: 'queued', scheduledAt: '2020-01-01T00:00:00Z' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '456' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: '123_789' }), { status: 200 }));
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea socială: ' + f.draftId };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('Meta a confirmat publicarea'); expect(result.message.text).toContain('123_789'); expect(result.message.text).not.toContain('Nu au fost trimise');
    expect((await f.post.parent.doc(f.draftId).get()).data()).toMatchObject({ status: 'published', destinations: { [f.connectionId]: { status: 'published', externalId: '123_789' } } });
    expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('completed');
    expect((await unrelated.get()).data()?.status).toBe('queued'); await unrelated.delete();
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).message).toBe('Exact CRM');
    await writeFile('.tmp/jarvis-social-comments/master-0378.json', JSON.stringify({ scenarioId: 'master-0378', prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat, ledger, atomic queue and targeted worker on local Firestore; Meta photo/feed responses simulated. Persisted external publication ID verified, no real publication.', runs: [{ phase: 'original', final: original.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  for (const reason of ['photo-id', 'publication-id', 'provider-error']) it('does not confirm or retry uncertain publication: ' + reason, async () => {
    const f = await scheduleFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea după approval.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(reason === 'photo-id' ? {} : { id: '456' }), { status: 200 }));
    if (reason === 'publication-id') mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 123 }), { status: 200 }));
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea socială: ' + f.draftId };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.text).toContain('Execuția a fost oprită'); expect(result.message.text).not.toContain('Meta a confirmat publicarea');
    expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('needs_review'); expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('blocked');
    const calls = mocks.fetch.mock.calls.length; await chatTurn(f.ctx, input); const { drainSocial } = await import('@/lib/communications/social'); await drainSocial(db as any, { postId: f.draftId, agencyId: f.ctx.agencyId }); expect(mocks.fetch).toHaveBeenCalledTimes(calls);
  });
  for (const reason of ['unoffered', 'draft-changed', 'property-changed', 'revoked']) it('does not publish after ' + reason, async () => {
    const f = await scheduleFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea după approval.' });
    if (reason === 'draft-changed') await f.post.parent.doc(f.draftId).update({ text: 'Changed' });
    if (reason === 'property-changed') await f.property.update({ description: 'Changed' });
    if (reason === 'revoked') await f.profile.update({ role: 'agent' });
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea socială: ' + (reason === 'unoffered' ? 'other' : f.draftId) };
    if (reason === 'revoked') { await expect(chatTurn(f.ctx, input)).rejects.toThrow('Acces revocat'); expect(mocks.fetch).not.toHaveBeenCalled(); expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).exists).toBe(false); return; }
    const result = await chatTurn(f.ctx, input);
    expect(result.message.text).not.toContain('Meta a confirmat'); expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).exists).toBe(false); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('continues Instagram processing through the worker and only then saves the publication ID', async () => {
    const f = await scheduleFixture('instagram'); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea după approval.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: '456' }), { status: 200 }));
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea socială: ' + f.draftId });
    expect(result.message.text).toContain('workerul continuă automat'); expect(result.message.text).not.toContain('Meta a confirmat');
    expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('processing');
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: '789' }), { status: 200 }));
    const { drainSocial } = await import('@/lib/communications/social'); await drainSocial(db as any, { postId: f.draftId, agencyId: f.ctx.agencyId });
    expect((await f.post.parent.doc(f.draftId).get()).data()).toMatchObject({ status: 'published', destinations: { [f.connectionId]: { externalId: '789', status: 'published' } } });
    expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('completed');
    await drainSocial(db as any, { postId: f.draftId, agencyId: f.ctx.agencyId }); expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
  for (const phase of ['container', 'publication']) it('rejects missing Instagram identifier at ' + phase, async () => {
    const f = await scheduleFixture('instagram'); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea după approval.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(phase === 'container' ? {} : { id: '456' }), { status: 200 }));
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Publică postarea socială: ' + f.draftId });
    const { drainSocial } = await import('@/lib/communications/social');
    if (phase === 'publication') {
      mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
      await drainSocial(db as any, { postId: f.draftId, agencyId: f.ctx.agencyId });
    }
    expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('needs_review'); expect((await db.collection('communicationSocialJobs').doc(f.draftId).get()).data()?.status).toBe('blocked');
    const calls = mocks.fetch.mock.calls.length; await drainSocial(db as any, { postId: f.draftId, agencyId: f.ctx.agencyId }); expect(mocks.fetch).toHaveBeenCalledTimes(calls);
  });
  it('does not claim a selected job from another agency or one moved to the future after reading', async () => {
    const f = await scheduleFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Programează postarea prin canalul suportat.' }); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: f.selection });
    const job = db.collection('communicationSocialJobs').doc(f.draftId); await job.update({ scheduledAt: '2020-01-01T00:00:00.000Z' });
    const { drainSocial } = await import('@/lib/communications/social');
    await drainSocial(db as any, { postId: f.draftId, agencyId: 'other' }); expect((await job.get()).data()?.status).toBe('queued');
    const wrapped = { collection: db.collection.bind(db), runTransaction: async (fn: any) => { await job.update({ scheduledAt: new Date(Date.now() + 86400000).toISOString() }); return db.runTransaction(fn); } } as any;
    await drainSocial(wrapped, { postId: f.draftId, agencyId: f.ctx.agencyId }); expect((await job.get()).data()?.status).toBe('queued'); expect((await f.post.parent.doc(f.draftId).get()).data()?.status).toBe('queued'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  async function removalFixture(secondChannel = 'messenger') {
    const f = await fixture(); await f.connection.update({ 'capabilities.publish.status': 'active' });
    const secondId = 'z' + randomUUID(); secrets.push(secondId);
    await f.connection.parent.doc(secondId).set({ agencyId: f.ctx.agencyId, channel: secondChannel, externalId: '999', status: 'connected', capabilities: { publish: { status: 'active' } } });
    await db.collection('communicationSecrets').doc(secondId).set({ agencyId: f.ctx.agencyId, token: seal('SYNTHETIC_TOKEN') });
    const second = { channel: secondChannel, status: 'published', externalId: secondChannel === 'messenger' ? '999_888' : '888', publishedAt: '2026-10-17T06:00:00Z' };
    await f.post.update({ status: 'published', ['destinations.' + secondId]: second });
    return { ...f, secondId, second };
  }
  for (const scenarioId of ['master-0382', 'master-0383']) it('executes ' + scenarioId + ' with confirmed remote deletion and exact destination scope', async () => {
    const f = await removalFixture(); const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const original = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt });
    expect(original.message.cards?.[0].source).toBe('socialRemoveRequest'); expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    const input = { ...f.input, requestId: randomUUID(), prompt: scenarioId === 'master-0382' ? 'Confirmă ștergerea postării sociale: post' : 'Elimină destinația socială: post | ' + f.connectionId };
    const result = await chatTurn(f.ctx, input); expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('Meta a confirmat ștergerea publicării 123_456');
    const post = (await f.post.get()).data(); expect(post?.destinations[f.connectionId]).toMatchObject({ status: 'deleted', externalId: '123_456', removal: 'meta' });
    if (scenarioId === 'master-0382') { expect(post?.destinations[f.secondId].status).toBe('deleted'); expect(post?.status).toBe('deleted'); }
    else { expect(post?.destinations[f.secondId]).toEqual(f.second); expect(post?.status).toBe('published'); }
    const calls = scenarioId === 'master-0382' ? 2 : 1; expect(mocks.fetch).toHaveBeenCalledTimes(calls); for (const [, options] of mocks.fetch.mock.calls) expect(options.method).toBe('DELETE');
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(mocks.fetch).toHaveBeenCalledTimes(calls);
    await writeFile('.tmp/jarvis-social-comments/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual persisted chat, executor and existing remote deletion domain service on local Firestore. Meta DELETE responses simulated; exact changed and unchanged destinations verified.', runs: [{ phase: 'original', final: original.message }, { phase: 'selection', final: result.message }] }, null, 2));
  });
  it('keeps the unselected Instagram destination unchanged when deleting Facebook', async () => {
    const f = await removalFixture('instagram'); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Elimină doar destinația selectată.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Elimină destinația socială: post | ' + f.connectionId });
    expect((await f.post.get()).data()?.destinations[f.secondId]).toEqual(f.second); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not delete any destination when full deletion includes unsupported Instagram', async () => {
    const f = await removalFixture('instagram'); const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Șterge postarea numai după confirmare.' });
    expect(result.message.text).toContain('nu confirm automat ștergerea Instagram'); expect(mocks.fetch).not.toHaveBeenCalled(); expect((await f.post.get()).data()?.status).toBe('published');
  });
  for (const reason of ['unoffered', 'external-id', 'connection', 'deleted', 'agency']) it('does not delete changed or unauthorized destination: ' + reason, async () => {
    const f = await removalFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Elimină doar destinația selectată.' });
    if (reason === 'external-id') await f.post.update({ ['destinations.' + f.connectionId + '.externalId']: '123_999' });
    if (reason === 'connection') await f.connection.update({ status: 'disconnected' });
    if (reason === 'deleted') await f.post.update({ deletedAt: 'now' });
    if (reason === 'agency') await f.post.update({ agencyId: 'other' });
    const result = await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Elimină destinația socială: post | ' + (reason === 'unoffered' ? 'other' : f.connectionId) });
    expect(result.message.text).not.toContain('Meta a confirmat'); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const reason of ['false', 'missing', 'error']) it('does not mark destination deleted without Meta confirmation: ' + reason, async () => {
    const f = await removalFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Elimină doar destinația selectată.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(reason === 'false' ? { success: false } : reason === 'missing' ? {} : { error: { message: 'Synthetic failure' } }), { status: reason === 'error' ? 500 : 200 }));
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Elimină destinația socială: post | ' + f.connectionId }; const result = await chatTurn(f.ctx, input);
    expect(result.message.text).not.toContain('Meta a confirmat'); expect((await f.post.get()).data()?.destinations[f.connectionId].status).toBe('published');
    await chatTurn(f.ctx, input); expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('reports only the successful destination when a later deletion fails', async () => {
    const f = await removalFixture(); await chatTurn(f.ctx, { ...f.input, requestId: randomUUID(), prompt: 'Șterge postarea numai după confirmare.' });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 200 }));
    const input = { ...f.input, requestId: randomUUID(), prompt: 'Confirmă ștergerea postării sociale: post' }; const result = await chatTurn(f.ctx, input);
    expect(result.message.text).toContain('Meta a confirmat ștergerea publicării 123_456'); expect(result.message.text).not.toContain('Meta a confirmat ștergerea publicării 999_888'); expect(result.message.text).toContain('Execuția a fost oprită');
    expect((await f.post.get()).data()?.destinations[f.secondId]).toEqual(f.second); expect((await f.post.get()).data()?.status).toBe('published');
    await chatTurn(f.ctx, input); expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  for (const reason of ['profile', 'connection', 'destination']) it('rechecks ' + reason + ' immediately before deletion', async () => {
    const f = await removalFixture();
    const wrapped = { collection: db.collection.bind(db), runTransaction: async (fn: any) => { if (reason === 'profile') await f.profile.update({ role: 'agent' }); else if (reason === 'connection') await f.connection.update({ externalId: '321' }); else await f.post.update({ ['destinations.' + f.connectionId + '.externalId']: '123_999' }); return db.runTransaction(fn); } } as any;
    const { removePublishedSocialPost } = await import('@/lib/communications/social');
    await expect(removePublishedSocialPost(wrapped, f.ctx, 'post', f.connectionId, true, '123_456')).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
