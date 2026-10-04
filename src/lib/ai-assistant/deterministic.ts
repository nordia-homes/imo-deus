import { readResource, type AssistantContext } from './access';
import { normalized, safeData } from './contracts';
import { analysisSchema } from './deterministic-contracts';
import type { z } from 'zod';
export { resolveDatetime } from './datetime';
function comparable(value: unknown, field: string): string | number {
  if (typeof value === 'number') return value;
  if (/Date$|At$/.test(field) && typeof value === 'string' && Number.isFinite(Date.parse(value))) return Date.parse(value);
  return normalized(value);
}
export function analyzeRows(rows: Record<string, any>[], input: z.infer<typeof analysisSchema>) {
  const filtered = rows.filter(row => input.filters.every(filter => {
    const a = comparable(row[filter.field], filter.field), b = comparable(filter.value, filter.field);
    if (row[filter.field] === undefined) return false;
    return filter.operator === 'eq' ? a === b : filter.operator === 'ne' ? a !== b : filter.operator === 'contains' ? normalized(a).includes(normalized(b)) : filter.operator === 'lt' ? a < b : filter.operator === 'lte' ? a <= b : filter.operator === 'gt' ? a > b : a >= b;
  }));
  if (input.sort) { const { field, direction } = input.sort; filtered.sort((a, b) => { const left = comparable(a[field], field), right = comparable(b[field], field); return (left < right ? -1 : left > right ? 1 : 0) * (direction === 'asc' ? 1 : -1) || String(a.id).localeCompare(String(b.id)); }); }
  const numbers = input.numericField ? filtered.map(row => row[input.numericField!]).filter(value => typeof value === 'number' && Number.isFinite(value)) as number[] : [];
  return { rows: filtered.slice(0, input.limit), scope: 'selected_authorized_records', selectedRecords: rows.length, filteredRecords: filtered.length, complete: filtered.length <= input.limit, statistics: { count: filtered.length, numericCount: numbers.length, sum: numbers.reduce((a, b) => a + b, 0), average: numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null, min: numbers.length ? Math.min(...numbers) : null, max: numbers.length ? Math.max(...numbers) : null } };
}
export async function analyzeRecords(ctx: AssistantContext, input: z.infer<typeof analysisSchema>) {
  const rows: Record<string, unknown>[] = [], ids = [...new Set(input.ids)];
  for (let start = 0; start < ids.length; start += 3) rows.push(...await Promise.all(ids.slice(start, start + 3).map(async id => { const page = await readResource(ctx, { resource: input.resource, id, limit: 1 }); if (!page.rows[0]) throw new Error('Înregistrarea solicitată nu este accesibilă.'); return safeData(page.rows[0]); })));
  return analyzeRows(rows, input);
}
