import { z as schema } from 'zod';
import type { z } from 'zod';
import { datetimeSchema } from './deterministic-contracts';
import { zonedParts, zonedInstant } from './zoned-time';
export function resolveDatetime(input: z.infer<typeof datetimeSchema>, now = new Date()) {
  input = datetimeSchema.parse(input);
  const timezone = 'Europe/Bucharest';
  const today = zonedParts(now, timezone).date;
  const midnight = Date.parse(today + 'T00:00:00Z');
  let offset = input.dayOffset || 0;
  if (input.weekday) {
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(input.weekday);
    offset = (weekday - new Date(midnight).getUTCDay() + 7) % 7;
    // A bare weekday means its next occurrence at the requested local time.
    // Preserve zonedInstant's DST ambiguity/nonexistent-time validation.
    if (offset === 0 && Date.parse(zonedInstant(today, input.time, timezone, input.utcOffsetMinutes)) <= now.getTime()) offset = 7;
  }
  const date = input.date || new Date(midnight + offset * 86400000).toISOString().slice(0, 10);
  return { iso: zonedInstant(date, input.time, timezone, input.utcOffsetMinutes), timezone, local: `${date} ${input.time}` };
}

export const shiftDatetimeSchema = schema.object({ iso: schema.string().datetime({ offset: true }), minutes: schema.number().int().min(-525600).max(525600) }).strict();
export function shiftDatetime(input: schema.infer<typeof shiftDatetimeSchema>) {
  const { iso, minutes } = shiftDatetimeSchema.parse(input);
  const instant = new Date(Date.parse(iso) + minutes * 60000);
  const local = zonedParts(instant, 'Europe/Bucharest');
  return { iso: instant.toISOString(), timezone: 'Europe/Bucharest', local: `${local.date} ${local.time}` };
}
