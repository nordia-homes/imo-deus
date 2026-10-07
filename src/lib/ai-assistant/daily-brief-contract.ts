import { z } from 'zod';
import { timezoneSchema } from './timezone';
import { zonedInstant, zonedParts } from './zoned-time';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const briefSettingsShape = {
  timezone: timezoneSchema,
  deliveryTime: clock, daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  quietStart: clock.default('22:00'), quietEnd: clock.default('08:00'), maxItems: z.number().int().min(1).max(10).default(5),
  deliveryChannel: z.enum(['app', 'whatsapp']).default('app'), language: z.literal('ro').default('ro'),
  conversationId: z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/).optional(), templateName: z.string().regex(/^[a-z0-9_]{1,200}$/).optional(), templateLanguage: z.string().max(20).default('ro'),
};
export const briefSettingsSchema = z.object(briefSettingsShape).strict();
export type BriefSettings = z.infer<typeof briefSettingsSchema>;
export function quietAt(time: string, start: string, end: string) { return start === end ? false : start < end ? time >= start && time < end : time >= start || time < end; }
export function validateBriefSettings(input: BriefSettings) {
  const settings = briefSettingsSchema.parse(input);
  if (quietAt(settings.deliveryTime, settings.quietStart, settings.quietEnd)) throw new Error('Ora brief-ului se află în intervalul de liniște.');
  if (settings.deliveryChannel === 'whatsapp' && (!settings.conversationId || !settings.templateName)) throw new Error('Brief-ul WhatsApp necesită conversație eligibilă și template aprobat cu un parametru pentru rezumat.');
  return settings;
}
export function nextBriefRun(settings: BriefSettings, after = new Date()) {
  validateBriefSettings(settings);
  const local = zonedParts(after, settings.timezone);
  for (let days = 0; days <= 8; days++) {
    const date = new Date(Date.parse(local.date + 'T12:00:00Z') + days * 86400000);
    if (!settings.daysOfWeek.includes(date.getUTCDay())) continue;
    try {
      const instant = zonedInstant(date.toISOString().slice(0, 10), settings.deliveryTime, settings.timezone);
      if (Date.parse(instant) > after.getTime()) return instant;
    } catch { /* Skip nonexistent or ambiguous DST slots; never send twice. */ }
  }
  throw new Error('Nu există o următoare dată validă pentru brief.');
}
