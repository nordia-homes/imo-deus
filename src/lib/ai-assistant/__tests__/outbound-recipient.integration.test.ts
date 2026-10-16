import { randomUUID } from 'node:crypto';
import { personalRecipientProof } from '@/lib/communications/personal-recipient';
vi.mock('@/lib/communications/whatsapp-config', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/communications/whatsapp-config')>(), assertWhatsAppAccess: () => {}, whatsappAppId: () => 'fixture-app' }));
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ token: vi.fn(), graph: vi.fn(), actor: null as any }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/meta', () => ({ connectionToken: mocks.token, graph: mocks.graph, onboardingConfig: () => ({ configured: true }), MetaGraphError: class extends Error { providerStatus = 500; } }));
import { queueMessage, drainOutbound } from '@/lib/communications/outbound';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { bindBusinessRevisions } from '../business-revisions';
import { approvalEnvelope, validateApproval } from '../approval';
import { matchContact } from '../actions';
import { saveResultSet } from '../context';
import { resolveMatchingRecipient } from '../matching-recipient';
import { matchingRevision } from '../matching-revision';
import { stableId } from '@/lib/communications/crypto';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('approved recipient through the real outbound queue and worker', () => {
  let db: Firestore;
  const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-outbound-recipient' });
  });
  beforeEach(() => {
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-receipt-key');
    mocks.token.mockReset(); mocks.graph.mockReset();
    mocks.token.mockImplementation(async (_db, _actor, id) => ({ connection: { id, channel: 'messenger', externalId: 'fixture-page' }, token: 'fixture-token' }));
    mocks.graph.mockResolvedValue({ message_id: randomUUID() });
  });
  afterAll(async () => {
    if (!db) return;
    for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id));
    for (const id of users) await db.collection('users').doc(id).delete();
    for (const name of ['communicationOutboundJobs', 'communicationMessageMappings', 'communicationSearchJobs']) {
      const docs = await db.collection(name).get();
      for (const doc of docs.docs) await doc.ref.delete();
    }
    await db.terminate();
    vi.unstubAllEnvs();
  });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(), id = randomUUID(); agencies.push(agencyId); users.push(uid);
    const actor = { agencyId, uid, role: 'agent' }, ctx = { ...actor, adminDb: db } as any;
    await db.collection('users').doc(uid).set({ agencyId, role: 'agent' });
    const conversation = { id, agencyId, channel: 'messenger', connectionId: randomUUID(), externalParticipantId: randomUUID(), contactId: 'contact', assigneeId: uid, collaboratorIds: [], lastInboundAt: new Date().toISOString(), status: 'open', version: 1 };
    const ref = db.collection('agencies').doc(agencyId).collection('conversations').doc(id);
    await ref.set(conversation);
    const actions = await bindBusinessRevisions(ctx, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: id }, query: {}, body: { text: 'Oferta verificată pentru client.' } }]);
    const envelope = approvalEnvelope(uid, agencyId, 'fixture-plan', actions, Date.now() + 60000);
    validateApproval(envelope, uid, agencyId, 'fixture-plan', actions);
    const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
    const input: Record<string, any> = { ...action.body, requestId: randomUUID() };
    return { actor, conversation, ref, input, actions, envelope };
  }
  it('lets an agent record consent, claim an unassigned WhatsApp conversation and send, but rejects another agent assignment', async () => {
    const f = await marketingFixture();
    const ctx = { ...f.actor, adminDb: db } as any;
    mocks.actor = ctx;
    const { POST, GET } = await import('@/app/api/communications/[...path]/route');
    const { NextRequest } = await import('next/server');
    const { updateConversation } = await import('@/lib/communications/server');
    await f.ref.update({ assigneeId: null, accessUids: [], lastMessageAt: new Date().toISOString() });
    const list = await GET(new NextRequest('http://localhost/api/communications/conversations?status=unassigned'), { params: Promise.resolve({ path: ['conversations'] }) });
    expect(list.status).toBe(200); expect((await list.json()).conversations.map((row: any) => row.id)).toContain(f.ref.id);
    const consent = async (evidence = 'Acord telefonic real consemnat de agent.') => POST(new NextRequest('http://localhost/api/communications/consent', { method: 'POST', body: JSON.stringify({ conversationId: f.ref.id, purpose: 'marketing', status: 'granted', evidence }) }), { params: Promise.resolve({ path: ['consent'] }) });
    expect((await consent('scurt')).status).toBe(400);
    expect((await consent()).status).toBe(200);
    const saved = db.collection('agencies').doc(f.actor.agencyId).collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722123456', 'marketing'));
    expect((await saved.get()).data()).toMatchObject({ status: 'granted', recordedBy: f.actor.uid });
    expect((await saved.collection('history').get()).size).toBe(1);
    await updateConversation(db as any, f.actor, f.ref.id, { assigneeId: f.actor.uid, version: 1 });
    expect((await f.ref.get()).data()?.assigneeId).toBe(f.actor.uid);
    await queueMessage(db as any, f.actor, f.ref.id, f.input);
    await drainOutbound(db as any); expect(templateSends()).toHaveLength(1);
    await f.ref.update({ assigneeId: 'other-agent', accessUids: ['other-agent'] });
    expect((await consent()).status).toBe(403);
    await expect(updateConversation(db as any, f.actor, f.ref.id, { assigneeId: f.actor.uid, version: 2 })).rejects.toMatchObject({ status: 403 });
    await expect(queueMessage(db as any, f.actor, f.ref.id, { ...f.input, requestId: randomUUID() })).rejects.toMatchObject({ status: 403 });
    expect((await saved.collection('history').get()).size).toBe(1);
    expect(templateSends()).toHaveLength(1);
  }, 30000);
  it('resolves the second real matching result to its client conversation before preparing and queuing the message', async () => {
    const f = await fixture(), agency = db.collection('agencies').doc(f.actor.agencyId), ctx = { ...f.actor, adminDb: db } as any;
    await agency.collection('contacts').doc('contact').set({ name: 'Andrei', contactType: 'Cumparator', budget: 150000, preferences: { desiredRooms: 2, desiredPriceRangeMax: 150000 } });
    for (const id of ['p1', 'p2']) await agency.collection('properties').doc(id).set({ title: `Apartament ${id}`, status: 'Activ', rooms: 2, price: 120000, transactionType: 'Vanzare', propertyType: 'Apartament' });
    await f.ref.update({ lastMessageAt: new Date().toISOString(), accessUids: [f.actor.uid] });
    const rows = await matchContact(ctx, 'contact', 10); expect(rows.length).toBe(2);
    const resultSetId = await saveResultSet(ctx, rows, 'contact');
    const summary = { selections: [{ messageId: 'matching', source: 'crm', resultSetId, orderedIds: rows.map(row => row.id) }] };
    const selected = await resolveMatchingRecipient(ctx, summary, { resultSetId, position: 2 });
    expect(selected).toMatchObject({ contactId: 'contact', conversationId: f.ref.id, eligibilityChecked: false, rows: [{ id: rows[1].id, matchScore: rows[1].matchScore }] });
    const actions = await bindBusinessRevisions(ctx, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: selected.conversationId! }, query: {}, body: { text: `Vă propun ${(selected.rows[0] as Record<string, any>).title}.`, matchingSelection: selected.matchingSelection } }]);
    validateApproval(approvalEnvelope(f.actor.uid, f.actor.agencyId, 'matching-send', actions, Date.now() + 60000), f.actor.uid, f.actor.agencyId, 'matching-send', actions);
    const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
    await queueMessage(db as any, f.actor, f.ref.id, { ...action.body, requestId: randomUUID() });
    await drainOutbound(db as any); expect(mocks.graph).toHaveBeenCalledTimes(1);
    await f.ref.update({ contactId: 'other-client' });
    await expect(resolveMatchingRecipient(ctx, summary, { resultSetId, position: 2, conversationId: f.ref.id })).rejects.toThrow('nu corespunde');
  });
  async function matchingFixture() {
    const f = await fixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    const property = { status: 'Activ', title: 'Oferta aleasă', price: 120000 }, contact = { name: 'Client test', budget: 150000 };
    const propertyRef = agency.collection('properties').doc('selected'), contactRef = agency.collection('contacts').doc('contact'), setRef = agency.collection('assistantResultSets').doc('selection');
    await propertyRef.set(property); await contactRef.set(contact);
    await setRef.set({ ownerId: f.actor.uid, kind: 'existing_matches', contactId: 'contact', expiresAt: Date.now() + 60000, rows: [{ id: 'selected' }], accessRefs: [{ resource: 'properties', id: 'selected' }, { resource: 'contacts', id: 'contact' }] });
    const matchingSelection = { resultSetId: 'selection', propertyId: 'selected', contactId: 'contact', propertyRevision: matchingRevision(property), contactRevision: matchingRevision(contact) };
    const actions = await bindBusinessRevisions({ ...f.actor, adminDb: db } as any, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: f.ref.id }, query: {}, body: { text: 'Oferta aleasă: 120000 EUR.', matchingSelection } }]);
    const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
    return { ...f, propertyRef, contactRef, setRef, input: { ...action.body, requestId: randomUUID() } as Record<string, any> };
  }
  const matchingChanges = ['price', 'inactive', 'contact', 'expired', 'owner', 'membership'] as const;
  async function changeMatching(f: Awaited<ReturnType<typeof matchingFixture>>, change: typeof matchingChanges[number]) {
    if (change === 'price') await f.propertyRef.update({ price: 130000 });
    if (change === 'inactive') await f.propertyRef.update({ status: 'Vandut' });
    if (change === 'contact') await f.contactRef.update({ budget: 100000 });
    if (change === 'expired') await f.setRef.update({ expiresAt: 1 });
    if (change === 'owner') await f.setRef.update({ ownerId: 'other' });
    if (change === 'membership') await f.setRef.update({ rows: [{ id: 'replacement' }] });
  }
  it.each(matchingChanges)('rejects matching change %s before queue creation', async change => {
    const f = await matchingFixture(); await changeMatching(f, change);
    await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow('Selecția');
    expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(mocks.graph).not.toHaveBeenCalled();
  });
  it.each(matchingChanges)('rejects matching change %s after queueing and before provider invocation', async change => {
    const f = await matchingFixture(), result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
    expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()?.input.matchingSelection).toEqual(f.input.matchingSelection);
    await changeMatching(f, change);
    // An idempotent receipt lookup remains available; it does not authorize another send.
    expect(await queueMessage(db as any, f.actor, f.ref.id, f.input)).toEqual(result);
    await drainOutbound(db as any);
    expect(mocks.graph).not.toHaveBeenCalled();
    expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()).toMatchObject({ status: 'failed', budgetSettled: true });
  });
  it('rechecks matching inside the queue transaction after estimation', async () => {
    const f = await matchingFixture();
    mocks.token.mockImplementationOnce(async () => {
      await f.propertyRef.update({ price: 130000 });
      return { connection: { id: f.conversation.connectionId, channel: 'messenger', externalId: 'fixture-page' }, token: 'fixture-token' };
    });
    await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow('Selecția');
    expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('pins the approved recipient, queues once and invokes the simulated provider only once', async () => {
    const f = await fixture();
    const preview = await queueMessage(db as any, f.actor, f.ref.id, f.input, true);
    expect(preview).toMatchObject({ renderedText: 'Oferta verificată pentru client.' });
    const result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
    const replay = await queueMessage(db as any, f.actor, f.ref.id, f.input);
    expect(replay).toEqual(result);
    expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()?.recipientRevision).toBe(recipientRevision(f.conversation));
    await drainOutbound(db as any); await drainOutbound(db as any);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
    expect(mocks.graph.mock.calls[0][2].recipient.id).toBe(f.conversation.externalParticipantId);
    expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('accepted');
    expect((await queueMessage(db as any, f.actor, f.ref.id, f.input)).status).toBe('accepted');
  });
  it.each(['before_queue', 'during_estimate', 'after_queue', 'during_worker'])('stops a follow-up when a reply arrives %s', async timing => {
    const f = await fixture(), cutoff = new Date(Date.now() + 1000).toISOString();
    const input = { ...f.input, stopOnReplySince: cutoff };
    const reply = () => f.ref.update({ lastInboundAt: new Date(Date.parse(cutoff) + 1).toISOString() });
    if (timing === 'before_queue') await reply();
    if (timing === 'during_estimate') mocks.token.mockImplementationOnce(async () => {
      await reply(); return { connection: { id: f.conversation.connectionId, channel: 'messenger', externalId: 'fixture-page' }, token: 'fixture-token' };
    });
    if (timing === 'before_queue' || timing === 'during_estimate') {
      await expect(queueMessage(db as any, f.actor, f.ref.id, input)).rejects.toThrow('a răspuns');
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
    } else {
      const result = await queueMessage(db as any, f.actor, f.ref.id, input);
      if (timing === 'after_queue') await reply();
      else mocks.token.mockImplementationOnce(async () => {
        await reply(); return { connection: { id: f.conversation.connectionId, channel: 'messenger', externalId: 'fixture-page' }, token: 'fixture-token' };
      });
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()).toMatchObject({ status: 'failed', budgetSettled: true });
      expect((await queueMessage(db as any, f.actor, f.ref.id, input)).status).toBe('failed');
    }
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('sends a follow-up once when no new reply is recorded', async () => {
    const f = await fixture(), input = { ...f.input, stopOnReplySince: new Date(Date.now() + 1000).toISOString() };
    const result = await queueMessage(db as any, f.actor, f.ref.id, input);
    await drainOutbound(db as any); await drainOutbound(db as any);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
    expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('accepted');
  });
  it('rejects stale recipient approval before estimating or creating a job', async () => {
    const f = await fixture(); await f.ref.update({ externalParticipantId: 'changed' });
    mocks.token.mockClear();
    await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow('s-a schimbat');
    expect(mocks.token).not.toHaveBeenCalled(); expect((await f.ref.collection('messages').get()).empty).toBe(true);
  });
  it('detects a recipient change between the estimate and the queue transaction', async () => {
    const f = await fixture();
    mocks.token.mockImplementationOnce(async () => {
      await f.ref.update({ contactId: 'other-contact' });
      return { connection: { id: f.conversation.connectionId, channel: 'messenger', externalId: 'fixture-page' }, token: 'fixture-token' };
    });
    await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow('s-a schimbat');
    expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(mocks.graph).not.toHaveBeenCalled();
  });
  it.each(['externalParticipantId', 'connectionId', 'contactId'])('fails before provider invocation when queued %s changes', async field => {
    const f = await fixture(), result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
    await f.ref.update({ [field]: 'changed' }); await drainOutbound(db as any);
    expect(mocks.graph).not.toHaveBeenCalled();
    expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()).toMatchObject({ status: 'failed', budgetSettled: true });
  });
  it('does not send an old unpinned queued job or a job after access revocation', async () => {
    const first = await fixture(), result = await queueMessage(db as any, first.actor, first.ref.id, first.input);
    const jobRef = db.collection('communicationOutboundJobs').doc(result.messageId!);
    const job = (await jobRef.get()).data()!; delete job.recipientRevision; await jobRef.set(job);
    await drainOutbound(db as any);
    expect((await jobRef.get()).data()?.status).toBe('failed');
    const second = await fixture(), revoked = await queueMessage(db as any, second.actor, second.ref.id, second.input);
    await second.ref.update({ assigneeId: 'someone-else' }); await drainOutbound(db as any);
    expect((await db.collection('communicationOutboundJobs').doc(revoked.messageId!).get()).data()?.status).toBe('failed');
    expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('refuses preparation after the response window expires without queuing a message', async () => {
    const f = await fixture(); await f.ref.update({ lastInboundAt: '2020-01-01T00:00:00Z' });
    await expect(bindBusinessRevisions({ ...f.actor, adminDb: db } as any, f.actions)).rejects.toThrow('Fereastra');
    expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(mocks.graph).not.toHaveBeenCalled();
  });
  it.each(['expired', 'missing'])('refuses a %s quote in the queue and worker before provider invocation', async kind => {
    const f = await fixture();
    const expired = { ...f.input, sendApproval: kind === 'missing' ? undefined : { ...(f.input.sendApproval as any), expiresAt: 1 } };
    await expect(queueMessage(db as any, f.actor, f.ref.id, expired)).rejects.toThrow('valabilitatea');
    const result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
    const job = db.collection('communicationOutboundJobs').doc(result.messageId!);
    const saved = (await job.get()).data()!;
    if (kind === 'missing') delete saved.input.sendApproval; else saved.input.sendApproval.expiresAt = 1;
    await job.set(saved);
    await drainOutbound(db as any);
    expect((await job.get()).data()?.status).toBe('failed'); expect(mocks.graph).not.toHaveBeenCalled();
  });
  it('allows inbox-only updates and binds manual queue submissions too', async () => {
    const f = await fixture(); const manual = { text: 'Mesaj manual', requestId: randomUUID() };
    const result = await queueMessage(db as any, f.actor, f.ref.id, manual);
    await f.ref.update({ name: 'Updated name', status: 'waiting', version: 3 });
    await drainOutbound(db as any);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
    expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('accepted');
  });
  async function personalFixture() {
    const f = await fixture();
    const profileRef = db.collection('users').doc(f.actor.uid);
    const profile = { agencyId: f.actor.agencyId, role: 'agent', phone: '+40722123456' };
    const conversation = { ...f.conversation, channel: 'whatsapp', externalParticipantId: '40722123456', phone: '+40722123456' };
    await profileRef.set(profile); await f.ref.set(conversation);
    const rate = db.collection('communicationRates').doc(f.actor.uid);
    await rate.set({ category: 'service', prefix: '40', currency: 'EUR', amountMicros: 0, validFrom: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z' });
    mocks.token.mockReset();
    const token = async () => ({ connection: { id: conversation.connectionId, channel: 'whatsapp', externalId: 'fixture-number', appId: 'fixture-app', currency: 'EUR' }, token: 'fixture-token' });
    mocks.token.mockImplementation(token);
    mocks.graph.mockResolvedValue({ messages: [{ id: randomUUID() }] });
    const input = { text: 'Brief sintetic', requestId: randomUUID(), personalRecipient: personalRecipientProof(f.actor, conversation, profile) };
    return { ...f, profileRef, rate, token, input };
  }
  async function marketingFixture() {
    const f = await personalFixture();
    await f.ref.update({ lastInboundAt: '2020-01-01T00:00:00Z' });
    await f.rate.update({ category: 'marketing', amountMicros: 500000 });
    const agency = db.collection('agencies').doc(f.actor.agencyId);
    const budget = agency.collection('communicationBudgets').doc(new Date().toISOString().slice(0, 7) + '-EUR');
    await budget.set({ currency: 'EUR', limitMicros: 2000000, spentMicros: 0, reservedMicros: 0 });
    const consent = agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722123456', 'marketing'));
    await consent.set({ status: 'granted' });
    const token = async () => { const value = await f.token(); return { ...value, connection: { ...value.connection, parentId: '123456' } }; };
    mocks.token.mockImplementation(token);
    await agency.collection('channelConnections').doc(f.conversation.connectionId).set({ channel: 'whatsapp', status: 'connected', parentId: '123456', capabilities: { templates: { status: 'active' } } });
    const templates = { data: [{ name: 'colaborare', language: 'ro', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Bună ziua, {{1}}. Discutăm o colaborare?' }] }] };
    mocks.graph.mockImplementation(async (path: string) => path.includes('/message_templates?') ? templates : { messages: [{ id: randomUUID() }] });
    const actions = await bindBusinessRevisions({ ...f.actor, adminDb: db } as any, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: f.ref.id }, query: {}, body: { template: { name: 'colaborare', language: 'ro', parameters: ['Alin'] } } }]);
    const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
    return { ...f, token, consent, budget, templates, input: { ...action.body, requestId: randomUUID() } };
  }
  const templateSends = () => mocks.graph.mock.calls.filter(call => /\/messages$/.test(call[0]));
  for (const scenarioId of ['master-0281', 'master-0314', 'master-0315']) it.skipIf(process.env.JARVIS_WHATSAPP_PROSPECTING_LIVE !== 'true')(`live prospecting ${scenarioId}: reads the actual queued, accepted, delivered and read message without resending`, async () => {
    const dotenv = await import('dotenv'); dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const { chatTurn } = await import('../workspace');
    const { VERSIONS } = await import('../models');
    const { ingestMessage } = await import('@/lib/communications/server');
    const { normalizeWebhook } = await import('@/lib/communications/normalize');
    const { default: corpus } = await import('../../../../docs/jarvis/evals/master-scenarios.json');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const f = await marketingFixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    mocks.actor = { ...f.actor, adminDb: db, authorization: 'Bearer fixture' };
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const runs: Record<string, unknown>[] = [];
    let verified = false;
    try {
      const conversationId = stableId(f.conversation.connectionId, '40722123456');
      const conversation = agency.collection('conversations').doc(conversationId);
      await conversation.set({ ...(await f.ref.get()).data(), id: conversationId });
      const actions = await bindBusinessRevisions(mocks.actor, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId }, query: {}, body: { template: { name: 'colaborare', language: 'ro', parameters: ['Alin'] } } }]);
      const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
      const { executeAction } = await import('../actions');
      const queued = await executeAction(mocks.actor, action, randomUUID());
      expect(queued.conversationId).toBe(conversationId);
      const message = conversation.collection('messages').doc(queued.messageId!);
      const connection = { ...(await f.token()).connection, agencyId: f.actor.agencyId, id: f.conversation.connectionId } as any;
      const receipt = async (status: string) => {
        const externalId = (await message.get()).data()!.externalId;
        const events = normalizeWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: connection.externalId }, statuses: [{ id: externalId, recipient_id: '40722123456', timestamp: String(Math.floor(Date.now() / 1000)), status }] } }] }] });
        for (const event of events) await ingestMessage(db as any, connection, event);
      };
      for (const status of ['queued', 'accepted', 'delivered', 'read']) {
        if (status === 'accepted') await drainOutbound(db as any);
        if (status === 'delivered' || status === 'read') await receipt(status);
        expect((await message.get()).data()?.status).toBe(status);
        const sessionId = randomUUID(), session = agency.collection('assistantSessions').doc(sessionId);
        await session.set({ ownerId: f.actor.uid });
        await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', text: 'Mesajul WhatsApp selectat pentru verificare.', createdAt: new Date().toISOString(), cards: [{ type: 'data', source: 'autonomy', title: 'Rezultatele cererii', rows: [{ step: 1, kind: 'existing_operation', result: queued }] }] });
        const request = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
        const sendsBefore = templateSends().length;
        const result = await chatTurn(mocks.actor, request);
        const telemetry = (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data();
        runs.push({ status, final: result.message, telemetry });
        expect(result.message.planId, result.message.text).toBeUndefined();
        expect(result.message.cards?.flatMap(card => card.rows)).toEqual(expect.arrayContaining([expect.objectContaining({ id: message.id, status })]));
        expect(result.message.text.toLowerCase()).toContain(status);
        expect(telemetry?.status).toBe('success');
        expect(await chatTurn(mocks.actor, request)).toEqual(result);
        expect(templateSends()).toHaveLength(sendsBefore);
        expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get()).size).toBe(1);
      }
      await receipt('delivered');
      expect((await message.get()).data()?.status).toBe('read');
      await drainOutbound(db as any); expect(templateSends()).toHaveLength(1);
      verified = true;
    } finally {
      await mkdir('.tmp/jarvis-whatsapp-prospecting', { recursive: true });
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${scenarioId}-latest.json`, JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: verified, environment: 'Actual model, chat, API, queue, worker, receipt normalization and ingestion; local Firestore and simulated Meta, not production certification.', runs }, null, 2));
      await f.rate.delete(); mocks.actor = null;
    }
  }, 240000);
  it.each(['unknown', 'revoked', 'empty', 'pagination', 'provider-error'])('reads template catalog with real consent and API: %s', async variant => {
    const f = await marketingFixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    const ctx = { ...f.actor, adminDb: db, authorization: 'Bearer fixture' } as any;
    mocks.actor = ctx;
    try {
      const { checkWhatsAppTemplates } = await import('../whatsapp-template-check');
      if (variant === 'unknown') await f.consent.delete();
      if (variant === 'revoked') await agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722123456', 'all')).set({ status: 'revoked' });
      mocks.graph.mockReset();
      mocks.graph.mockImplementation(async (path: string) => {
        if (!path.includes('/message_templates?')) throw new Error('Sending excluded');
        if (variant === 'provider-error') throw new Error('Provider unavailable');
        if (variant !== 'pagination') return { data: [] };
        return path.includes('after=next-page') ? { data: [{ ...f.templates.data[0], name: 'pagina_doi' }] } : { ...f.templates, paging: { next: 'provider-next', cursors: { after: 'next-page' } } };
      });
      if (variant === 'provider-error') await expect(checkWhatsAppTemplates(ctx, f.ref.id)).rejects.toThrow();
      else {
        const result = await checkWhatsAppTemplates(ctx, f.ref.id);
        expect(result.sendAuthorized).toBe(false);
        if (variant === 'unknown' || variant === 'revoked') {
          expect(result.status).toBe(variant === 'unknown' ? 'consent_missing' : 'blocked');
          expect(mocks.graph).not.toHaveBeenCalled();
        } else {
          expect(result).toMatchObject({ status: 'checked', availableCount: variant === 'empty' ? 0 : 2 });
          expect(result.rows).toHaveLength(variant === 'empty' ? 0 : 2);
          expect(mocks.graph).toHaveBeenCalledTimes(variant === 'empty' ? 1 : 2);
        }
      }
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get()).empty).toBe(true);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); mocks.actor = null; }
  });
  for (const scenarioId of ['master-0277', 'master-0317']) it.skipIf(process.env.JARVIS_WHATSAPP_PROSPECTING_LIVE !== 'true')(`live prospecting ${scenarioId}: checks current templates after consent without sending`, async () => {
    const dotenv = await import('dotenv'); dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const { chatTurn } = await import('../workspace');
    const { VERSIONS } = await import('../models');
    const { default: corpus } = await import('../../../../docs/jarvis/evals/master-scenarios.json');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const f = await marketingFixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    mocks.actor = { ...f.actor, adminDb: db, authorization: 'Bearer fixture' };
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    let report: Record<string, unknown> = { scenarioId, prompt, versions: VERSIONS, executionVerified: false, environment: 'Actual model, chatTurn and template API; Firestore local and simulated Meta. No production certification.' };
    try {
      const templates = [
        ...f.templates.data,
        { name: 'in_asteptare', language: 'ro', category: 'MARKETING', status: 'PENDING', components: [{ type: 'BODY', text: 'Mesaj în așteptare' }] },
        { name: 'format_media', language: 'ro', category: 'UTILITY', status: 'APPROVED', components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Imagine' }] },
      ];
      mocks.graph.mockImplementation(async (path: string) => {
        if (!path.includes('/message_templates?')) throw new Error('No external sending allowed');
        return { data: templates };
      });
      const sessionId = randomUUID(), session = agency.collection('assistantSessions').doc(sessionId);
      await session.set({ ownerId: f.actor.uid });
      await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', text: 'Conversație WhatsApp selectată.', createdAt: new Date().toISOString(), cards: [{ type: 'data', source: 'conversations', title: 'WhatsApp', rows: [{ id: f.ref.id }] }] });
      const request = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
      const result = await chatTurn(mocks.actor, request);
      report = { ...report, final: result.message, telemetry: (await agency.collection('assistantTelemetry').doc(request.requestId).get()).data() };
      expect(result.message.planId, result.message.text).toBeUndefined();
      const rows = result.message.cards?.filter(card => card.source === 'whatsappTemplates').flatMap(card => card.rows);
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'colaborare', approvedAndSupported: true, bodyParameterCount: 1 }),
        expect.objectContaining({ name: 'in_asteptare', approvedAndSupported: false, status: 'PENDING' }),
        expect.objectContaining({ name: 'format_media', approvedAndSupported: false, supported: false }),
      ]));
      expect(result.message.text).toContain('colaborare');
      expect((await agency.collection('assistantTelemetry').doc(request.requestId).get()).data()?.status).toBe('success');
      const reads = mocks.graph.mock.calls.length;
      expect(await chatTurn(mocks.actor, request)).toEqual(result);
      expect(mocks.graph).toHaveBeenCalledTimes(reads);
      templates[0].status = 'PAUSED';
      const changed = await chatTurn(mocks.actor, { ...request, requestId: randomUUID() });
      report = { ...report, changed: changed.message };
      expect(changed.message.cards?.filter(card => card.source === 'whatsappTemplates').flatMap(card => card.rows)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'colaborare', status: 'PAUSED', approvedAndSupported: false })]));
      expect(changed.message.text).toMatch(/PAUSED|pauz|suspendat|indisponibil/i);
      expect((await f.consent.get()).data()).toEqual({ status: 'granted' });
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get()).empty).toBe(true);
      expect(templateSends()).toHaveLength(0);
      report = { ...report, executionVerified: true, verifiedAt: new Date().toISOString(), verification: 'Original request, current catalog through real API, approved/pending/unsupported distinction, fresh PAUSED state on next request, persisted replay, unchanged consent and zero outbound jobs/messages.' };
    } finally {
      await mkdir('.tmp/jarvis-whatsapp-prospecting', { recursive: true });
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${scenarioId}-latest.json`, JSON.stringify(report, null, 2));
      await f.rate.delete(); mocks.actor = null;
    }
  }, 240000);
  it.skipIf(process.env.JARVIS_WHATSAPP_PROSPECTING_LIVE !== 'true')('live prospecting master-0319: checks the current WhatsApp response window without sending', async () => {
    const dotenv = await import('dotenv'); dotenv.config({ path: '.env.local', quiet: true });
    const { chatTurn } = await import('../workspace'); const { VERSIONS } = await import('../models');
    const { default: corpus } = await import('../../../../docs/jarvis/evals/master-scenarios.json');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const scenarioId = 'master-0319', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const f = await marketingFixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    mocks.actor = { ...f.actor, adminDb: db, authorization: 'Bearer fixture' };
    const runs: unknown[] = []; let verified = false;
    try {
      for (const hours of [1, 25]) {
        await f.ref.update({ lastInboundAt: new Date(Date.now() - hours * 3600000).toISOString() });
        const sessionId = randomUUID(), session = agency.collection('assistantSessions').doc(sessionId); await session.set({ ownerId: f.actor.uid });
        await session.collection('messages').doc('selection').set({ id: 'selection', role: 'assistant', createdAt: new Date().toISOString(), text: 'WhatsApp selectat', cards: [{ type: 'data', source: 'conversations', title: 'WhatsApp', rows: [{ id: f.ref.id }] }] });
        const request = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
        const result = await chatTurn(mocks.actor, request);
        expect(result.message.cards?.flatMap(card => card.rows)).toEqual(expect.arrayContaining([expect.objectContaining({ withinWindow: hours === 1 })]));
        expect(result.message.text).toMatch(/24/);
        if (hours === 25) expect(result.message.text).toMatch(/afara|depăș|expirat/i);
        expect(result.message.planId).toBeUndefined(); expect(result.message.actions).toBeUndefined();
        expect(await chatTurn(mocks.actor, request)).toEqual(result);
        runs.push({ hours, final: result.message });
      }
      expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(templateSends()).toHaveLength(0); verified = true;
    } finally {
      await mkdir('.tmp/jarvis-whatsapp-prospecting', { recursive: true });
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${scenarioId}-latest.json`, JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: verified, environment: 'Real model and persisted chat, local Firestore; no sends or production certification.', runs }, null, 2));
      await f.rate.delete(); mocks.actor = null;
    }
  }, 240000);
  for (const scenarioId of ['master-0344', 'master-0345']) it.skipIf(process.env.JARVIS_WHATSAPP_PROSPECTING_LIVE !== 'true')(`live prospecting ${scenarioId}: verifies opt-out without sending and enforces it at queue and dispatch`, async () => {
    const dotenv = await import('dotenv'); dotenv.config({ path: '.env.local', quiet: true });
    const { chatTurn } = await import('../workspace'); const { VERSIONS } = await import('../models');
    const { default: corpus } = await import('../../../../docs/jarvis/evals/master-scenarios.json');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const f = await marketingFixture(), agency = db.collection('agencies').doc(f.actor.agencyId);
    mocks.actor = { ...f.actor, adminDb: db, authorization: 'Bearer fixture' };
    const global = agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722123456', 'all'));
    const runs: unknown[] = []; let verified = false;
    try {
      for (const state of ['global_revoked', 'marketing_revoked', 'unknown', 'granted']) {
        await global.delete();
        if (state === 'unknown') await f.consent.delete();
        else await f.consent.set({ status: state === 'marketing_revoked' ? 'revoked' : 'granted' });
        if (state === 'global_revoked') await global.set({ status: 'revoked' });
        const sessionId = randomUUID(), session = agency.collection('assistantSessions').doc(sessionId); await session.set({ ownerId: f.actor.uid });
        await session.collection('messages').doc('selection').set({ role: 'assistant', createdAt: new Date().toISOString(), text: 'WhatsApp selectat', cards: [{ type: 'data', source: 'conversations', title: 'Selectat', rows: [{ id: f.ref.id }] }] });
        const request = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
        const before = (await f.consent.get()).data();
        const result = await chatTurn(mocks.actor, request);
        const rows = result.message.cards?.flatMap(card => card.rows) || [];
        expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ consent: expect.objectContaining({ all: state === 'global_revoked' ? 'revoked' : 'unknown', marketing: state === 'unknown' ? 'unknown' : state === 'marketing_revoked' ? 'revoked' : 'granted' }) })]));
        expect(result.message.planId).toBeUndefined(); expect(result.message.actions).toBeUndefined();
        expect(await chatTurn(mocks.actor, request)).toEqual(result); expect((await f.consent.get()).data()).toEqual(before);
        expect((await f.ref.collection('messages').get()).empty).toBe(true); expect(templateSends()).toHaveLength(0);
        if (state !== 'granted') await expect(queueMessage(db as any, f.actor, f.ref.id, { ...f.input, requestId: randomUUID() })).rejects.toThrow();
        runs.push({ state, final: result.message });
      }
      const queued = await queueMessage(db as any, f.actor, f.ref.id, { ...f.input, requestId: randomUUID() });
      await global.set({ status: 'revoked' });
      await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(0); expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()?.status).toBe('failed');
      verified = true;
    } finally {
      await mkdir('.tmp/jarvis-whatsapp-prospecting', { recursive: true });
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${scenarioId}-latest.json`, JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: verified, environment: 'Real model and persisted chat, local Firestore, real queue and worker with simulated Meta; no external sends.', runs }, null, 2));
      await f.rate.delete(); mocks.actor = null;
    }
  }, 240000);
  async function prospectingFixture() {
    const f = await marketingFixture();
    await f.consent.delete();
    const agency = db.collection('agencies').doc(f.actor.agencyId);
    const request = { sessionId: randomUUID(), requestId: randomUUID(), prompt: 'Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp' };
    const session = agency.collection('assistantSessions').doc(request.sessionId);
    await session.set({ ownerId: f.actor.uid });
    await session.collection('messages').doc(`${request.requestId}-user`).set({ role: 'user', text: request.prompt });
    const listing = agency.collection('ownerListingFavorites').doc('selected-owner');
    await listing.set({ ownerPhone: '0722 123 456', title: 'Apartament Titan' });
    const ctx = { ...f.actor, adminDb: db, prospectingRequest: request } as any;
    const prepare = () => bindBusinessRevisions(ctx, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: f.ref.id }, query: {}, body: { template: { name: 'colaborare', language: 'ro', parameters: ['Alin'] }, prospectingListingId: listing.id } }]);
    return { ...f, agency, request, session, listing, ctx, prepare };
  }
  it.skipIf(process.env.JARVIS_WHATSAPP_PROSPECTING_LIVE !== 'true').each(['standard', 'shared-owner-long-titles', 'missing-phone', 'without-intermediaries', 'dedicated-template', 'revoked-owner', 'other-agent-owner', 'revoked-at-queue', 'without-preview', 'without-approval'])('live prospecting %s: actual model searches and executes eligible new-recipient templates in one chat turn', async variant => {
    const dotenv = await import('dotenv'); dotenv.config({ path: '.env.local', quiet: true });
    if (!process.env.OPENAI_API_KEY) throw new Error('Model credential unavailable');
    const { chatTurn } = await import('../workspace');
    const { mkdir, writeFile } = await import('node:fs/promises');
    const f = await prospectingFixture(), sources: string[] = [];
    mocks.actor = { ...f.ctx, authorization: 'Bearer fixture' };
    try {
      await f.agency.set({ city: 'București' });
      await f.agency.collection('channelConnections').doc(f.conversation.connectionId).set({ agencyId: f.actor.agencyId, channel: 'whatsapp', status: 'connected', name: 'WhatsApp agenție test', appId: 'fixture-app', parentId: '123456', externalId: 'fixture-number', currency: 'EUR', updatedAt: new Date().toISOString(), capabilities: { send: { status: 'active' }, templates: { status: 'active' } } });
      if (['dedicated-template', 'without-preview', 'without-approval'].includes(variant)) f.templates.data.splice(0, f.templates.data.length,
        { name: 'newsletter_oferte', language: 'ro', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Descoperă ofertele noi din newsletterul agenției.' }] },
        { name: 'prospectare_proprietari', language: 'ro', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: 'Bună ziua, {{1}}. Vă contactăm pentru o posibilă colaborare privind proprietatea dumneavoastră.' }] },
        { name: 'confirmare_vizionare', language: 'ro', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Confirmați participarea la vizionare.' }] });
      const variants = [{ price: '120000 EUR' }, { price: '125000 EUR' }, { price: '130000 EUR' }, { price: '130001 EUR' }, { price: '600 EUR', transactionType: 'rent' }, { location: 'București, Militari' }];
      for (const [index, patch] of variants.entries()) {
        const id = `${f.actor.agencyId}-offer-${index}`; sources.push(id);
        await db.collection('ownerListings').doc(id).set({ scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, location: 'București, Titan', propertyType: 'apartment', transactionType: 'sale', roomsValue: 2, price: '120000 EUR', title: `Apartament test ${index}`, ownerName: `Proprietar ${index}`, ownerPhone: `072233330${index}`, lastVerifiedAt: new Date().toISOString(), link: `https://example.test/${index}`, ...patch });
        if (variant === 'shared-owner-long-titles' && index < 3) await db.collection('ownerListings').doc(id).update({ title: `Apartament test ${index} ` + 'Titlu lung cu diacritice ȘȚĂÎÂ. '.repeat(300), ...(index === 2 ? { ownerName: 'Proprietar 0', ownerPhone: '+40 722 333 300' } : {}) });
        if (variant === 'missing-phone' && index === 2) await db.collection('ownerListings').doc(id).update({ ownerPhone: '', phoneExtractionStatus: 'unavailable' });
      }
      const prompt = variant === 'shared-owner-long-titles' ? f.request.prompt.replace('Găsește 3', 'Găsește doar 3') : variant === 'without-intermediaries' ? f.request.prompt.replace('apartamente', 'apartamente fără intermediari') : variant === 'without-preview' ? f.request.prompt + ' fără previzualizare și fără să îmi ceri confirmare' : variant === 'without-approval' ? 'Nu îmi mai cere aprobarea. ' + f.request.prompt : f.request.prompt;
      const blockedConsent = f.agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722333302', 'marketing'));
      if (variant === 'revoked-owner') await blockedConsent.set({ status: 'revoked' });
      if (variant === 'other-agent-owner') {
        const id = stableId(f.conversation.connectionId, '40722333302');
        await f.agency.collection('conversations').doc(id).set({ id, agencyId: f.actor.agencyId, channel: 'whatsapp', connectionId: f.conversation.connectionId, externalParticipantId: '40722333302', assigneeId: 'another-agent', collaboratorIds: [], name: 'Proprietar 2' });
      }
      const request = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
      const queueConsent = f.agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722333301', 'marketing'));
      let revokedAtQueue = false;
      if (variant === 'revoked-at-queue') mocks.graph.mockImplementation(async (path: string) => {
        if (path.includes('/message_templates?')) {
          const executions = await f.agency.collection('assistantExecutions').get();
          if (!revokedAtQueue && executions.docs.some(doc => doc.data().status === 'running' && doc.data().action?.params?.conversationId === stableId(f.conversation.connectionId, '40722333301'))) {
            await queueConsent.set({ status: 'revoked' }); revokedAtQueue = true;
          }
          return f.templates;
        }
        return { messages: [{ id: randomUUID() }] };
      });
      const result = await chatTurn(mocks.actor, request);
      await mkdir('.tmp/jarvis-whatsapp-prospecting', { recursive: true });
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${variant}-latest.json`, JSON.stringify({ variant, prompt: request.prompt, final: result.message, telemetry: (await f.agency.collection('assistantTelemetry').doc(request.requestId).get()).data(), environment: 'Actual model, real search/chat/preparation/API/queue/worker; Firestore emulator and simulated Meta' }, null, 2));
      expect(result.message.planId, result.message.text).toBeUndefined();
      const jobs = await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get();
      const expectedSends = ['standard', 'without-intermediaries', 'dedicated-template', 'without-preview', 'without-approval'].includes(variant) ? 3 : 2;
      expect(jobs.size, result.message.text).toBe(expectedSends);
      if (variant === 'revoked-at-queue') {
        expect(revokedAtQueue).toBe(true);
        expect(result.message.text).toContain('Mesaj nepus în coadă');
        expect(result.message.text).toContain('Acțiuni executate: 2.');
        expect((await f.agency.collection('assistantTelemetry').doc(request.requestId).get()).data()?.status).toBe('partial');
        expect((await queueConsent.get()).data()).toEqual({ status: 'revoked' });
        expect((await f.agency.collection('assistantExecutions').get()).docs.filter(doc => doc.data().status === 'rejected')).toHaveLength(1);
      }
      if (variant === 'missing-phone') {
        expect(result.message.text).toContain('Cerințe încă neîndeplinite');
        expect(result.message.text).toMatch(/telefon|număr/);
        expect((await f.agency.collection('assistantTelemetry').doc(request.requestId).get()).data()?.status).toBe('partial');
      }
      if (['revoked-owner', 'other-agent-owner'].includes(variant)) {
        expect(result.message.text).toContain('Cerințe încă neîndeplinite');
        expect(result.message.text).toMatch(variant === 'revoked-owner' ? /retras|refuz/ : /altui agent/);
        expect((await f.agency.collection('assistantTelemetry').doc(request.requestId).get()).data()?.status).toBe('partial');
        if (variant === 'revoked-owner') expect((await blockedConsent.get()).data()).toEqual({ status: 'revoked' });
        else expect((await f.agency.collection('conversations').doc(stableId(f.conversation.connectionId, '40722333302')).get()).data()?.assigneeId).toBe('another-agent');
      }
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(expectedSends);
      expect(templateSends().map(call => call[2].to).sort()).toEqual(variant === 'revoked-at-queue' ? ['40722333300', '40722333302'] : ['40722333300', '40722333301', '40722333302'].slice(0, expectedSends));
      if (['dedicated-template', 'without-preview', 'without-approval'].includes(variant)) {
        expect(templateSends().map(call => call[2].template.name)).toEqual(Array(3).fill('prospectare_proprietari'));
        expect(result.message.text).not.toMatch(/previzualiz|confirmă|aprobați|aprobă|verifică planul/i);
        expect(result.message.cards?.some(card => /preview|previzualiz/i.test(card.title))).toBeFalsy();
      }
      for (const job of jobs.docs) expect((await job.ref.get()).data()?.status).toBe('accepted');
      await chatTurn(mocks.actor, request); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(expectedSends);
      await writeFile(`.tmp/jarvis-whatsapp-prospecting/${variant}-verified.json`, JSON.stringify({ variant, prompt: request.prompt, verifiedAt: new Date().toISOString(), sends: expectedSends, replaySends: 0, realProvider: false, newConversations: true, priceBoundaryIncluded: true, rentalsExcluded: true }, null, 2));
    } finally { for (const id of sources) await db.collection('ownerListings').doc(id).delete(); await f.rate.delete(); mocks.actor = null; }
  }, 240000);
  it('recovers an invalid template connection through the real authorized catalog without sending', async () => {
    const f = await prospectingFixture(); mocks.actor = f.ctx;
    try {
      const { dispatchTool } = await import('../tool-dispatch');
      const result = await dispatchTool('existing_read', f.ctx, { operation: 'whatsapp_templates', params: { connectionId: 'missing-reference' }, query: {}, body: {} }, f.request.prompt, {});
      expect(result.data.resolvedConnectionId).toBe(f.conversation.connectionId);
      expect(result.data.data).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'colaborare' })]));
      expect(result.actions).toEqual([]);
      expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get()).empty).toBe(true);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); mocks.actor = null; }
  });
  it('continues past a recipient revoked after preparation and replays the rejected execution without new jobs', async () => {
    const f = await prospectingFixture(); mocks.actor = f.ctx;
    try {
      const { executeSafePrefix } = await import('../autonomy');
      const { executionConfirmation } = await import('../execution-confirmation');
      await f.agency.collection('channelConnections').doc(f.conversation.connectionId).set({ channel: 'whatsapp', status: 'connected' });
      for (const [index, id] of ['first', 'middle', 'last'].entries()) await f.agency.collection('ownerListingFavorites').doc(id).set({ ownerName: `Proprietar ${index}`, ownerPhone: `072255550${index}` });
      const proposed = ['first', 'middle', 'last'].map(id => ({ kind: 'existing_operation' as const, operation: 'message_send' as const, params: {}, query: {}, body: { prospectingListingId: id, prospectingConnectionId: f.conversation.connectionId, template: { name: 'colaborare', language: 'ro', parameters: ['Proprietar'] } } }));
      const actions = await bindBusinessRevisions(f.ctx, proposed);
      const consent = f.agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722555501', 'marketing'));
      await consent.set({ status: 'revoked' });
      const requestId = randomUUID();
      const executed = await executeSafePrefix(f.ctx, requestId, actions, f.request.prompt);
      expect(executed.blocked).toBe(false); expect(executed.actions).toEqual([]); expect(executed.results).toHaveLength(3);
      expect(executed.results[1].result).toMatchObject({ executionState: 'failed', queueOutcome: 'not_queued' });
      expect(executionConfirmation(executed.results)).toContain('Mesaj nepus în coadă');
      expect((await f.agency.collection('assistantExecutions').get()).docs.map(doc => doc.data().status).sort()).toEqual(['completed', 'completed', 'rejected']);
      const replay = await executeSafePrefix(f.ctx, requestId, actions, f.request.prompt);
      expect(replay.results).toEqual(executed.results);
      expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', f.actor.agencyId).get()).size).toBe(2);
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends().map(call => call[2].to).sort()).toEqual(['40722555500', '40722555502']);
      expect((await consent.get()).data()).toEqual({ status: 'revoked' });
    } finally { await f.rate.delete(); mocks.actor = null; }
  });
  it('creates three owner conversations, records consent and sends all templates without preexisting contacts', async () => {
    const f = await prospectingFixture();
    try {
      await f.agency.collection('channelConnections').doc(f.conversation.connectionId).set({ channel: 'whatsapp', status: 'connected' });
      const listings = ['first', 'second', 'third', 'same-owner'];
      for (const [index, id] of listings.entries()) await f.agency.collection('ownerListingFavorites').doc(id).set({ ownerName: `Proprietar ${index}`, ownerPhone: index === 3 ? '0722111100' : `072211110${index}` });
      const proposed = listings.map(id => ({ kind: 'existing_operation' as const, operation: 'message_send' as const, params: {}, query: {}, body: { prospectingListingId: id, prospectingConnectionId: f.conversation.connectionId, template: { name: 'colaborare', language: 'ro', parameters: ['Proprietar'] } } }));
      const actions = await bindBusinessRevisions(f.ctx, proposed);
      expect(actions).toHaveLength(3);
      expect((await f.agency.collection('contacts').get()).empty).toBe(true);
      for (const [index, action] of actions.entries()) {
        if (action.kind !== 'existing_operation') throw new Error('Wrong action');
        const conversation = await f.agency.collection('conversations').doc(action.params.conversationId).get();
        expect(conversation.data()).toMatchObject({ phone: `4072211110${index}`, contactId: null, assigneeId: f.actor.uid });
        await queueMessage(db as any, f.actor, conversation.id, { ...action.body, requestId: randomUUID() });
      }
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(3);
      expect(new Set(templateSends().map(call => call[2].to)).size).toBe(3);
      const repeated = await bindBusinessRevisions(f.ctx, proposed);
      expect(repeated.map(action => action.kind === 'existing_operation' && action.params.conversationId)).toEqual(actions.map(action => action.kind === 'existing_operation' && action.params.conversationId));
    } finally { await f.rate.delete(); }
  });
  it.each(['overlap', 'revoked-omitted-from-model-coverage'])('sends each eligible recipient once across batches: %s', async variant => {
    const f = await prospectingFixture();
    mocks.actor = f.ctx;
    try {
      const { planTurn } = await import('../planner');
      const { executeSafePrefix } = await import('../autonomy');
      await f.agency.collection('channelConnections').doc(f.conversation.connectionId).set({ channel: 'whatsapp', status: 'connected' });
      for (const [index, id] of ['first', 'second', 'blocked'].entries()) await f.agency.collection('ownerListingFavorites').doc(id).set({ ownerName: `Proprietar ${index}`, ownerPhone: `072244440${index}` });
      if (variant !== 'overlap') await f.agency.collection('communicationConsents').doc(stableId(f.conversation.connectionId, '40722444402', 'marketing')).set({ status: 'revoked' });
      const action = (listingId: string) => ({ kind: 'existing_operation', operation: 'message_send', params: {}, query: {}, body: { prospectingListingId: listingId, prospectingConnectionId: f.conversation.connectionId, template: { name: 'colaborare', language: 'ro', parameters: ['Proprietar'] } } });
      const calls = [
        { name: 'propose_actions', payload: { actions: [action('first')] } },
        { name: 'propose_actions', payload: { actions: [action('first'), ...(variant !== 'overlap' ? [action('blocked')] : []), action('second')] } },
        { name: 'goal_coverage', payload: { requirements: [{ id: 'send', sourceQuote: 'contactează proprietarii pe whatsapp', description: 'Contactare proprietari', resolution: 'planned', steps: [1, 2], evidenceCallIds: [] }] } },
      ];
      let index = 0;
      const provider = { id: 'scripted-overlapping-proposals', respond: vi.fn(async (_request: unknown) => {
        const next = calls[index++], id = `call-${index}`;
        const call = next ? { id, name: next.name, arguments: JSON.stringify(next.name === 'propose_actions' ? { payload: JSON.stringify(next.payload) } : next.payload) } : null;
        return { calls: call ? [call] : [], items: call ? [{ type: 'function_call', call_id: id, name: call.name, arguments: call.arguments }] : [], text: call ? '' : 'Mesaje pregătite.', intentStatus: 'answer' as const, status: 'completed', latencyMs: 1, usage: { inputTokens: 100, outputTokens: 30, cachedTokens: 0, cacheWriteTokens: 0, estimated: false } };
      }) };
      const planned = await planTurn(f.ctx, f.request.prompt, [], { provider });
      expect(planned.metrics.status).toBe(variant === 'overlap' ? 'success' : 'clarification');
      if (variant !== 'overlap') {
        expect(planned.goalCoverage?.requirements).toEqual(expect.arrayContaining([expect.objectContaining({ resolution: 'needs_clarification', description: expect.stringContaining('blocked') })]));
        const { canExecutePreparedProspecting } = await import('../prospecting-plan');
        expect(canExecutePreparedProspecting(f.request.prompt, planned.metrics.status, planned.actions, planned.goalCoverage)).toBe(true);
      }
      expect(planned.actions).toHaveLength(2);
      const executed = await executeSafePrefix(f.ctx, randomUUID(), planned.actions, f.request.prompt);
      expect(executed.blocked).toBe(false); expect(executed.results).toHaveLength(2);
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends().map(call => call[2].to).sort()).toEqual(['40722444400', '40722444401']);
    } finally { await f.rate.delete(); mocks.actor = null; }
  });
  it.each(['missing-phone', 'disconnected', 'other-agent', 'revoked', 'not-requested'])('does not create or take over a prospecting conversation: %s', async change => {
    const f = await prospectingFixture();
    try {
      const connectionId = f.conversation.connectionId;
      await f.agency.collection('channelConnections').doc(connectionId).set({ channel: 'whatsapp', status: change === 'disconnected' ? 'disconnected' : 'connected' });
      if (change === 'missing-phone') await f.listing.update({ ownerPhone: '' });
      if (change === 'not-requested') f.ctx.prospectingRequest.prompt = 'Caută apartamente în Titan';
      const id = stableId(connectionId, '40722123456');
      if (change === 'other-agent') await f.agency.collection('conversations').doc(id).set({ ...f.conversation, id, channel: 'whatsapp', externalParticipantId: '40722123456', assigneeId: 'other', collaboratorIds: [] });
      if (change === 'revoked') await f.consent.set({ status: 'revoked' });
      await expect(bindBusinessRevisions(f.ctx, [{ kind: 'existing_operation', operation: 'message_send', params: {}, query: {}, body: { prospectingListingId: f.listing.id, prospectingConnectionId: connectionId, template: { name: 'colaborare', language: 'ro', parameters: ['Alin'] } } }])).rejects.toThrow();
      if (change !== 'other-agent') expect((await f.agency.collection('conversations').doc(id).get()).exists).toBe(false);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); }
  });
  it('records an agent request attestation and dispatches the template once without an Inbox consent step', async () => {
    const f = await prospectingFixture();
    try {
      const actions = await f.prepare(), action = actions[0];
      if (action.kind !== 'existing_operation') throw new Error('Wrong action');
      expect((await f.consent.get()).data()).toMatchObject({ status: 'granted', purpose: 'marketing', source: 'agent_request_prior_phone_consent', recordedBy: f.actor.uid, evidence: f.request.prompt, ownerListingId: f.listing.id });
      expect(action.body.prospectingConsentReceiptId).toEqual(expect.any(String));
      expect(templateSends()).toHaveLength(0);
      await f.prepare();
      expect((await f.consent.collection('history').get()).size).toBe(1);
      const input = { ...action.body, requestId: randomUUID() };
      const queued = await queueMessage(db as any, f.actor, f.ref.id, input);
      await queueMessage(db as any, f.actor, f.ref.id, input);
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(1);
      expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()?.status).toBe('accepted');
    } finally { await f.rate.delete(); }
  });
  it.each(['revoked', 'global', 'phone', 'request', 'actor', 'preview'])('rejects prospecting consent when %s is invalid', async change => {
    const f = await prospectingFixture();
    try {
      if (change === 'revoked' || change === 'global') await revokeMarketing(f, change);
      if (change === 'phone') await f.listing.update({ ownerPhone: '0722999999' });
      if (change === 'request') await f.session.collection('messages').doc(`${f.request.requestId}-user`).update({ text: 'Caută oferte' });
      if (change === 'actor') await f.session.update({ ownerId: 'another-agent' });
      if (change === 'preview') f.ctx.prospectingRequest = { ...f.request, prompt: 'Pregătește un mesaj, nu trimite proprietarilor pe WhatsApp' };
      await expect(f.prepare()).rejects.toThrow();
      expect((await f.consent.get()).data()?.status).not.toBe('granted');
      expect((await f.consent.collection('history').get()).empty).toBe(true);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); }
  });
  it('honors a withdrawal after the agent attestation and does not restore it on replay', async () => {
    const f = await prospectingFixture();
    try {
      const action = (await f.prepare())[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
      const queued = await queueMessage(db as any, f.actor, f.ref.id, { ...action.body, requestId: randomUUID() });
      await revokeMarketing(f, 'revoked');
      await expect(f.prepare()).rejects.toThrow('retras');
      await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(0);
      expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()?.status).toBe('failed');
      expect((await f.budget.get()).data()?.reservedMicros).toBe(0);
    } finally { await f.rate.delete(); }
  });
  it('accepts a ready canonical owner listing without requiring it to be saved as a prospect', async () => {
    const f = await prospectingFixture(), source = db.collection('ownerListings').doc(randomUUID());
    try {
      await source.set({ publicationStatus: 'ready', isCanonical: true, ownerPhone: '+40 722 123 456', title: 'Apartament Titan' });
      const prepare = () => bindBusinessRevisions(f.ctx, [{ kind: 'existing_operation', operation: 'message_send', params: { conversationId: f.ref.id }, query: {}, body: { template: { name: 'colaborare', language: 'ro', parameters: ['Alin'] }, prospectingListingId: source.id } }]);
      const action = (await prepare())[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
      expect((await f.consent.get()).data()?.ownerListingId).toBe(source.id);
      await source.update({ publicationStatus: 'pending' });
      await expect(prepare()).rejects.toThrow('disponibil');
      expect(templateSends()).toHaveLength(0);
    } finally { await source.delete(); await f.rate.delete(); }
  });
  it('rechecks access inside the consent transaction and preserves prior consent evidence', async () => {
    const f = await prospectingFixture(), original = db.runTransaction.bind(db);
    try {
      await f.consent.set({ status: 'granted', source: 'manual-evidence', evidence: 'Original telephone record' });
      await f.prepare();
      expect((await f.consent.get()).data()?.source).toBe('manual-evidence');
      const transaction = vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback: any) => {
        await f.ref.update({ assigneeId: 'another-agent', collaboratorIds: [] });
        return original(callback);
      });
      try { await expect(f.prepare()).rejects.toThrow('accesul'); }
      finally { transaction.mockRestore(); }
      expect((await f.consent.collection('history').get()).size).toBe(1);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); }
  });
  it.each(['assigned', 'phone', 'inactive'])('rejects prospect changes inside the queue transaction: %s', async change => {
    const f = await prospectingFixture();
    const [action] = await f.prepare();
    if (action.kind !== 'existing_operation') throw new Error('Expected message');
    expect(action.body.prospectingListingId).toBe(f.listing.id);
    const original = db.runTransaction.bind(db);
    const transaction = vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback: any) => {
      await f.listing.update(change === 'assigned' ? { takenByAgentId: 'another-agent' } : change === 'phone' ? { ownerPhone: '0722999999' } : { isFavoriteActive: false });
      return original(callback);
    });
    try {
      await expect(queueMessage(db as any, f.actor, f.ref.id, { ...action.body, requestId: randomUUID() })).rejects.toThrow(/Prospectul|Telefonul/);
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await f.budget.get()).data()?.reservedMicros).toBe(0);
      expect(templateSends()).toHaveLength(0);
    } finally { transaction.mockRestore(); await f.rate.delete(); }
  });
  it.each(['assigned', 'phone', 'inactive', 'during-estimate'])('rechecks prospect state after queueing without sending or billing: %s', async change => {
    const f = await prospectingFixture();
    try {
      const [action] = await f.prepare();
      if (action.kind !== 'existing_operation') throw new Error('Expected message');
      const queued = await queueMessage(db as any, f.actor, f.ref.id, { ...action.body, requestId: randomUUID() });
      const job = db.collection('communicationOutboundJobs').doc(queued.messageId!);
      expect((await job.get()).data()?.input.prospectingListingId).toBe(f.listing.id);
      if (change === 'during-estimate') mocks.token.mockImplementationOnce(async () => { await f.listing.update({ takenByAgentId: 'another-agent' }); return f.token(); });
      else await f.listing.update(change === 'assigned' ? { takenByAgentId: 'another-agent' } : change === 'phone' ? { ownerPhone: '0722999999' } : { isFavoriteActive: false });
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(0);
      expect((await job.get()).data()).toMatchObject({ status: 'failed', budgetSettled: true });
      expect((await f.budget.get()).data()).toMatchObject({ reservedMicros: 0, spentMicros: 0 });
    } finally { await f.rate.delete(); }
  });
  it.each(['own', 'unassigned', 'expired', 'admin'])('sends once with a currently eligible prospect: %s', async mode => {
    const f = await prospectingFixture();
    try {
      if (mode === 'own') await f.listing.update({ takenByAgentId: f.actor.uid });
      if (mode === 'expired') await f.listing.update({ reservedByAgentId: 'former-agent', reservedAt: '2020-01-01T00:00:00Z' });
      if (mode === 'admin') {
        f.actor.role = 'admin'; f.ctx.role = 'admin';
        await db.collection('users').doc(f.actor.uid).update({ role: 'admin' });
        await f.listing.update({ takenByAgentId: 'another-agent' });
      }
      const [action] = await f.prepare();
      if (action.kind !== 'existing_operation') throw new Error('Expected message');
      const queued = await queueMessage(db as any, f.actor, f.ref.id, { ...action.body, requestId: randomUUID() });
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(1);
      expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()?.status).toBe('accepted');
    } finally { await f.rate.delete(); }
  });
  it('checks the persisted prospect link for Inbox messages even when no prospect ID is supplied', async () => {
    const f = await marketingFixture();
    try {
      await f.ref.update({ ownerListingId: 'linked-prospect' });
      await db.collection('agencies').doc(f.actor.agencyId).collection('ownerListingFavorites').doc('linked-prospect').set({ ownerPhone: '0722123456', takenByAgentId: 'another-agent' });
      await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow('altui agent');
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect(templateSends()).toHaveLength(0);
    } finally { await f.rate.delete(); }
  });
  async function revokeMarketing(f: Awaited<ReturnType<typeof marketingFixture>>, change: string) {
    if (change === 'deleted') return f.consent.delete();
    if (change === 'global') return withdrawEligibility(f, 'all');
    return f.consent.set({ status: 'revoked' });
  }
  it.each(['revoked', 'deleted', 'global'])('does not queue an approved marketing template after late consent %s', async change => {
    const f = await marketingFixture(), original = db.runTransaction.bind(db);
    const transaction = vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback: any) => { await revokeMarketing(f, change); return original(callback); });
    try {
      await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow(/consimțământ|retras|oprirea/);
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await f.budget.get()).data()?.reservedMicros).toBe(0);
      expect(templateSends()).toHaveLength(0);
    } finally { transaction.mockRestore(); await f.rate.delete(); }
  });
  it.each(['revoked', 'deleted', 'global'])('releases marketing reservation without dispatch after late consent %s', async change => {
    const f = await marketingFixture();
    try {
      const queued = await queueMessage(db as any, f.actor, f.ref.id, f.input);
      expect((await f.budget.get()).data()?.reservedMicros).toBe(500000);
      mocks.token.mockImplementationOnce(f.token).mockImplementationOnce(async () => { await revokeMarketing(f, change); return f.token(); });
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(0);
      expect((await f.budget.get()).data()).toMatchObject({ reservedMicros: 0, spentMicros: 0 });
      expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()).toMatchObject({ status: 'failed', budgetSettled: true });
    } finally { await f.rate.delete(); }
  });
  it.each(['consent', 'recipient'])('rechecks %s after template retrieval before returning a fresh preview', async change => {
    const f = await marketingFixture();
    mocks.graph.mockImplementationOnce(async () => {
      if (change === 'consent') await revokeMarketing(f, 'global');
      else await f.ref.update({ externalParticipantId: '40722999999' });
      return f.templates;
    });
    try {
      await expect(queueMessage(db as any, f.actor, f.ref.id, f.input, true)).rejects.toThrow(change === 'consent' ? 'oprirea' : 'Destinatarul');
      expect(templateSends()).toHaveLength(0);
      expect((await f.budget.get()).data()?.reservedMicros).toBe(0);
    } finally { await f.rate.delete(); }
  });
  it('dispatches an eligible approved marketing template once and keeps cost reserved until receipt', async () => {
    const f = await marketingFixture();
    try {
      const queued = await queueMessage(db as any, f.actor, f.ref.id, f.input);
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(templateSends()).toHaveLength(1);
      expect(templateSends()[0][2]).toMatchObject({ type: 'template', to: '40722123456', template: { name: 'colaborare', language: { code: 'ro' } } });
      expect((await f.budget.get()).data()).toMatchObject({ reservedMicros: 500000, spentMicros: 0 });
      expect((await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data()?.status).toBe('accepted');
    } finally { await f.rate.delete(); }
  });
  async function withdrawEligibility(f: Pick<Awaited<ReturnType<typeof personalFixture>>, 'actor' | 'conversation' | 'ref'>, change: string) {
    if (change === 'window') return f.ref.update({ lastInboundAt: '2020-01-01T00:00:00Z' });
    return db.collection('agencies').doc(f.actor.agencyId).collection('communicationConsents')
      .doc(stableId(f.conversation.connectionId, '40722123456', change)).set({ status: 'revoked' });
  }
  it.each(['all', 'service', 'window'])('rejects late eligibility change %s inside the queue transaction', async change => {
    const f = await personalFixture();
    const original = db.runTransaction.bind(db);
    const transaction = vi.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback: any) => {
      await withdrawEligibility(f, change); return original(callback);
    });
    try {
      await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow(/oprirea|retras|expirat/);
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await db.collection('communicationOutboundJobs').where('uid', '==', f.actor.uid).get()).empty).toBe(true);
      expect(mocks.graph).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); await f.rate.delete(); }
  });
  it.each(['all', 'service', 'window'])('stops dispatch when eligibility changes after estimate: %s', async change => {
    const f = await personalFixture();
    try {
      const queued = await queueMessage(db as any, f.actor, f.ref.id, f.input);
      mocks.token.mockImplementationOnce(f.token).mockImplementationOnce(async () => { await withdrawEligibility(f, change); return f.token(); });
      await drainOutbound(db as any);
      expect(mocks.graph).not.toHaveBeenCalled();
      const job = (await db.collection('communicationOutboundJobs').doc(queued.messageId!).get()).data();
      expect(job).toMatchObject({ status: 'failed', budgetSettled: true });
      expect(job?.error).toMatch(/oprirea|retras|expirat/);
      expect((await f.ref.collection('messages').doc(queued.messageId!).get()).data()?.status).toBe('failed');
      await drainOutbound(db as any); expect(mocks.graph).not.toHaveBeenCalled();
    } finally { await f.rate.delete(); }
  });
  it.each(['phone', 'role', 'destination'])('refuses a changed personal %s in the queue transaction', async change => {
    const f = await personalFixture();
    mocks.token.mockImplementationOnce(async () => {
      if (change === 'phone') await f.profileRef.update({ phone: '+40722999999' });
      if (change === 'role') await f.profileRef.update({ role: 'admin' });
      if (change === 'destination') await f.ref.update({ externalParticipantId: '40722999999' });
      return f.token();
    });
    try {
      await expect(queueMessage(db as any, f.actor, f.ref.id, f.input)).rejects.toThrow();
      expect((await f.ref.collection('messages').get()).empty).toBe(true);
      expect((await db.collection('communicationOutboundJobs').where('uid', '==', f.actor.uid).get()).empty).toBe(true);
      expect(mocks.graph).not.toHaveBeenCalled();
    } finally { await f.rate.delete(); }
  });
  it.each(['phone', 'role', 'during-estimate'])('stops personal delivery after queueing: %s', async change => {
    const f = await personalFixture();
    try {
      const result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
      if (change === 'phone') await f.profileRef.update({ phone: '+40722999999' });
      if (change === 'role') await f.profileRef.update({ role: 'admin' });
      if (change === 'during-estimate') mocks.token.mockImplementationOnce(async () => { await f.profileRef.update({ phone: '+40722999999' }); return f.token(); });
      await drainOutbound(db as any);
      expect(mocks.graph).not.toHaveBeenCalled();
      expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()?.status).toBe('failed');
      expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('failed');
      await drainOutbound(db as any); expect(mocks.graph).not.toHaveBeenCalled();
    } finally { await f.rate.delete(); }
  });
  it('sends an unchanged personal recipient once through the normal queue and worker', async () => {
    const f = await personalFixture();
    try {
      const result = await queueMessage(db as any, f.actor, f.ref.id, f.input);
      expect((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()?.input.personalRecipient).toEqual(f.input.personalRecipient);
      await drainOutbound(db as any); await drainOutbound(db as any);
      expect(mocks.graph, String((await db.collection('communicationOutboundJobs').doc(result.messageId!).get()).data()?.error || '')).toHaveBeenCalledTimes(1);
      expect(mocks.graph.mock.calls[0][2]).toMatchObject({ to: '40722123456' });
      expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('accepted');
    } finally { await f.rate.delete(); }
  });
});
