import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn() }));
import { readResource } from '../access';
import { crmReport, reportSchema } from '../report';
import { calculateCrmReport } from '@/lib/crm/report-metrics';
beforeEach(() => { vi.mocked(readResource).mockReset(); });
it('uses the manual report definitions for archived leads, conversions and sold portfolio prices', () => {
  const contacts: any[] = [{ id: 'won', status: 'Câștigat', createdAt: '2026-10-01' }, { id: 'open', status: 'Nou', createdAt: '2026-10-01' }, { id: 'archived', status: 'Pierdut', archivedAt: '2026-10-02' }];
  const properties: any[] = [{ id: 'sold', status: 'Vândut', price: 120000, soldPrice: 110000, statusUpdatedAt: '2026-10-01' }, { id: 'active', status: 'Activ', price: 80000 }];
  const result = calculateCrmReport(contacts, properties, [], Date.parse('2026-10-06T10:00:00Z'));
  expect(result).toMatchObject({ totalLeads: 2, archivedLeads: 1, conversionRate: 50, totalSalesVolume: 120000, activeInventoryValue: 80000, totalWonBuyers: 1 });
});
it('reads beyond the first page and scopes the same calculation to the current agent', async () => {
  vi.mocked(readResource).mockImplementation(async (_ctx, input) => input.resource !== 'properties' ? { rows: [], complete: true, nextCursor: null } : input.cursor ? { rows: [{ id: 'p2', agentId: 'other', status: 'Activ', price: 70000 }], complete: true, nextCursor: null } : { rows: [{ id: 'p1', agentId: 'u', status: 'Activ', price: 90000 }], complete: false, nextCursor: 'next' });
  const agency = await crmReport({ uid: 'u' } as any, reportSchema.parse({}));
  expect(agency).toMatchObject({ complete: true, summary: { activeProperties: 2, activeInventoryValue: 160000 }, engine: 'shared_reports_page' });
  expect(await crmReport({ uid: 'u' } as any, reportSchema.parse({ scope: 'mine' }))).toMatchObject({ summary: { activeProperties: 1, activeInventoryValue: 90000 } });
});
it('does not expose global report metrics when a source continuation is incomplete', async () => {
  vi.mocked(readResource).mockResolvedValue({ rows: [{ id: 'p', price: 90000 }], complete: false, nextCursor: 'stuck' });
  const result = await crmReport({ uid: 'u' } as any, reportSchema.parse({}));
  expect(result).toMatchObject({ complete: false, rows: [] }); expect(result).not.toHaveProperty('summary');
});
