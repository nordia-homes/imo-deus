import { createHmac } from 'crypto';
import { secretMatches } from './crypto';
function signature(jobId: string, connectionId: string) {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error('Cheia de criptare Meta nu este configurată.');
  return createHmac('sha256', key).update(JSON.stringify(['whatsapp-receipt-v1', connectionId, jobId])).digest('hex');
}
export function receiptCorrelation(jobId: string, connectionId: string) {
  if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error('Job invalid.');
  return 'imodeus.v1.' + jobId + '.' + signature(jobId, connectionId);
}
export function correlatedJob(value: unknown, connectionId: string): string | null {
  if (typeof value !== 'string') return null;
  const match = /^imodeus\.v1\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  return secretMatches(match[2], signature(match[1], connectionId)) ? match[1] : null;
}
