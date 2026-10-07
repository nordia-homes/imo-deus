import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ token: vi.fn(), graph: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/meta', () => ({ connectionToken: mocks.token, graph: mocks.graph, MetaGraphError: class extends Error { providerStatus = 500; } }));
import { queueMessage, drainOutbound } from '@/lib/communications/outbound';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { bindBusinessRevisions } from '../business-revisions';
import { approvalEnvelope, validateApproval } from '../approval';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('approved recipient through the real outbound queue and worker', () => {
  let db: Firestore;
  const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-outbound-recipient' });
  });
  beforeEach(() => {
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
    const input = { ...action.body, requestId: randomUUID() };
    return { actor, conversation, ref, input, actions, envelope };
  }
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
  it('rejects stale recipient approval before estimating or creating a job', async () => {
    const f = await fixture(); await f.ref.update({ externalParticipantId: 'changed' });
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
  it('allows inbox-only updates and binds manual queue submissions too', async () => {
    const f = await fixture(); const manual = { text: 'Mesaj manual', requestId: randomUUID() };
    const result = await queueMessage(db as any, f.actor, f.ref.id, manual);
    await f.ref.update({ name: 'Updated name', status: 'waiting', version: 3 });
    await drainOutbound(db as any);
    expect(mocks.graph).toHaveBeenCalledTimes(1);
    expect((await f.ref.collection('messages').doc(result.messageId!).get()).data()?.status).toBe('accepted');
  });
});
