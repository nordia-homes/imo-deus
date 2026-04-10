'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import type { UserProfile } from '@/lib/types';

type UseAgencyAgentsOptions = {
  enabled?: boolean;
};

export function useAgencyAgents(options: UseAgencyAgentsOptions = {}) {
  const { enabled = true } = options;
  const { user } = useUser();
  const { agency } = useAgency();

  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !agency?.id || !user) {
      setAgents([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const activeUser = user;
    let isMounted = true;

    async function loadAgents() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch('/api/agency/agents', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca lista agenților.');
        }

        if (!isMounted) return;
        setAgents(Array.isArray(payload?.agents) ? (payload.agents as UserProfile[]) : []);
      } catch (fetchError) {
        if (!isMounted) return;
        setAgents([]);
        setError(fetchError instanceof Error ? fetchError : new Error('Nu am putut încărca lista agenților.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAgents();

    return () => {
      isMounted = false;
    };
  }, [agency?.id, enabled, user]);

  return { agents, isLoading, error };
}
