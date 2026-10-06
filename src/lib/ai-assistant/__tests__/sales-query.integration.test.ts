import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, agencyCollection: (db: Firestore, id: string, name: string) => db.collection('agencies').doc(id).collection(name) }));
import { queryRecords } from '../record-query';
import { getResource, type AssistantContext } from '../access';
import { queryRecordsSchema } from '../contracts';
const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('authorized Sales totals on actual Firestore', () => {
  let db: Firestore;
  const agencyId = randomUUID();
  beforeAll(async () => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-sales-query' });
    const sales = db.collection('agencies').doc(agencyId).collection('sales');
    await Promise.all([
      sales.doc('one').set({ agentId: 'u', collaboratorIds: ['u'], stage: 'contract', propertyTitle: 'Apartament' }),
      sales.doc('two').set({ agentId: 'other', collaboratorIds: ['u'], stage: 'contract', propertyTitle: 'Apartament' }),
      sales.doc('secret').set({ agentId: 'other', stage: 'contract', propertyTitle: 'Apartament' }),
      sales.doc('blocked').set({ agentId: 'u', stage: 'blocked', propertyTitle: 'Apartament' }),
    ]);
  });
  afterAll(async () => { if (!db) return; await db.recursiveDelete(db.collection('agencies').doc(agencyId)); await db.terminate(); });
  const context = (role: string) => ({ uid: 'u', role, agencyId, adminDb: db } as AssistantContext);
  it('aggregates owner OR collaborator without duplicates or private dossiers', async () => {
    const input = queryRecordsSchema.parse({ resource: 'sales', stage: 'contract', mode: 'count' });
    const result = await queryRecords(context('agent'), input);
    expect(result.count).toBe(2); expect(result.rows.map(row => row.id)).toEqual(['one', 'two']); expect(result.countScope).toBe('query');
    expect((await queryRecords(context('admin'), input)).count).toBe(3);
  });
  it('restricts text fallback and subsequent access after collaboration is revoked', async () => {
    const input = queryRecordsSchema.parse({ resource: 'sales', stage: 'contract', search: 'Apartament', mode: 'count' });
    expect((await queryRecords(context('agent'), input)).count).toBe(2);
    await db.collection('agencies').doc(agencyId).collection('sales').doc('two').update({ collaboratorIds: [] });
    await expect(getResource(context('agent'), 'sales', 'two')).rejects.toMatchObject({ status: 403 });
    expect((await queryRecords(context('agent'), input)).count).toBe(1);
  });
});
