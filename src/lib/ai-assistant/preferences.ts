import { z } from 'zod';
import { timezoneSchema } from './timezone';
export const preferenceKeys = ['preferred_language', 'preferred_search_zone', 'preferred_property_source', 'preferred_response_style', 'preferred_working_hours', 'preferred_contact_channel', 'preferred_followup_time', 'preferred_report_format', 'preferred_message_tone', 'preferred_timezone', 'preferred_brief_time', 'preferred_brief_channel'] as const;
export const preferenceKeySchema = z.enum(preferenceKeys);
export function validatePreference(key: string, value: string) {
  preferenceKeySchema.parse(key);
  if (key === 'preferred_timezone') timezoneSchema.parse(value);
  if (['preferred_brief_time', 'preferred_followup_time'].includes(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Ora preferată trebuie să fie HH:mm.');
  return value.trim().slice(0, 200);
}

// Stored memory is data, including legacy/corrupt rows. A row cannot impersonate
// another preference just by occupying its deterministic document ID.
export function storedPreference(row: Record<string, unknown> | undefined, key: string, ownerId: string, now = Date.now()) {
  if (!row || row.ownerId !== ownerId || row.key !== key || typeof row.expiresAt !== 'number' || !Number.isFinite(row.expiresAt) || row.expiresAt <= now || typeof row.value !== 'string' || !row.value.trim() || row.value.length > 200) return null;
  try { return { key, value: validatePreference(key, row.value) }; } catch { return null; }
}
