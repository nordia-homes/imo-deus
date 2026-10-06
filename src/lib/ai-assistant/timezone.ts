import { z } from 'zod';
export const timezoneSchema = z.string().min(1).max(80).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Fus orar IANA invalid.');
export const DEFAULT_TIMEZONE = 'Europe/Bucharest';
