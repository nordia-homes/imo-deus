'use client';

import type { User } from 'firebase/auth';

export async function facebookCloudFetch(
  user: User,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const token = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
}
