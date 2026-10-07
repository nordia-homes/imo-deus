import { z } from 'zod';
export const DEFAULT_TIMEZONE = 'Europe/Bucharest';
export const timezoneSchema = z.string().max(80).refine((value): boolean => value === DEFAULT_TIMEZONE, 'Se folosește exclusiv fusul Europe/Bucharest.').describe('Fus unic: Europe/Bucharest');
