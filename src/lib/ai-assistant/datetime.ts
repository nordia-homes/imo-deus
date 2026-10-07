import type { z } from 'zod';
import { datetimeSchema } from './deterministic-contracts';
import { zonedParts, zonedInstant } from './zoned-time';
export function resolveDatetime(input: z.infer<typeof datetimeSchema>, now = new Date()) {
  input = datetimeSchema.parse(input);
  const timezone = 'Europe/Bucharest';
  const today = zonedParts(now, timezone).date;
  const date = input.date || new Date(Date.parse(today + 'T00:00:00Z') + Number(input.dayOffset) * 86400000).toISOString().slice(0, 10);
  return { iso: zonedInstant(date, input.time, timezone, input.utcOffsetMinutes), timezone, local: `${date} ${input.time}` };
}
