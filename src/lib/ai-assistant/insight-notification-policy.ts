import { z } from 'zod';
import { timezoneSchema } from './timezone';

export const insightCooldownMinutesSchema = z.number().int().min(30).max(43200).default(1440);
export const INSIGHT_NOTIFICATION_LIMIT = 10;
export const INSIGHT_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INSIGHT_NOTIFICATION_CAP_NOTE = 'Maximum 10 alerte din rapoarte și monitorizări în ultimele 24 de ore, cumulat pentru tine în această agenție. Alertele peste plafon sunt omise; următoarea execuție reevaluează prioritățile.';

export const WATCH_NOTIFICATION_CAP_NOTE = 'Maximum 10 alerte din rapoarte și monitorizări în ultimele 24 de ore, cumulat pentru tine în această agenție. La atingerea plafonului, monitorizarea se amână fără să consume o execuție și reverifică datele la reluare. Termenul de oprire rămâne aplicabil. Același anunț sau aceeași pereche client–proprietate nu generează alerte din monitorizări diferite mai des de 24 de ore; omisiunile nu prelungesc pauza.';

export function insightNotificationBudget(value: unknown, now: number) {
  const parsed = z.array(z.number().int().nonnegative()).max(INSIGHT_NOTIFICATION_LIMIT).safeParse(value);
  if (!parsed.success || !Number.isFinite(now) || parsed.data.some(at => at > now)) throw new Error('Istoricul plafonului de notificări nu poate fi verificat.');
  const deliveries = parsed.data.filter(at => at > now - INSIGHT_NOTIFICATION_WINDOW_MS).sort((a, b) => a - b);
  return { deliveries, nextEligibleAt: deliveries.length >= INSIGHT_NOTIFICATION_LIMIT ? new Date(deliveries[0] + INSIGHT_NOTIFICATION_WINDOW_MS).toISOString() : null };
}
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const insightQuietHoursSchema = z.object({ timezone: timezoneSchema, start: clock, end: clock }).strict();
export type InsightQuietHours = z.infer<typeof insightQuietHoursSchema>;

export function insightQuietDeferral(input?: InsightQuietHours, now = Date.now()) {
  if (!input) return null;
  const { timezone, start, end } = insightQuietHoursSchema.parse(input);
  if (!Number.isFinite(now)) throw new Error('Moment de verificare invalid.');
  if (start === end) return null;
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const quiet = (at: number) => { const time = format.format(new Date(at)); return start < end ? time >= start && time < end : time >= start || time < end; };
  if (!quiet(now)) return null;
  // Walk actual instants: nonexistent clock minutes are skipped and repeated minutes retain their real offset.
  const firstMinute = Math.floor(now / 60000) * 60000 + 60000;
  for (let minute = 0; minute < 48 * 60; minute++) {
    const instant = firstMinute + minute * 60000;
    if (!quiet(instant)) return { deferred: true, status: 'deferred' as const, reasonCode: 'quiet_hours' as const, deferredUntil: new Date(instant).toISOString(), timezone };
  }
  throw new Error('Sfârșitul intervalului de liniște nu poate fi determinat.');
}
