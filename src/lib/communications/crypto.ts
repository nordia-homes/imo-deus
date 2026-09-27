import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
export const stableId = (...parts: string[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export function secretMatches(actual: string, expected: string) {
  if (!expected || !actual) return false;
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validSignature(raw: string, signature: string, secret: string) {
  return Boolean(secret) && secretMatches(signature, `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
}
function key() {
  const value = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('Cheia de criptare Meta nu este configurată.');
  return createHash('sha256').update(value).digest();
}
export function seal(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function unseal(value: string) {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
