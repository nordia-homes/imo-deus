import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/whatsapp-config', () => ({ assertWhatsAppAccess: () => {}, whatsappAppId: () => 'fixture-app' }));
const mocks = vi.hoisted(() => ({ graph: vi.fn(), token: vi.fn() }));
vi.mock('@/lib/communications/meta', () => ({ graph: mocks.graph, connectionToken: mocks.token, MetaGraphError: class extends Error {} }));
import { queueMessage, drainOutbound } from '@/lib/communications/outbound';
import { ingestMessage } from '@/lib/communications/server';
import { normalizeWebhook } from '@/lib/communications/normalize';
import { drainViewingReplies } from '@/lib/communications/viewing-confirmation';
import { stableId } from '@/lib/communications/crypto';
import { viewingAttendance } from '../viewing-attendance';
import { resolveDatetime } from '../datetime';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { executeAction } from '../actions';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('viewing confirmations through WhatsApp queue and inbound worker', () => {
  let db: Firestore;
  const agencies: string[] = [];
  beforeAll(() => {
    vi.stubEnv('META_TOKEN_ENCRYPTION_KEY', 'synthetic-viewing-key');
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-viewing-whatsapp' });
    mocks.graph.mockImplementation(async (path: string) => path.includes('message_templates') ? { data: [{ name: 'viewing_confirm', language: 'ro', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Confirmați vizionarea {{1}}, {{2}}, ora {{3}}, București.' }] }] } : { messages: [{ id: randomUUID() }] });
  });
  afterAll(async () => {
    if (!db) return;
    for (const id of agencies) { await db.recursiveDelete(db.collection('agencies').doc(id)); await db.collection('users').doc(id).delete(); }
    for (const name of ['communicationOutboundJobs', 'communicationMessageMappings', 'communicationSearchJobs', 'communicationViewingReplies', 'communicationRates']) for (const doc of (await db.collection(name).get()).docs) await doc.ref.delete();
    await db.terminate();
    vi.unstubAllEnvs();
  });
  async function fixture() {
    const id = randomUUID(); agencies.push(id);
    const root = db.collection('agencies').doc(id), actor = { agencyId: id, uid: id, role: 'agent' }, ctx = { ...actor, adminDb: db } as any;
    const connection = { id: randomUUID(), agencyId: id, channel: 'whatsapp' as const, externalId: '12345', appId: 'fixture-app', name: 'Test', status: 'connected' as const, capabilities: {}, updatedAt: new Date().toISOString(), parentId: '123', currency: 'EUR' };
    mocks.token.mockResolvedValue({ connection, token: 'fixture-token' });
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    await root.collection('contacts').doc('c').set({ name: 'Alin', phone: '+40700000001' });
    await root.collection('properties').doc('p').set({ title: 'Cișmigiu', status: 'Activ', ownerName: 'Ștefan', ownerPhone: '+40700000002' });
    const viewingDate = resolveDatetime({ dayOffset: 1, time: '18:00' }).iso;
    await root.collection('viewings').doc('v').set({ contactId: 'c', propertyId: 'p', agentId: id, status: 'scheduled', viewingDate, duration: 60 });
    await db.collection('communicationRates').doc(id).set({ category: 'utility', prefix: '40', currency: 'EUR', amountMicros: 0, validFrom: '2020-01-01', validUntil: '2099-01-01' });
    const local = bucharestInputFromIso(viewingDate), [year, month, day] = local.date.split('-');
    async function send(participant: 'client' | 'owner', viewingId = 'v') {
      const phone = participant === 'client' ? '40700000001' : '40700000002', conversationId = stableId(connection.id, phone);
      await root.collection('conversations').doc(conversationId).set({ id: conversationId, agencyId: id, connectionId: connection.id, channel: 'whatsapp', externalParticipantId: phone, assigneeId: id, collaboratorIds: [], version: 1, lastInboundAt: null });
      await root.collection('communicationConsents').doc(stableId(connection.id, phone, 'service')).set({ status: 'granted' });
      const sent = await queueMessage(db as any, actor, conversationId, { requestId: randomUUID(), template: { name: 'viewing_confirm', language: 'ro', parameters: ['Cișmigiu', `${day}.${month}.${year}`, local.time] }, viewingConfirmation: { viewingId, participant } });
      if (!sent.messageId) throw new Error('Missing queued message');
      await drainOutbound(db as any);
      const saved = (await root.collection('conversations').doc(conversationId).collection('messages').doc(sent.messageId).get()).data()!;
      expect(saved.status, saved.error).toBe('accepted'); expect(saved.viewingConfirmation.participant).toBe(participant);
      return { phone, externalId: saved.externalId as string, conversationId, sent };
    }
    async function reply(target: Awaited<ReturnType<typeof send>>, text: string, extra: Record<string, any> = {}) {
      const raw = { id: randomUUID(), from: target.phone, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text }, context: { id: target.externalId }, ...extra };
      const event = normalizeWebhook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: connection.externalId }, messages: [raw] } }] }] })[0];
      await ingestMessage(db as any, connection, event);
      return event;
    }
    return { root, actor, ctx, connection, send, reply };
  }
  it('confirms each participant only from a correlated reply and processes duplicate delivery once', async () => {
    const f = await fixture(), client = await f.send('client'), owner = await f.send('owner');
    expect((await viewingAttendance(f.ctx, { dayOffset: 1 })).count).toBe(1);
    const event = await f.reply(client, 'Da, confirm!');
    await ingestMessage(db as any, f.connection, event);
    await drainViewingReplies(db as any);
    const first = (await f.root.collection('viewings').doc('v').get()).data()!;
    expect(first.confirmations.client.status).toBe('confirmed'); expect(first.confirmations.owner).toBeUndefined();
    await f.reply(owner, 'Confirm vizionarea'); await drainViewingReplies(db as any);
    expect((await viewingAttendance(f.ctx, { dayOffset: 1 })).count).toBe(0);
    await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client).toEqual(first.confirmations.client);
  });
  it('keeps refusal, ambiguity and reschedule requests separate without moving appointments', async () => {
    const f = await fixture(), client = await f.send('client');
    await f.reply(client, 'Reprogramează'); await drainViewingReplies(db as any);
    let row = (await f.root.collection('viewings').doc('v').get()).data()!;
    expect(row.confirmations.client.status).toBe('reschedule_requested');
    const originalDate = row.viewingDate;
    await f.reply(client, 'Poate', { timestamp: String(Math.floor(Date.now() / 1000) + 1) });
    const provider = { id: 'test', respond: vi.fn().mockResolvedValue({ text: 'unknown', calls: [], status: 'completed' }) } as any;
    await drainViewingReplies(db as any, provider);
    row = (await f.root.collection('viewings').doc('v').get()).data()!;
    expect(row.confirmations.client.status).toBe('unknown'); expect(row.viewingDate).toBe(originalDate);
    expect(provider.respond).toHaveBeenCalledOnce();
  });
  it('ignores late responses to a rescheduled viewing even if it moves back to the original time', async () => {
    const f = await fixture(), client = await f.send('client');
    const originalDate = (await f.root.collection('viewings').doc('v').get()).data()!.viewingDate;
    await executeAction(f.ctx, { kind: 'update_viewing', viewingId: 'v', status: 'scheduled', viewingDate: resolveDatetime({ dayOffset: 1, time: '19:00' }).iso }, 'move');
    await executeAction(f.ctx, { kind: 'update_viewing', viewingId: 'v', status: 'scheduled', viewingDate: originalDate }, 'move-back');
    await f.reply(client, 'Da'); await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations).toBeNull();
  });
  it('does not apply another recipient reply or a delivery receipt', async () => {
    const f = await fixture(), client = await f.send('client');
    await f.reply(client, 'Da', { from: '40700000999' }); await drainViewingReplies(db as any);
    await ingestMessage(db as any, f.connection, { channel: 'whatsapp', accountId: f.connection.externalId, participantId: client.phone, externalId: client.externalId, text: '', direction: 'sent', status: 'read', createdAt: new Date().toISOString(), attachments: [] });
    await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations).toBeUndefined();
  });
  it('resolves an unquoted reply only when a single current appointment matches', async () => {
    const f = await fixture(), client = await f.send('client');
    await f.reply(client, 'Da', { context: undefined }); await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client.status).toBe('confirmed');
    const second = { ...(await f.root.collection('viewings').doc('v').get()).data(), confirmations: null };
    await f.root.collection('viewings').doc('v2').set(second);
    await f.send('client', 'v2');
    const event = await f.reply(client, 'Nu', { context: undefined }); await drainViewingReplies(db as any);
    expect((await db.collection('communicationViewingReplies').doc(stableId(f.connection.id, event.externalId)).get()).data()).toMatchObject({ status: 'needs_review', reason: 'ambiguous_viewing' });
    expect((await f.root.collection('viewings').doc('v2').get()).data()!.confirmations).toBeNull();
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client.status).toBe('confirmed');
  });
  it('does not retain a previous confirmation when the model cannot interpret a newer reply', async () => {
    const f = await fixture(), client = await f.send('client');
    await f.reply(client, 'Da'); await drainViewingReplies(db as any);
    await f.reply(client, 'S-a schimbat situația și trebuie să discutăm', { timestamp: String(Math.floor(Date.now() / 1000) + 1) });
    const provider = { id: 'unavailable', respond: vi.fn().mockRejectedValue(new Error('Unavailable')) } as any;
    await drainViewingReplies(db as any, provider);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client.status).toBe('unknown');
  });
  it('ignores older answers and marks contradictory answers in the same second as unclear', async () => {
    const f = await fixture(), client = await f.send('client'), seconds = Math.floor(Date.now() / 1000);
    await f.reply(client, 'Nu', { timestamp: String(seconds + 2) }); await drainViewingReplies(db as any);
    await f.reply(client, 'Da', { timestamp: String(seconds + 1) }); await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client.status).toBe('declined');
    await f.reply(client, 'Da', { timestamp: String(seconds + 2) }); await drainViewingReplies(db as any);
    expect((await f.root.collection('viewings').doc('v').get()).data()!.confirmations.client.status).toBe('unknown');
  });
  it('rejects a wrong recipient or a template that does not describe the appointment', async () => {
    const f = await fixture(), client = await f.send('client');
    const input = { requestId: randomUUID(), template: { name: 'viewing_confirm', language: 'ro', parameters: ['Altă proprietate', '01.01.2030', '07:00'] }, viewingConfirmation: { viewingId: 'v', participant: 'client' } };
    await expect(queueMessage(db as any, f.actor, client.conversationId, input)).rejects.toThrow('data și ora');
    await expect(queueMessage(db as any, f.actor, client.conversationId, { ...input, viewingConfirmation: { viewingId: 'v', participant: 'owner' } })).rejects.toThrow('Destinatarul');
  });
});
