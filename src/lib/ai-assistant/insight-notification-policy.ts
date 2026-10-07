import { z } from 'zod';

export const insightCooldownMinutesSchema = z.number().int().min(30).max(43200).default(1440);
