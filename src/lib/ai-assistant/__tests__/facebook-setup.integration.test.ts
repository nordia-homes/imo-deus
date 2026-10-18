import { namedChoiceText } from '../named-choice-contract';
import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { readFacebookSetup } from '../facebook-setup';
import { chatTurn } from '../workspace';
import { executeAction } from '../actions';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Facebook configuration through persisted application chat', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-facebook-setup' });
    vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(() => { mocks.fetch.mockReset(); mocks.fetch.mockRejectedValue(new Error('External requests forbidden in these fixtures')); });
  afterAll(async () => {
    if (!db) return;
    for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id));
    for (const id of users) await db.collection('users').doc(id).delete();
    await db.terminate(); vi.unstubAllGlobals();
  });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await profile.set({ agencyId, role: 'agent', defaultFacebookCloudConnectionId: 'connected' });
    await agency.set({ name: 'Agenție sintetică', facebookGroups: [
      { name: 'Vânzări', url: 'https://www.facebook.com/groups/sale', purpose: 'sale' },
      { name: 'Chirii', url: 'https://www.facebook.com/groups/rent', purpose: 'rent' },
      { name: 'Mixte', url: 'https://www.facebook.com/groups/both', purpose: 'both' },
    ] });
    const connections = agency.collection('facebookCloudConnections');
    for (const [id, status] of [['connected', 'connected'], ['reauth', 'needs_reauthentication'], ['error', 'error'], ['offline', 'disconnected'], ['connecting', 'connecting'], ['unknown', 'unexpected']]) await connections.doc(id).set({ agencyId, ownerUid: uid, label: id, status, token: 'sensitive-test-data', lastError: 'sensitive-test-data', currentUrl: 'sensitive-test-data', createdAt: new Date().toISOString() });
    await connections.doc('other-agent').set({ agencyId, ownerUid: 'other', label: 'hidden-agent-label', status: 'connected' });
    await connections.doc('foreign-agency').set({ agencyId: 'foreign', ownerUid: uid, label: 'hidden-foreign-label', status: 'error' });
    await connections.doc('deleted').set({ agencyId, ownerUid: uid, label: 'hidden-deleted-label', status: 'connected', deletedAt: new Date().toISOString() });
    const property = agency.collection('properties').doc('property'); await property.set({ title: 'Apartament Cișmigiu', status: 'Activ', defaultFacebookConnectionId: 'reauth' });
    const history: any[] = [{ id: 'current-page-context', role: 'assistant', cards: [{ source: 'properties', rows: [{ id: 'property' }] }] }];
    return { ctx, agency, profile, connections, property, history };
  }
  it('executes master-0353 after explicit account selection without extra approval', async () => {
    const f = await fixture(); mocks.actor = f.ctx; const sessionId = randomUUID();
    const scenarioId = 'master-0353', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: { resource: 'properties', id: 'property' } });
    expect(first.message.cards?.find(card => card.source === 'facebookConnections')?.rows.map(row => row.id)).toEqual(['connected']);
    expect((await f.property.get()).data()?.defaultFacebookConnectionId).toBe('reauth');
    const input = { sessionId, requestId: randomUUID(), prompt: 'Cont Facebook: connected', currentRecord: null };
    const final = await chatTurn(f.ctx, input);
    expect(final.message.planId).toBeUndefined();
    expect((await f.property.get()).data()).toMatchObject({ defaultFacebookConnectionId: 'connected', title: 'Apartament Cișmigiu', status: 'Activ' });
    expect((await f.property.collection('assistantChanges').get()).size).toBe(1);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(final.message.id);
    expect((await f.property.collection('assistantChanges').get()).size).toBe(1);
    expect((await f.agency.collection('facebookCloudPublishingJobs').get()).empty).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-account', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-account/master-0353.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Original chat, explicit account selection, autonomous update_property executor and local Firestore. No external publication.', runs: [{ phase: 'original', final: first.message }, { phase: 'selection', final: final.message }] }, null, 2));
  });
  it.each(['deleted', 'disconnected', 'foreign-agency', 'revoked-device'])('executor rejects a connection invalidated after planning: %s', async variant => {
    const f = await fixture();
    const patch = variant === 'deleted' ? { deletedAt: 'now' } : variant === 'disconnected' ? { status: 'disconnected' } : variant === 'foreign-agency' ? { agencyId: 'foreign' } : { runnerMode: 'local', deviceId: 'revoked' };
    await f.connections.doc('connected').update(patch);
    if (variant === 'revoked-device') await f.agency.collection('facebookLocalRunnerDevices').doc('revoked').set({ ownerUid: f.ctx.uid, revokedAt: 'now' });
    await expect(executeAction(f.ctx, { kind: 'update_property', propertyId: 'property', patch: { defaultFacebookConnectionId: 'connected' } }, randomUUID())).rejects.toThrow();
    expect((await f.property.get()).data()?.defaultFacebookConnectionId).toBe('reauth');
    expect((await f.property.collection('assistantChanges').get()).empty).toBe(true);
  });
  it('saves the property default account from a named choice without publishing',async()=>{
    const f=await fixture();mocks.actor=f.ctx;const sessionId=randomUUID();
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Setează contul corect dacă am permisiune.',currentRecord:{resource:'properties',id:'property'}});
    const card=first.message.cards!.find(card=>card.choiceSource==='facebookDefaultAccount')!,row=card.rows.find(row=>row.id==='connected')!;
    const input={sessionId,requestId:randomUUID(),prompt:namedChoiceText(card.choiceSource!,row),choice:{messageId:first.message.id,source:card.choiceSource!,rowId:'connected'},currentRecord:null};
    await chatTurn(f.ctx,input);expect((await f.property.get()).data()?.defaultFacebookConnectionId).toBe('connected');
    await chatTurn(f.ctx,input);expect((await f.property.collection('assistantChanges').get()).size).toBe(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(['deleted', 'disconnected', 'foreign', 'other-property', 'revoked-profile', 'not-offered'])('rechecks account selection: %s', async variant => {
    const f = await fixture(); mocks.actor = f.ctx; const sessionId = randomUUID();
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Setează contul corect dacă am permisiune.', currentRecord: { resource: 'properties', id: 'property' } });
    if (variant === 'deleted') await f.connections.doc('connected').update({ deletedAt: 'now' });
    if (variant === 'disconnected') await f.connections.doc('connected').update({ status: 'disconnected' });
    if (variant === 'foreign') await f.connections.doc('connected').update({ ownerUid: 'other' });
    if (variant === 'revoked-profile') await f.profile.update({ role: 'disabled' });
    if (variant === 'other-property') await f.agency.collection('properties').doc('other').set({ title: 'Altă proprietate' });
    const continuation = chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Cont Facebook: ' + (variant === 'not-offered' ? 'other-agent' : 'connected'), currentRecord: variant === 'other-property' ? { resource: 'properties', id: 'other' } : null });
    if (variant === 'revoked-profile') await expect(continuation).rejects.toThrow(); else await continuation;
    expect((await f.property.get()).data()?.defaultFacebookConnectionId).toBe('reauth');
    expect((await f.property.collection('assistantChanges').get()).empty).toBe(true); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const scenarioId of ['master-0351', 'master-0352', 'master-0354', 'master-0355', 'master-0356', 'master-0361']) it('executes original ' + scenarioId + ' from persisted configuration without external effects', async () => {
    const f = await fixture(); mocks.actor = f.ctx;
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const request = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: scenarioId === 'master-0352' ? { resource: 'properties' as const, id: 'property' } : null };
    const result = await chatTurn(f.ctx, request);
    expect(result.message.planId).toBeUndefined();
    const rows = result.message.cards?.flatMap(card => card.rows) || [];
    const expected = scenarioId === 'master-0351' ? ['connected'] : scenarioId === 'master-0352' ? ['reauth'] : scenarioId === 'master-0361' ? ['connecting', 'error', 'offline', 'reauth', 'unknown'] : null;
    if (expected) expect(rows.map(row => row.id).sort()).toEqual(expected.sort());
    else expect(rows.map(row => row.name).sort()).toEqual((scenarioId === 'master-0355' ? ['Vânzări', 'Mixte'] : scenarioId === 'master-0356' ? ['Chirii', 'Mixte'] : ['Vânzări', 'Chirii', 'Mixte']).sort());
    const serialized = JSON.stringify(result);
    for (const secret of ['sensitive-test-data', 'hidden-agent-label', 'hidden-foreign-label', 'hidden-deleted-label']) expect(serialized).not.toContain(secret);
    if (scenarioId === 'master-0352') expect(rows[0]).toMatchObject({ propertyId: 'property', selectionSource: 'property', status: 'needs_reauthentication' });
    const saved = await f.agency.collection('assistantSessions').doc(request.sessionId).collection('messages').get();
    expect(saved.docs.some(doc => doc.data().role === 'assistant')).toBe(true);
    const replay = await chatTurn(f.ctx, { ...request, requestId: randomUUID() });
    expect(replay.message.cards?.flatMap(card => card.rows)).toEqual(rows);
    expect((await f.agency.collection('facebookCloudPublishingJobs').get()).empty).toBe(true);
    expect((await f.property.get()).data()?.defaultFacebookConnectionId).toBe('reauth');
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-setup', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-setup/' + scenarioId + '-latest.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Original prompt through persisted chat and local Firestore configuration. No external requests or publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it.each(['membership', 'role'])('rejects revoked %s', async change => {
    const f = await fixture(); await f.profile.update(change === 'membership' ? { agencyId: 'foreign' } : { role: 'disabled' });
    await expect(readFacebookSetup(f.ctx, 'accounts', [])).rejects.toThrow('Acces');
  });
  it.each(['property-foreign', 'property-deleted', 'profile-default', 'no-default', 'no-selection'])('handles account selection without guessing: %s', async variant => {
    const f = await fixture();
    if (variant === 'property-foreign') await f.property.update({ defaultFacebookConnectionId: 'other-agent' });
    if (variant === 'property-deleted') await f.property.update({ defaultFacebookConnectionId: 'deleted' });
    if (['profile-default', 'no-default'].includes(variant)) await f.property.update({ defaultFacebookConnectionId: null });
    if (variant === 'no-default') await f.profile.update({ defaultFacebookCloudConnectionId: null });
    const result = await readFacebookSetup(f.ctx, 'property-account', variant === 'no-selection' ? [] : f.history);
    if (variant === 'profile-default') expect(result.rows[0]).toMatchObject({ id: 'connected', selectionSource: 'profile_default' });
    else if (variant === 'no-selection') expect(result.needsSelection).toBe(true);
    else expect(result.rows[0]).toMatchObject({ accessible: false });
    expect(JSON.stringify(result)).not.toContain('hidden-agent-label');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('reports default groups separately from configured groups', async () => {
    const f = await fixture(); await f.agency.update({ facebookGroups: [] });
    const result = await readFacebookSetup(f.ctx, 'sale', []);
    expect(result.rows.length).toBeGreaterThan(0); expect(result.rows.every((row: any) => row.source === 'application_default')).toBe(true);
    expect(result.text).toContain('lista implicită');
  });
  it('refreshes a changed connection instead of repeating a stale chat result', async () => {
    const f = await fixture(); expect((await readFacebookSetup(f.ctx, 'accounts', [])).rows).toHaveLength(1);
    await f.connections.doc('connected').update({ status: 'needs_reauthentication' });
    expect((await readFacebookSetup(f.ctx, 'accounts', [])).rows).toHaveLength(0);
    expect((await readFacebookSetup(f.ctx, 'blocked', [])).rows).toHaveLength(6);
  });
  it.each(['missing', 'revoked', 'foreign-owner', 'offline'])('reports local runner configuration: %s', async variant => {
    const f = await fixture(); await f.connections.doc('connected').update({ runnerMode: 'local', deviceId: 'device' });
    if (variant !== 'missing') await f.agency.collection('facebookLocalRunnerDevices').doc('device').set({ ownerUid: variant === 'foreign-owner' ? 'other' : f.ctx.uid, status: 'offline', ...(variant === 'revoked' ? { revokedAt: new Date().toISOString() } : {}), tokenHash: 'sensitive-test-data' });
    const result = await readFacebookSetup(f.ctx, 'blocked', []);
    expect(result.rows.some((row: any) => row.id === 'connected')).toBe(variant !== 'offline');
    const accounts = await readFacebookSetup(f.ctx, 'accounts', []);
    expect(accounts.rows[0]).toMatchObject({ id: 'connected', publishingBlocked: variant !== 'offline', runnerState: variant === 'offline' ? 'offline' : 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('sensitive-test-data'); expect(mocks.fetch).not.toHaveBeenCalled();
  });});
