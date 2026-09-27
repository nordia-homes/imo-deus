'use client';
import { useCallback } from 'react';
import { useUser } from '@/firebase';
export function useCommunications() {
  const { user } = useUser();
  return useCallback(async (path: string, method = 'GET', body?: unknown) => {
    if (!user) throw new Error('Autentificarea este necesară.');
    const response = await fetch(`/api/communications/${path}`, { method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Operația a eșuat.');
    return data;
  }, [user]);
}
