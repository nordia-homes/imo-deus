import { z } from 'zod';
import { readResource, type AssistantContext } from './access';
import { calculateCrmReport } from '@/lib/crm/report-metrics';
import type { Contact, Property, Viewing } from '@/lib/types';
export const reportSchema = z.object({ section: z.enum(['summary', 'pipeline', 'portfolio', 'quality', 'forecast', 'sources', 'all']).default('summary'), scope: z.enum(['agency', 'mine']).default('agency') }).strict();
export async function crmReport(ctx: AssistantContext, input: z.infer<typeof reportSchema>) {
  const load = async (resource: 'contacts' | 'properties' | 'viewings') => {
    const rows: Record<string, any>[] = []; let cursor: string | undefined;
    while (rows.length < 20000) {
      const page = await readResource(ctx, { resource, limit: 100, ...(cursor ? { cursor } : {}) });
      rows.push(...page.rows);
      if (page.complete) return { rows, complete: true, cursor: null };
      if (!page.nextCursor || page.nextCursor === cursor) return { rows, complete: false, cursor: page.nextCursor };
      cursor = page.nextCursor;
    }
    return { rows, complete: false, cursor };
  };
  const [contacts, properties, viewings] = await Promise.all([load('contacts'), load('properties'), load('viewings')]);
  const complete = contacts.complete && properties.complete && viewings.complete;
  const meta = { complete, scope: input.scope, checkedAt: new Date().toISOString(), engine: 'shared_reports_page', periodDays: 30, inspectedRecords: { contacts: contacts.rows.length, properties: properties.rows.length, viewings: viewings.rows.length } };
  if (!complete) return { ...meta, rows: [], continuations: { contacts: contacts.cursor, properties: properties.cursor, viewings: viewings.cursor }, note: 'Limita de 20.000 înregistrări pe sursă a fost atinsă sau citirea nu s-a încheiat. Indicatorii globali nu sunt calculați dintr-un segment.' };
  const scope = <T extends Record<string, any>>(rows: T[]) => input.scope === 'mine' ? rows.filter(row => row.agentId === ctx.uid) : rows;
  const metrics = calculateCrmReport(scope(contacts.rows) as Contact[], scope(properties.rows) as Property[], scope(viewings.rows) as Viewing[]);
  const { salesData, buyerSourceData, sourceRows, statusRows, comparisonRows, funnelRows, sourceConversionRows, blockerRows, dataQualityRows, speedRows, riskRows, scoreRows, alertRows, forecastRows, inputRows, outputRows, ...summary } = metrics;
  const sections = { summary: [{ title: 'Indicatori CRM', ...summary }], pipeline: [...statusRows, ...funnelRows, ...speedRows, ...riskRows], portfolio: [...blockerRows, ...salesData], quality: [...dataQualityRows, ...scoreRows, ...alertRows], forecast: [...forecastRows, ...comparisonRows], sources: [...sourceRows, ...sourceConversionRows] };
  return { ...meta, summary, rows: input.section === 'all' ? Object.entries(sections).flatMap(([section, rows]) => rows.map(row => ({ section, ...row }))) : sections[input.section], note: 'Aceleași definiții ca pagina Reports, inclusiv comparația ultimelor 30 de zile și estimările. Date citite în timpul verificării; nu reprezintă un snapshot tranzacțional. Volumul vânzărilor urmează pagina Reports (prețul proprietății), nu încasările bancare. Forecasturile sunt estimări.' };
}
