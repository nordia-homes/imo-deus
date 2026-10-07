"use client";

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AppNotification } from '@/lib/notifications/types';

export function useRuleNotificationRelevance(user: User | null | undefined, notifications: AppNotification[] | null | undefined, enabled = true) {
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const idsKey = JSON.stringify((notifications || []).filter(row => (row.ruleCondition || row.insightCondition || row.matchingCondition || row.ownerWatchCondition) && !row.withdrawnAt).map(row => row.id).sort());
  const requestKey = `${user?.uid}:${idsKey}`;
  useEffect(() => {
    const ids: string[] = JSON.parse(idsKey);
    if (!user || !enabled || !ids.length) return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === 'hidden' || controller.signal.aborted) return;
      running = true;
      try {
        const token = await user.getIdToken();
        for (let offset = 0; offset < ids.length; offset += 100) {
          const response = await fetch('/api/notifications/reconcile', {
            method: 'POST', signal: controller.signal,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids.slice(offset, offset + 100) }),
          });
          if (!response.ok) throw new Error('Reconciliation failed');
        }
        if (!controller.signal.aborted) setFailedKey(null);
      } catch {
        if (!controller.signal.aborted) setFailedKey(requestKey);
      } finally { running = false; }
    };
    void refresh();
    const onVisible = () => { void refresh(); };
    const timer = window.setInterval(onVisible, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [user, enabled, idsKey, requestKey]);
  return enabled && Boolean(user) && idsKey !== '[]' && failedKey === requestKey;
}
