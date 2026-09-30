import type { User } from 'firebase/auth';

export async function collaborationApi<T>(user: User, view: string, body?: Record<string, unknown>): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`/api/collaboration${view}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Datele de colaborare nu au putut fi încărcate.');
  return result as T;
}
