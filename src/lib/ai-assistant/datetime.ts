import type { z } from 'zod';
import { datetimeSchema } from './deterministic-contracts';
import { bucharestLocalToIso, bucharestInputFromIso } from '@/lib/bucharest-time';
export function resolveDatetime(input: z.infer<typeof datetimeSchema>, now = new Date()) {
  const today = bucharestInputFromIso(now).date;
  const date = input.date || new Date(Date.parse(today + 'T00:00:00Z') + Number(input.dayOffset) * 86400000).toISOString().slice(0, 10);
  const nominal = Date.parse(`${date}T${input.time}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== date) throw new Error('Dată calendaristică invalidă.');
  const expected = `${date} ${input.time}`, candidates: string[] = [];
  const canonical = bucharestLocalToIso(date, input.time);
  if (canonical) for (const delta of [-3600000, 0, 3600000]) {
    const instant = new Date(Date.parse(canonical) + delta), local = bucharestInputFromIso(instant), offset = (nominal - instant.getTime()) / 60000;
    if (input.utcOffsetMinutes !== undefined && input.utcOffsetMinutes !== offset) continue;
    if (local.date === date && local.time === input.time) candidates.push(instant.toISOString());
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? 'Ora este ambiguă la schimbarea orei; precizează offsetul UTC.' : 'Ora locală nu există; alege alt interval.');
  return { iso: candidates[0], timezone: 'Europe/Bucharest', local: expected };
}
