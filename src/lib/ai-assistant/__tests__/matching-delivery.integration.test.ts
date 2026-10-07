import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ plan: vi.fn(), invoke: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn(), agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: mocks.invoke }));
vi.mock('../workspace', () => ({ getPlan: mocks.plan }));
import { matchContact, executeAction } from '../actions';
import { saveResultSet } from '../context';
import { selectContext } from '../context-selection';
import { readPlanOutcomes } from '../plan-outcomes';
import { actionSchema } from '../contracts';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('matching, portal and message evidence with actual Firestore', () => {
  let db: Firestore;
  const agencies: string[] = [], users: string[] = [], portals: string[] = [], jobs: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-matching-delivery' });
  });
  afterAll(async () => {
    if (!db) return;
    for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id));
    for (const id of users) await db.collection('users').doc(id).delete();
    for (const id of portals) await db.recursiveDelete(db.collection('portals').doc(id));
    for (const id of jobs) await db.collection('communicationOutboundJobs').doc(id).delete();
    await db.terminate();
  });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { agencyId, uid, role: 'agent', adminDb: db } as any, agency = db.collection('agencies').doc(agencyId);
    await db.collection('users').doc(uid).set({ agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set({ name: 'Andrei Fixture', contactType: 'Cumparator', status: 'Nou', budget: 150000, city: 'Bucuresti', zones: ['Titan'], preferences: { desiredPriceRangeMin: 80000, desiredPriceRangeMax: 150000, desiredRooms: 2, desiredSquareFootageMin: 40, desiredSquareFootageMax: 80, locationPreferences: 'Titan' } });
    for (const [index, price] of [120000, 130000, 90000].entries()) await agency.collection('properties').doc(`p${index}`).set({ title: 'Apartament Titan', status: 'Activ', propertyType: 'Apartament', transactionType: 'Vanzare', price, rooms: 2, bathrooms: 1, squareFootage: 60, city: 'Bucuresti', zone: 'Titan', location: 'Titan', address: 'Titan' });
    const matches = await matchContact(ctx, 'c', 10);
    expect(matches.length).toBe(3);
    const resultSetId = await saveResultSet(ctx, matches, 'c');
    const summary = { selections: [{ messageId: 'matching', source: 'crm', resultSetId, orderedIds: matches.map(row => row.id) }] };
    return { ctx, agency, matches, resultSetId, summary };
  }
  it('keeps the second matching result, verifies the portal, then distinguishes acceptance from delivery', async () => {
    const { ctx, agency, matches, summary } = await fixture();
    const selected = await selectContext(ctx, summary, { positions: [2] });
    expect(selected).toMatchObject({ contactId: 'c', scoreMayBeStale: false, rows: [{ id: matches[1].id, matchScore: matches[1].matchScore, reasoning: matches[1].reasoning }] });
    const action = actionSchema.parse({ kind: 'recommend_properties', contactId: 'c', propertyIds: [matches[1].id] });
    const key = randomUUID(); portals.push(key);
    const receipt = await executeAction(ctx, action, key);
    await executeAction(ctx, action, key);
    expect((await db.collection('portals').doc(key).collection('recommendations').get()).size).toBe(1);
    const plan: any = { status: 'completed', actions: [action], results: [{ step: 1, result: receipt }] };
    mocks.plan.mockResolvedValue({ data: plan });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, rows: [{ businessStatus: 'portal_recommended' }] });
    const conversation = agency.collection('conversations').doc('conversation');
    await conversation.set({ agencyId: ctx.agencyId, assigneeId: ctx.uid, collaboratorIds: [], connectionId: 'connection', contactId: 'c' });
    const messageId = randomUUID(); jobs.push(messageId);
    const body = { text: `Oferta aprobată: https://fixture.example/portal/${key}` };
    const job = db.collection('communicationOutboundJobs').doc(messageId), message = conversation.collection('messages').doc(messageId);
    // Provider effects are simulated; no real message-send handler is called.
    await job.set({ agencyId: ctx.agencyId, uid: ctx.uid, conversationId: 'conversation', connectionId: 'connection', input: body });
    await message.set({ agencyId: ctx.agencyId, authorId: ctx.uid, conversationId: 'conversation', direction: 'sent', origin: 'imodeus', status: 'accepted', externalId: 'provider-fixture' });
    plan.actions.push(actionSchema.parse({ kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'conversation' }, query: {}, body }));
    plan.results.push({ step: 2, result: { messageId, executionState: 'queued' } });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'WAITING_PROVIDER', confirmed: 1 }, pollAfterMs: 15000 });
    await message.update({ status: 'delivered' });
    expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED', confirmed: 2 }, rows: [{ businessStatus: 'portal_recommended' }, { businessStatus: 'delivered' }] });
    await job.update({ 'input.text': 'Another message' });
    expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('BLOCKED');
    expect(mocks.invoke).not.toHaveBeenCalled();
  }, 30000);
  it('marks changed scores stale and refuses expired or inactive ordinal selections without replacement', async () => {
    const { ctx, agency, matches, resultSetId, summary } = await fixture();
    await agency.collection('properties').doc(matches[1].id).update({ price: 110000 });
    expect(await selectContext(ctx, summary, { positions: [2] })).toMatchObject({ scoreMayBeStale: true, rows: [{ id: matches[1].id, matchScore: matches[1].matchScore }] });
    await agency.collection('properties').doc(matches[1].id).update({ status: 'Vândut' });
    await expect(selectContext(ctx, summary, { positions: [2] })).rejects.toThrow('nu mai este activă');
    await agency.collection('assistantResultSets').doc(resultSetId).update({ expiresAt: 0 });
    await expect(selectContext(ctx, summary, { positions: [2] })).rejects.toThrow('expirat');
  }, 30000);
  it('does not retain portal success after removal, reassignment or revocation', async () => {
    const { ctx, agency, matches } = await fixture();
    const key = randomUUID(); portals.push(key);
    const action = actionSchema.parse({ kind: 'recommend_properties', contactId: 'c', propertyIds: [matches[0].id] });
    const receipt = await executeAction(ctx, action, key);
    mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [action], results: [{ step: 1, result: receipt }] } });
    await db.collection('portals').doc(key).collection('recommendations').doc(matches[0].id).delete();
    expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('BLOCKED');
    await db.collection('portals').doc(key).update({ agencyId: 'other' });
    expect((await readPlanOutcomes(ctx, 'plan')).rows[0].executionState).toBe('unavailable');
    await db.collection('users').doc(ctx.uid).update({ agencyId: 'other' });
    await expect(readPlanOutcomes(ctx, 'plan')).rejects.toMatchObject({ status: 403 });
  }, 30000);
});
