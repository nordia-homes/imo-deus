import { createHmac, timingSafeEqual } from 'crypto';
import { whatsappAppId, whatsappAppSecret } from './whatsapp-config';

export function parseMetaSignedRequest(input: unknown): { userId: string; appId: string; whatsapp: boolean } | null {
  if (typeof input !== 'string' || input.length > 16000) return null;
  const parts = input.split('.'); if (parts.length !== 2) return null;
  try {
    const [signature, encoded] = parts;
    const received = Buffer.from(signature, 'base64url');
    const candidates = [
      { appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '', secret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '', whatsapp: false },
      { appId: whatsappAppId(), secret: whatsappAppSecret(), whatsapp: true },
    ];
    for (const candidate of candidates) {
      if (!candidate.appId || !candidate.secret) continue;
      const expected = createHmac('sha256', candidate.secret).update(encoded).digest();
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) continue;
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (payload.algorithm !== 'HMAC-SHA256' || typeof payload.user_id !== 'string' || !/^\d+$/.test(payload.user_id)) return null;
      return { userId: payload.user_id, appId: candidate.appId, whatsapp: candidate.whatsapp };
    }
  } catch { /* Invalid signed request. */ }
  return null;
}
