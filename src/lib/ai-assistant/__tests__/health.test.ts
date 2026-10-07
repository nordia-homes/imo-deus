import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resource: vi.fn(), allowed: vi.fn(() => true), collection: vi.fn(), readiness: vi.fn(async () => ({ configured: true, active: true, lastSuccessAt: '2026-10-05T12:00:00.000Z' })) }));
vi.mock('../access', () => ({ collectionFor: mocks.collection, getResource: mocks.resource, canReadResource: mocks.allowed }));
vi.mock('../readiness', () => ({ automationReadiness: mocks.readiness }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { CommunicationError } from '@/lib/communications/server';
import { crmHealth, projectionLag } from '../health';
const ctx: any = { agencyId: 'a', uid: 'u', role: 'agent' };
function source(rows: any[]) {
  const query: any = { orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: async () => ({ size: rows.length, docs: rows.map(row => ({ data: () => row })) }) };
  mocks.collection.mockReturnValue(query); return query;
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('authorized operational health', () => {
  it('reports degraded reconciliation separately from an active automation worker', async () => {
    vi.stubEnv('AI_ASSISTANT_WORKER_SECRET', 'synthetic'); source([]);
    const adminDb = { collection: () => ({ doc: (id: string) => ({ get: async () => ({ data: () => id === 'notificationSweep' ? { lastFinishedAt: new Date(Date.now() - 1000).toISOString(), failed: 1, token: 'private', cursor: 'users/other/notifications/n' } : {} }) }) }) };
    const result = await crmHealth({ ...ctx, adminDb });
    expect(result.worker.active).toBe(true);
    expect(result.notificationReconciliation.status).toBe('degraded');
    expect(JSON.stringify(result)).not.toMatch(/private|users\/other/);
  });
  it('measures lag only from genuine projected events with valid original timestamps', () => {
    expect(projectionLag([{ source: 'firestore_change', occurredAt: '2026-10-05T12:00:00Z', recordedAt: '2026-10-05T12:00:01Z' }, { source: 'firestore_change', occurredAt: '2026-10-05T12:00:00Z', recordedAt: '2026-10-05T12:00:03Z' }, { source: 'backfill', occurredAt: '2026-10-01', recordedAt: '2026-10-05' }, { source: 'firestore_change', occurredAt: 'bad', recordedAt: 'bad' }])).toEqual({ measuredEvents: 2, averageMs: 2000, p95Ms: 3000, maxMs: 3000 });
    expect(projectionLag([]).p95Ms).toBeNull();
  });
  it('rechecks current sensitive-parent access and returns no event data or credentials', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'never-return-this');
    source([{ source: 'firestore_change', visibility: { resource: 'sales' }, entities: { saleId: 'revoked' }, occurredAt: '2026-10-05T12:00:00Z', recordedAt: '2026-10-05T12:00:03Z' }, { source: 'firestore_change', entities: {}, occurredAt: '2026-10-05T12:00:00Z', recordedAt: '2026-10-05T12:00:01Z' }]);
    mocks.resource.mockRejectedValueOnce(new CommunicationError('revoked', 403));
    const result = await crmHealth(ctx);
    expect(result).toMatchObject({ scope: 'authorized_events', modelConfigured: true, projection: { measuredEvents: 1, scanned: 2, authorizedEvents: 1, sampled: true, p95Ms: 1000 } });
    expect(mocks.resource).toHaveBeenCalledWith(ctx, 'sales', 'revoked');
    expect(JSON.stringify(result)).not.toMatch(/revoked|never-return-this/);
  });
  it('does not turn unavailable infrastructure into a healthy empty sample', async () => { source([{ entities: { saleId: 's' } }]); mocks.resource.mockRejectedValueOnce(new Error('infrastructure')); await expect(crmHealth(ctx)).rejects.toThrow('infrastructure'); });
});
