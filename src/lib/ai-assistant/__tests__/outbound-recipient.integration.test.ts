import { randomUUID } from 'node:crypto';
import { personalRecipientProof } from '@/lib/communications/personal-recipient';
vi.mock('@/lib/communications/whatsapp-config', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/communications/whatsapp-config')>(), assertWhatsAppAccess: () => {}, whatsappAppId: () => 'fixture-app' }));
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ token: vi.fn(), graph: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/meta', () => ({ connectionToken: mocks.token, graph: mocks.graph, MetaGraphError: class extends Error { providerStatus = 500; } }));
import { queueMessage, drainOutbound } from '@/lib/communications/outbound';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { bindBusinessRevisions } from '../business-revisions';
import { approvalEnvelope, validateApproval } from '../approval';
import { matchContact } from '../actions';
import { saveResultSet } from '../context';
import { resolveMatchingRecipient } from '../matching-recipient';
import { matchingRevision } from '../matching-revision';

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
