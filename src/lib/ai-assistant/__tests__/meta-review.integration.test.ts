import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { prepareMetaReview } from '../meta-review';
import { chatTurn } from '../workspace';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
const ids = [401,403,408,409,410,416,417,418,419,426,434,442,443];
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Meta reviews through persisted chat', () => {
 let db: Firestore; const agencies: string[] = [], users: string[] = [];
 beforeAll(() => { if (!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required'); db = new Firestore({ projectId: 'demo-imodeus-meta-review' }); mocks.fetch.mockRejectedValue(new Error('External calls forbidden')); vi.stubGlobal('fetch', mocks.fetch); });
 afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
 async function fixture() {
  const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
  const ctx = { agencyId, uid, role: 'agent', adminDb: db } as any; mocks.actor = ctx;
  const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
  await agency.set({ name: 'Synthetic' }); await profile.set({ agencyId, role: 'agent' });
  await agency.collection('properties').doc('property').set({ agencyId, title: 'Cișmigiu', status: 'Activ', latitude: 44.4, longitude: 26.1 });
  await agency.collection('integrations').doc('meta').set({ connected: true, selectedBusiness: { id: 'business' }, selectedAdAccount: { id: 'account' }, selectedPage: { id: 'page' }, access_token: 'SECRET' });
  const campaigns = agency.collection('metaCampaignDrafts');
  const draft = { agencyId, propertyId: 'property', campaignName: 'Cișmigiu', adSetName: 'Set', adName: 'Ad', status: 'draft', objective: 'traffic', budgetType: 'daily', budgetAmount: 50, currency: 'EUR', durationDays: 7, headline: 'Titlu', primaryText: 'Descriere', locationLabel: 'București', radiusKm: 15, placements: ['facebook_feed'], specialAdCategory: 'HOUSING', creativeFormat: 'single_image', mediaItems: [{ type: 'image', url: 'https://example.invalid/photo.jpg' }], destinationUrl: 'https://example.invalid/property', insights: { spend: 120, leads: 4, costPerLead: 999, updatedAt: '2026-10-17T07:00:00Z' }, lastPublishError: 'access_token=SECRET', publishLog: [{ at: '2026-10-17T07:00:00Z', status: 'error', message: 'access_token=SECRET' }], publishAttempts: 1 };
  await campaigns.doc('campaign').set(draft);
  return { ctx, agency, profile, campaigns, draft };
 }
 for (const n of ids) it('executes original master-' + String(n).padStart(4,'0'), async () => {
  const f = await fixture(), scenarioId = 'master-' + String(n).padStart(4,'0'), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
  if (n === 408) await f.campaigns.doc('campaign').update({ mediaItems: Array.from({ length: 8 }, (_, i) => ({ type: 'image', url: 'https://example.invalid/photo' + i + '.jpg' })) });
  if (n === 442) await f.campaigns.doc('campaign').update({ publishLog: Array.from({ length: 12 }, () => f.draft.publishLog[0]) });
  if (n === 410) await f.campaigns.doc('campaign').update({ mediaItems: [] });
  if (n === 434) await f.campaigns.doc('campaign').update({ 'insights.leads': 0 });
  const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: { resource: 'properties', id: 'property' } } as any;
  const before = (await f.campaigns.get()).docs.map(doc => doc.data());
  const result = await chatTurn(f.ctx, input), row = result.message.cards?.[0]?.rows[0];
  expect(row).toBeDefined(); expect(result.message.planId).toBeUndefined();
  if (n === 401) expect(row?.connected).toBe(true);
  if ([403,416,434].includes(n)) expect(result.message.cards?.[0].rows.map(row => row.id)).toEqual(['campaign']);
  if (n === 408) { expect(row?.budgetAmount).toBe(50); expect(row?.mediaItems).toHaveLength(8); }
  if (n === 409) { expect(row?.readyLocally).toBe(true); expect(row?.providerValidated).toBe(false); }
  if (n === 410) { expect(row?.readyLocally).toBe(false); expect(JSON.stringify(row?.errors)).toContain('imagine'); }
  if (n === 417) expect(row?.spend).toBe(120);
  if (n === 418) expect(row?.leads).toBe(4);
  if (n === 419) expect(row?.costPerLead).toBe(30);
  if (n === 426) { expect(row?.radiusKm).toBe(15); expect(row?.specialAdCategory).toBe('HOUSING'); }
  if (n === 442) { expect(row?.events).toHaveLength(12); expect(JSON.stringify(row?.events)).toContain('10:00'); }
  if (n === 443) expect(row?.lastPublishError).toContain('[omis]');
  expect(JSON.stringify(result)).not.toContain('SECRET'); expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
  expect((await f.campaigns.get()).docs.map(doc => doc.data())).toEqual(before); expect(mocks.fetch).not.toHaveBeenCalled();
  await mkdir('.tmp/jarvis-meta-review', { recursive: true }); await writeFile('.tmp/jarvis-meta-review/' + scenarioId + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Persisted chat with local Firestore. Saved CRM data and actual shared publication validator; no live Meta verification or spending.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
 });
 it('requires a selection, rechecks eligibility and supports a selected campaign', async () => {
  const f = await fixture(); await f.campaigns.doc('second').set({ ...f.draft, currency: 'RON' });
  const prompt = 'Care este costul per lead.', report = await prepareMetaReview(f.ctx, prompt, []);
  expect(report?.source).toBe('metaReviewSelection');
  const history = [{ id: 'assistant', role: 'assistant', cards: [{ source: report!.source, rows: report!.rows }] }] as any;
  expect((await prepareMetaReview(f.ctx, 'Campanie Meta: second', history))?.rows[0]).toMatchObject({ currency: 'RON', costPerLead: 30 });
  await expect(prepareMetaReview(f.ctx, 'Campanie Meta: unknown', history)).rejects.toThrow();
  await f.campaigns.doc('second').update({ deletedAt: 'now' });
  await expect(prepareMetaReview(f.ctx, 'Campanie Meta: second', history)).rejects.toThrow();
 });
 it('reads beyond 50, excludes foreign/deleted records and never treats missing metrics as zero', async () => {
  const f = await fixture(), batch = db.batch();
  for (let i=0;i<55;i++) batch.set(f.campaigns.doc('row-'+i), { ...f.draft, insights: { spend: 20 }, currency: 'RON' });
  batch.set(f.campaigns.doc('foreign'), { ...f.draft, agencyId: 'other' }); batch.set(f.campaigns.doc('deleted'), { ...f.draft, status: 'deleted' }); await batch.commit();
  expect((await prepareMetaReview(f.ctx, 'Arată-mi dashboardul Meta.', []))?.rows).toHaveLength(56);
  expect((await prepareMetaReview(f.ctx, 'Spune-mi campaniile care au spend și zero leaduri.', []))?.rows).toEqual([]);
  await f.profile.update({ agencyId: 'other' }); await expect(prepareMetaReview(f.ctx, 'Arată-mi dashboardul Meta.', [])).rejects.toThrow('Acces');
 });
 it('does not infer a property without page context and rejects inaccessible property readiness', async () => {
  const f = await fixture(); expect((await prepareMetaReview(f.ctx, 'Arată-mi campaniile proprietății acesteia.', []))?.rows).toEqual([]);
  await f.agency.collection('properties').doc('property').update({ agencyId: 'other' });
  expect((await prepareMetaReview(f.ctx, 'Verifică dacă este ready pentru publicare.', []))?.rows[0]).toMatchObject({ readyLocally: false });
 });
 it('completes campaign selection through persisted conversation and replays the result', async () => {
  const f = await fixture(); await f.campaigns.doc('second').set({ ...f.draft, insights: { spend: 99, leads: 3 }, currency: 'RON' });
  const sessionId = randomUUID();
  const offered = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Care este costul per lead?', currentRecord: null });
  expect(offered.message.cards?.[0].source).toBe('metaReviewSelection');
  const input = { sessionId, requestId: randomUUID(), prompt: 'Campanie Meta: second', currentRecord: null };
  const selected = await chatTurn(f.ctx, input);
  expect(selected.message.cards?.[0].rows[0]).toMatchObject({ id: 'second', costPerLead: 33, currency: 'RON' });
  expect((await chatTurn(f.ctx, input)).message.id).toBe(selected.message.id);
 });});
