import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ name: 'emulator-fixture', file: () => ({ save: async () => {} }) }) }) }));
vi.mock('sharp', () => ({ default: (bytes: Buffer) => { const chain: any = { rotate: () => chain, resize: () => chain, webp: () => chain, toBuffer: async () => bytes }; return chain; } }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: Firestore, id: string, name: string) => db.collection('agencies').doc(id).collection(name) }));
import { applyPropertyAsset } from '@/lib/crm/property-assets';
import type { AssistantContext } from '../access';
const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('floor-plan replacement on actual Firestore transactions', () => {
  let db: Firestore;
  const id = randomUUID(), revision = '2020-01-01T10:00:00Z';
  beforeAll(async () => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-assets-concurrency' });
    const agency = db.collection('agencies').doc(id);
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    await agency.collection('properties').doc('p').set({ updatedAt: revision, rlvUrl: 'original', images: [] });
    await Promise.all(['first', 'second'].map(uploadId => agency.collection('assistantUploads').doc(uploadId).set({ ownerId: id })));
  });
  afterAll(async () => { if (!db) return; await db.collection('users').doc(id).delete(); await db.recursiveDelete(db.collection('agencies').doc(id)); await db.terminate(); });
  it('commits one floor plan and one ledger for simultaneous edits from one revision', async () => {
    const ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db, adminAuth: { app: {} } } as unknown as AssistantContext;
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const results = await Promise.allSettled(['first', 'second'].map(uploadId => applyPropertyAsset(ctx, uploadId, 'p', 'property_rlv', { mimeType: 'image/png', name: 'plan.png' }, bytes, revision)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    const agency = db.collection('agencies').doc(id);
    expect((await agency.collection('assistantExecutions').get()).size).toBe(1);
    const winner = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>;
    expect((await agency.collection('properties').doc('p').get()).data()?.rlvUrl).toBe(winner.value.imageUrl);
    expect(await applyPropertyAsset(ctx, winner.value.uploadId, 'p', 'property_rlv', { mimeType: 'image/png', name: 'plan.png' }, bytes, revision)).toEqual(winner.value);
  }, 20000);
});
