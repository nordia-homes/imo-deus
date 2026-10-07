import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: null as any, invoke: vi.fn(), queue: vi.fn(), cancel: vi.fn(), plan: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.context }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn(), agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('@/lib/owner-listings/olx-phone-queue', () => ({ upsertProspectingOlxPhoneQueueEntry: mocks.queue, cancelProspectingOlxPhoneQueueEntry: mocks.cancel }));
vi.mock('@/lib/owner-listings/enrichment-queue', () => ({ upsertPubli24ProspectingPhoneQueueEntry: mocks.queue, cancelProspectingPubli24PhoneQueueEntry: mocks.cancel }));
vi.mock('@/lib/owner-listings/olx-agent-connection', () => ({ getAgentOlxConnection: async () => ({ status: 'connected' }) }));
vi.mock('../operations', () => ({ operations: { owner_prospect: { method: 'POST', path: '/api/owner-listings/prospecting' } }, isReadOperation: () => false, invokeOperation: mocks.invoke }));
vi.mock('../workspace', () => ({ getPlan: mocks.plan }));
import { POST } from '@/app/api/owner-listings/prospecting/route';
import { searchProperties } from '../search';
import { selectContext } from '../context-selection';
import { actionSchema, searchSchema } from '../contracts';
import { executeAction } from '../actions';
import { operationResult } from '../operation-result';
import { readPlanOutcomes } from '../plan-outcomes';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('owner search to prospecting on Firestore with simulated phone provider', () => {
  let db: Firestore;
  const agencies: string[] = [], users: string[] = [], listings: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-prospecting-workflow' });
    mocks.invoke.mockImplementation(async (_ctx, input) => {
      const response = await POST(new NextRequest('http://localhost/api/owner-listings/prospecting', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input.body) }));
      if (!response.ok) throw new Error('Domain handler rejected request');
      return operationResult(input.operation, await response.json());
    });
  });
  afterAll(async () => {
    if (!db) return;
    for (const agency of agencies) await db.recursiveDelete(db.collection('agencies').doc(agency));
    for (const uid of users) await db.collection('users').doc(uid).delete();
    for (const id of listings) await db.collection('ownerListings').doc(id).delete();
    await db.terminate();
  });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { agencyId, uid, role: 'agent', adminDb: db } as any;
    await db.collection('agencies').doc(agencyId).set({ city: 'Bucuresti', county: 'Bucuresti' });
    await db.collection('users').doc(uid).set({ agencyId, role: 'agent', name: 'Fixture' });
    mocks.context = ctx; mocks.queue.mockClear(); mocks.invoke.mockClear();
    return ctx;
  }
  it('preserves selected order, writes through the existing handler once, then verifies current list membership', async () => {
    const ctx = await fixture(), ids = ['a','b','c'].map(suffix => ctx.agencyId + suffix); listings.push(...ids);
    for (const id of ids) await db.collection('ownerListings').doc(id).set({ scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, title: 'Apartament Drumul Taberei', location: 'Drumul Taberei', price: '120000 EUR', roomsValue: 3, propertyType: 'apartment', transactionType: 'sale', source: 'olx', link: `https://www.olx.ro/d/oferta/${id}.html` });
    const search = searchSchema.parse({ scopeKey: 'bucuresti-ilfov', zone: 'Drumul Taberei', rooms: 3, priceMax: 150000, limit: 100 });
    const found = await searchProperties(ctx, search);
    const orderedIds = found.rows.map(row => row.id);
    expect(orderedIds).toEqual(ids);
    const selected = await selectContext(ctx, { selections: [{ source: 'owners', messageId: 'm', search, orderedIds }] }, { source: 'owners', positions: [3, 1] });
    const actions = selected.rows.map(row => actionSchema.parse({ kind: 'existing_operation', operation: 'owner_prospect', params: {}, query: {}, body: { listingId: row.id, action: 'add' } }));
    expect((await db.collection('agencies').doc(ctx.agencyId).collection('ownerListingFavorites').get()).empty).toBe(true);
    const results = [];
    for (const [index, action] of actions.entries()) {
      const key = `approved-${index}`;
      results.push({ step: index + 1, result: await executeAction(ctx, action, key) });
      await executeAction(ctx, action, key);
    }
    expect(mocks.invoke).toHaveBeenCalledTimes(2); expect(mocks.queue).toHaveBeenCalledTimes(2);
    mocks.plan.mockResolvedValue({ data: { status: 'completed', actions, results } });
    const outcome = await readPlanOutcomes(ctx, 'plan');
    expect(outcome).toMatchObject({ outcome: { state: 'COMPLETED', confirmed: 2 }, pollAfterMs: null });
    expect(outcome.rows.every(row => row.businessStatus === 'added_to_prospecting')).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain('ownerPhone');
    const favorite = db.collection('agencies').doc(ctx.agencyId).collection('ownerListingFavorites').doc(ids[2]);
    await favorite.update({ isFavoriteActive: false });
    expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('BLOCKED');
    await db.collection('users').doc(ctx.uid).update({ agencyId: 'revoked' });
    await expect(readPlanOutcomes(ctx, 'plan')).rejects.toMatchObject({ status: 403 });
    await expect(executeAction(ctx, actions[0], 'revoked-attempt')).rejects.toMatchObject({ status: 403 });
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  }, 30000);
  it('polls phone state without rerunning the retry handler and fails closed on cross-agency evidence', async () => {
    const ctx = await fixture(), id = randomUUID(); listings.push(id);
    await db.collection('ownerListings').doc(id).set({ source: 'olx', link: `https://www.olx.ro/d/oferta/${id}.html`, title: 'Fixture' });
    const favorite = db.collection('agencies').doc(ctx.agencyId).collection('ownerListingFavorites').doc(id);
    await favorite.set({ isFavoriteActive: true });
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'owner_prospect', params: {}, query: {}, body: { listingId: id, action: 'retry' } });
    const result = await executeAction(ctx, action, 'retry');
    mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [action], results: [{ step: 1, result }] } });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'WAITING_PROVIDER' }, pollAfterMs: 15000 });
    await favorite.update({ phoneExtractionStatus: 'available', ownerPhone: '0722123456' });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, pollAfterMs: null });
    expect(mocks.invoke).toHaveBeenCalledTimes(1); expect(mocks.queue).toHaveBeenCalledTimes(1);
    const other = await fixture();
    expect((await readPlanOutcomes(other, 'plan')).rows[0].executionState).toBe('unavailable');
  }, 30000);
  it('does not infer a completed operation or replay it after the handler writes but phone queueing fails', async () => {
    const ctx = await fixture(), id = randomUUID(); listings.push(id);
    await db.collection('ownerListings').doc(id).set({ source: 'olx', title: 'Fixture', link: `https://www.olx.ro/d/oferta/${id}.html` });
    mocks.queue.mockRejectedValueOnce(new Error('simulated provider outage'));
    const action = actionSchema.parse({ kind: 'existing_operation', operation: 'owner_prospect', params: {}, query: {}, body: { listingId: id, action: 'add' } });
    await expect(executeAction(ctx, action, 'uncertain')).rejects.toThrow('rejected');
    expect((await db.collection('agencies').doc(ctx.agencyId).collection('ownerListingFavorites').doc(id).get()).data()?.isFavoriteActive).toBe(true);
    await expect(executeAction(ctx, action, 'uncertain')).rejects.toMatchObject({ status: 409 });
    mocks.plan.mockResolvedValue({ data: { status: 'unknown', actions: [action], results: [], stoppedStep: { step: 1, result: {} } } });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'BLOCKED' }, rows: [{ businessStatus: 'unconfirmed_receipt' }] });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  }, 30000);
});
