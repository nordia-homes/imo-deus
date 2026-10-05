import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn() }));
import { collectionFor, type AssistantContext } from '../access';
import { usageReport } from '../metrics';
import { telemetryDocument, usageRecord } from '../telemetry';
import { routeModel } from '../models';
const ctx = { agencyId: 'a', uid: 'u', role: 'agent' } as AssistantContext;
const usage = { inputTokens: 100, outputTokens: 20, cachedTokens: 10, cacheWriteTokens: 0, estimated: false };
afterEach(() => vi.clearAllMocks());
function source(rows: any[]) {
  const query: any = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), startAfter: vi.fn().mockReturnThis(), get: async () => ({ size: rows.length, docs: rows.map((row, index) => ({ id: String(index), data: () => row })) }), doc: () => ({ get: async () => ({ data: () => rows[0] }) }) };
  vi.mocked(collectionFor).mockReturnValue(query); return query;
}
describe('PII-free measured observability', () => {
  it('does not report an unknown failed-turn cost as a zero-cost average', async () => {
    source([{ userId: 'u', timestamp: '2026-10-04', status: 'failed', usageComplete: false, models: [], tools: [] }]);
    expect(await usageReport(ctx, '2026-10-01', '2026-11-01')).toMatchObject({ costComplete: false, unknownCostTasks: 1, averageCostPerTask: null });
  });
  it('measures actual model mix, approval, retry and cost rather than declaring targets achieved', async () => {
    const luna = routeModel(), sol = routeModel({ invalidCalls: 3 });
    const base = { userId: 'u', timestamp: '2026-10-04T12:00:00.000Z', elapsedMs: 100, tools: [{ name: 'read', status: 'success' }] };
    const query = source([{ ...base, status: 'success', costUsd: 0.01, tokens: 120, requiresApproval: true, approval: true, executionStatus: 'completed', models: [usageRecord(luna, usage, 0.01, 100)] }, { ...base, status: 'partial', costUsd: 0.03, tokens: 240, models: [usageRecord(luna, usage, 0.01, 100, 'temporary'), usageRecord(sol, usage, 0.02, 100)] }]);
    const report = await usageReport(ctx, '2026-10-01', '2026-11-01');
    expect(report).toMatchObject({ tasks: 2, lunaSolvedPercent: 50, solEscalatedPercent: 50, averageCostPerTask: 0.02, approvalRatePercent: 100, retryRatePercent: 50, failedProviderCalls: 1, errorCategories: { temporary: 1 }, executions: { completed: 1 } });
    expect(query.where).toHaveBeenCalledWith('userId', '==', 'u');
  });
  it('returns unknown percentages for an empty production dataset', async () => {
    source([]); const report = await usageReport(ctx, '2026-10-01', '2026-11-01');
    expect(report.lunaSolvedPercent).toBeNull(); expect(report.solEscalatedPercent).toBeNull(); expect(report.averageCostPerTask).toBeNull(); expect(report.approvalRatePercent).toBeNull();
  });
  it('counts domain AI cost without falsely increasing solved chat tasks', async () => {
    source([{ userId: 'u', timestamp: '2026-10-04', sessionId: 'domain_ai', status: 'auxiliary', costUsd: 0.001, models: [usageRecord(routeModel(), usage, 0.001, 100)] }]);
    expect(await usageReport(ctx, '2026-10-01', '2026-11-01')).toMatchObject({ tasks: 0, auxiliaryCalls: 1, auxiliaryCostUsd: 0.001, costUsd: 0.001, lunaSolvedPercent: null });
  });
  it('rejects a foreign actor telemetry cursor', async () => {
    source([{ userId: 'other', timestamp: '2026-10-04' }]);
    await expect(usageReport(ctx, '2026-10-01', '2026-11-01', 'cursor')).rejects.toThrow('Cursor neautorizat');
  });
  it('stores versions and aggregate usage without prompts, phone numbers or arguments', () => {
    const record = telemetryDocument(ctx, 'request', 'session', { status: 'success', elapsedMs: 100, models: [usageRecord(routeModel(), usage, 0.001, 100)], tools: [] });
    expect(record.costUsd).toBe(0.001); expect(record.versions.routing).toBe('luna-first-2');
    expect(record.configuration.defaultLimits.maxCost).toBe(0.12); expect(record.configuration.flags.mcp).toBe(false);
    for (const key of ['prompt', 'phone', 'messages', 'arguments', 'authorization']) expect(record).not.toHaveProperty(key);
  });
});
