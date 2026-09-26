'use client';
import type { User } from 'firebase/auth';

export async function romimoFetch<T>(user: User | null, action: string, body?: unknown): Promise<T> {
  if (!user) throw new Error('Autentifică-te din nou.');
  const token = await user.getIdToken();
  let response: Response;
  try { response = await fetch(`/api/romimo/${action}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: AbortSignal.timeout(190000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }); } catch { throw new Error('Conexiunea s-a întrerupt. Verifică starea anunțului înainte de retrimitere.'); }
  const result = await response.json().catch(() => { throw new Error('Serverul nu a returnat un răspuns valid. Verifică starea înainte de retrimitere.'); });
  if (!result || typeof result !== 'object') throw new Error('Răspuns neconfirmat. Verifică starea înainte de retrimitere.');
  if (!response.ok) throw new Error(result.message || 'Operațiunea Romimo a eșuat.');
  return result as T;
}
