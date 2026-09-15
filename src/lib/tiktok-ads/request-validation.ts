import { z } from 'zod';
import { TIKTOK_CAPABILITIES } from './types';
import { TikTokAdsError } from './errors';

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export const operationBodySchema = z.object({
  capability: z.enum(TIKTOK_CAPABILITIES),
  advertiserId: id.nullish(),
  propertyId: id.nullish(),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/).nullish(),
  authorizationToken: z.string().trim().min(32).max(256).nullish(),
  expectedVersion: z.number().int().nonnegative().nullish(),
}).strict();

export function parseOperationBody(value: unknown) {
  const result = operationBodySchema.safeParse(value);
  if (!result.success) throw new TikTokAdsError('INVALID_REQUEST', 'Cererea TikTok Ads nu este validă.', { safeDetails: { issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).slice(0, 10) } });
  const serialized = JSON.stringify(result.data.payload);
  if (serialized.length > 500_000) throw new TikTokAdsError('INVALID_REQUEST', 'Payload-ul TikTok Ads este prea mare.');
  const inspect = (input: unknown) => {
    if (Array.isArray(input)) return input.forEach(inspect);
    if (!input || typeof input !== 'object') return;
    for (const [key, child] of Object.entries(input as Record<string, unknown>)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new TikTokAdsError('INVALID_REQUEST', 'Payload-ul conține un câmp interzis.');
      inspect(child);
    }
  };
  inspect(result.data.payload);
  return result.data;
}
