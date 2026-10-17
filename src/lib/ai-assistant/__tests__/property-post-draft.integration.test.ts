import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { preparePropertyPost } from '../property-post-draft';
import { chatTurn } from '../workspace';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('property post drafting through persisted chat', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-property-post' }); vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(() => { mocks.fetch.mockReset().mockRejectedValue(new Error('External requests forbidden')); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    await agency.set({ name: 'Synthetic' }); await profile.set({ agencyId, role: 'agent' });
    const property = agency.collection('properties').doc('property');
    const raw = { title: 'Apartament Cișmigiu', transactionType: 'Vanzare', location: 'București', price: 125000, rooms: 2, squareFootage: 54, amenities: ['Balcon'], ownerName: 'PRIVATE', ownerPhone: 'PRIVATE', notes: 'PRIVATE', description: 'PROMISIUNE PRIVATĂ' };
    await property.set(raw);
    const history: any[] = [{ id: 'current-page-context', role: 'assistant', cards: [{ source: 'properties', rows: [{ id: 'property' }] }] }];
    return { ctx, agency, profile, property, raw, history };
  }
  const promptFor = (id: string) => corpus.scenarios.find(row => row.id === id)!.text;
  for (const scenarioId of ['master-0372', 'master-0373', 'master-0374', 'master-0375']) it('executes original ' + scenarioId, async () => {
    const f = await fixture(), sessionId = randomUUID();
    if (scenarioId !== 'master-0372') await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: promptFor('master-0372'), currentRecord: { resource: 'properties', id: 'property' } });
    const input = { sessionId, requestId: randomUUID(), prompt: promptFor(scenarioId), currentRecord: scenarioId === 'master-0372' ? { resource: 'properties' as const, id: 'property' } : null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined();
    const draft = result.message.cards?.find(card => card.source === 'facebookPostDraft')?.rows[0];
    expect(draft).toMatchObject({ propertyId: 'property', source: 'current_crm_fields', publicationConfirmed: false, style: scenarioId === 'master-0373' ? 'commercial' : 'neutral' });
    expect(draft?.text).toContain('125.000 EUR'); expect(draft?.text).toContain('Balcon'); expect(String(draft?.text)).not.toMatch(/PRIVATE|PROMISIUNE|metrou|randament/i);
    expect((await f.property.get()).data()).toEqual(f.raw); expect((await f.agency.collection('facebookCloudPublishingJobs').get()).empty).toBe(true);
    const saved = await f.agency.collection('assistantSessions').doc(sessionId).collection('messages').get(); expect(saved.docs.some(doc => doc.data().cards?.some((card: any) => card.source === 'facebookPostDraft' && card.rows[0]?.revision === draft?.revision))).toBe(true);
    const replay = await chatTurn(f.ctx, input); expect(replay.message.id).toBe(result.message.id); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-property-post', { recursive: true }); await writeFile('.tmp/jarvis-property-post/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt: input.prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual persisted chat reads fresh property fields on local Firestore. No model calls or publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it('refreshes changed facts and removes deleted amenities while preserving commercial style', async () => {
    const f = await fixture(), sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: promptFor('master-0373'), currentRecord: { resource: 'properties', id: 'property' } });
    const previous = first.message.cards![0].rows[0];
    await f.property.update({ price: 119000, amenities: [] });
    const next = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: promptFor('master-0374'), currentRecord: { resource: 'properties', id: 'property' } });
    const draft = next.message.cards![0].rows[0]; expect(draft.style).toBe('commercial'); expect(draft.text).toContain('119.000 EUR'); expect(String(draft.text)).not.toMatch(/125.000|Balcon/); expect(draft.revision).not.toBe(previous.revision); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(['membership', 'role', 'deleted', 'foreign-agency', 'missing'])('does not draft from inaccessible data: %s', async variant => {
    const f = await fixture();
    if (variant === 'membership') await f.profile.update({ agencyId: 'other' });
    if (variant === 'role') await f.profile.update({ role: 'disabled' });
    if (variant === 'deleted') await f.property.update({ deletedAt: 'now' });
    if (variant === 'foreign-agency') await f.property.update({ agencyId: 'other' });
    if (variant === 'missing') await f.property.delete();
    await expect(preparePropertyPost(f.ctx, 'prepare', f.history)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(['Inchiriere', 'unknown'])('does not change %s into a sale', async transactionType => {
    const f = await fixture(); await f.property.update({ transactionType });
    const result = await preparePropertyPost(f.ctx, 'commercial', f.history); expect(result.clarification).toBe(true); expect(result.rows).toEqual([]); expect((await f.property.get()).data()?.transactionType).toBe(transactionType);
  });
  it('requests a selection when no property or multiple properties are selected', async () => {
    const f = await fixture(); expect((await preparePropertyPost(f.ctx, 'prepare', [])).clarification).toBe(true);
    f.history[0].cards[0].rows.push({ id: 'other' }); expect((await preparePropertyPost(f.ctx, 'prepare', f.history)).clarification).toBe(true);
  });
  it.each(['Vândut', 'Închiriat', 'Inactiv'])('does not prepare an active offer after the property became %s', async status => {
    const f = await fixture(); await f.property.update({ status });
    const result = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt: promptFor('master-0372'), currentRecord: { resource: 'properties', id: 'property' } });
    expect(result.message.text).toContain('Nu am pregătit o ofertă activă'); expect(result.message.cards?.[0].rows).toEqual([]); expect((await f.property.get()).data()?.status).toBe(status);
  });
  it('rebuilds an old draft from fresh facts rather than preserving unsupported claims', async () => {
    const f = await fixture();
    const history: any[] = [{ role: 'assistant', cards: [{ source: 'facebookPostDraft', rows: [{ propertyId: 'property', text: 'Piscină, lift și randament garantat', style: 'commercial' }] }] }];
    const result = await preparePropertyPost(f.ctx, 'amenities', history);
    expect(result.rows[0].text).toContain('Balcon'); expect(result.rows[0].text).not.toMatch(/Piscină|lift|randament/); expect(result.rows[0].style).toBe('commercial');
  });
  for (const scenarioId of ['master-0391', 'master-0392']) it('executes platform draft original ' + scenarioId + ' without changing CRM publication content', async () => {
    const f = await fixture(), sessionId = randomUUID();
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: promptFor('master-0372'), currentRecord: { resource: 'properties', id: 'property' } });
    await f.property.update({ price: 119000 });
    const input = { sessionId, requestId: randomUUID(), prompt: promptFor(scenarioId), currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    const draft = result.message.cards?.find(card => card.source === 'facebookPostDraft')?.rows[0];
    expect(draft?.platform).toBe(scenarioId === 'master-0391' ? 'facebook' : 'instagram');
    expect(String(draft?.text).length).toBeLessThanOrEqual(scenarioId === 'master-0391' ? 500 : 2200);
    expect(draft?.text).toContain('119.000 EUR'); expect(String(draft?.text)).not.toMatch(/125.000|PRIVATE|PROMISIUNE/);
    expect(draft?.publicationConfirmed).toBe(false); expect(result.message.planId).toBeUndefined();
    expect((await f.property.get()).data()).toEqual({ ...f.raw, price: 119000 });
    expect((await f.agency.collection('facebookCloudPublishingJobs').get()).empty).toBe(true);
    expect((await f.agency.collection('socialPosts').get()).empty).toBe(true);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-property-post', { recursive: true }); await writeFile('.tmp/jarvis-property-post/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt: input.prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat and fresh CRM fields on local Firestore; platform copy stays in conversation and does not affect publication.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
});
