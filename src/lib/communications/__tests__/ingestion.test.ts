import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
import { ingestMessage, getConversation } from '../server';
import { stableId } from '../crypto';
import type { Connection } from '../model';
import type { IncomingEvent } from '../normalize';

// Minimal transactional store: tests exercise ingestion and authorization, not provider SDK mocks.
function memoryDb() {
  const values = new Map<string, Record<string, any>>();
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), exists: values.has(path), data: () => values.get(path), ref: doc(path) });
  const doc = (path: string): any => ({ id: path.split('/').at(-1), path, get: async () => snapshot(path), collection: (name: string) => collection(`${path}/${name}`) });
  const collection = (path: string): any => ({ doc: (id: string) => doc(`${path}/${id}`) });
  const db = { collection, runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
    const pending: Array<() => void> = [];
    const result = await fn({ get: async (ref: any) => snapshot(ref.path),
      set: (ref: any, value: any, options?: any) => pending.push(() => values.set(ref.path, options?.merge ? { ...values.get(ref.path), ...value } : value)),
      create: (ref: any, value: any) => pending.push(() => { if (values.has(ref.path)) throw new Error('duplicate create'); values.set(ref.path, value); }),
      update: (ref: any, value: any) => pending.push(() => values.set(ref.path, { ...values.get(ref.path), ...value })),
    });
    pending.forEach(write => write()); return result;
  } };
  return { values, db: db as unknown as Firestore };
}
const connection: Connection = { id: 'wa1', agencyId: 'agency', channel: 'whatsapp', externalId: 'phone', name: 'Agency', status: 'connected', capabilities: {}, updatedAt: '2026-09-27T12:00:00Z' };
const message: IncomingEvent = { channel: 'whatsapp', accountId: 'phone', participantId: 'customer', externalId: 'm1', text: 'Bună ziua', direction: 'received', attachments: [], createdAt: '2026-09-27T12:00:00Z' };
describe('durable ingestion', () => {
  it('replays an inbound once without incrementing the conversation version', async () => {
    const { db, values } = memoryDb();
    const id = await ingestMessage(db, connection, message);
    await ingestMessage(db, connection, message);
    expect([...values.keys()].filter(k => k.includes('/messages/'))).toHaveLength(1);
    expect(values.get(`agencies/agency/conversations/${id}`)?.version).toBe(1);
  });
  it('preserves last message and reply obligation when older inbound arrives late', async () => {
    const { db, values } = memoryDb();
    const id = await ingestMessage(db, connection, { ...message, direction: 'sent', externalId: 'out', createdAt: '2026-09-27T13:00:00Z', text: 'Răspuns' });
    await ingestMessage(db, connection, message);
    expect(values.get(`agencies/agency/conversations/${id}`)).toMatchObject({ latestMessage: 'Răspuns', needsReply: false, lastInboundAt: message.createdAt });
  });
  it('applies a receipt that arrived before the outbound echo', async () => {
    const { db, values } = memoryDb();
    await ingestMessage(db, connection, { ...message, direction: 'sent', status: 'read' });
    const id = await ingestMessage(db, connection, { ...message, direction: 'sent' });
    expect(values.get(`agencies/agency/conversations/${id}/messages/${stableId('wa1','m1')}`)?.status).toBe('read');
  });
  it('does not manufacture an agent for an app-originated message', async () => {
    const { db, values } = memoryDb();
    const id = await ingestMessage(db, connection, { ...message, direction: 'sent' });
    expect(values.get(`agencies/agency/conversations/${id}/messages/${stableId('wa1','m1')}`)).toMatchObject({ origin: 'native', authorId: null });
  });
  it('reconciles an uncertain ImoDeus send when the delivery receipt arrives', async () => {
    const { db, values } = memoryDb();
    const id = await ingestMessage(db, connection, { ...message, direction: 'sent' });
    const messageId = stableId('wa1', 'm1');
    const path = `agencies/agency/conversations/${id}/messages/${messageId}`;
    values.set(path, { ...values.get(path), origin: 'imodeus', status: 'unknown' });
    values.set(`communicationOutboundJobs/${messageId}`, { status: 'unknown', budgetSettled: false });
    await ingestMessage(db, connection, { ...message, direction: 'sent', status: 'delivered' });
    expect(values.get(path)?.status).toBe('delivered');
    expect(values.get(`communicationOutboundJobs/${messageId}`)).toMatchObject({ status: 'delivered', budgetSettled: false });
  });
  it('denies an unassigned agent and accepts the agency administrator', async () => {
    const { db } = memoryDb(); const id = await ingestMessage(db, connection, message);
    await expect(getConversation(db, { agencyId: 'agency', uid: 'agent', role: 'agent' }, id)).rejects.toThrow('acces');
    await expect(getConversation(db, { agencyId: 'agency', uid: 'admin', role: 'admin' }, id)).resolves.toMatchObject({ name: 'customer' });
  });
});
