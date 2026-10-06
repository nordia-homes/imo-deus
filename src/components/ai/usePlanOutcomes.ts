'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Read-only, bounded tracking for the visible plan, shared by Text and Voice.
// A terminal result stops polling; reopening the plan refreshes it once.
export function usePlanOutcomes(planId: string, enabled: boolean, checkpoint: number, user: { getIdToken(): Promise<string> } | null) {
  const [outcomes, setOutcomes] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const pollingAllowed = useRef(false);
  const refresh = useCallback(async () => {
    if (!user || active.current) return null;
    const controller = new AbortController(), current = generation.current;
    active.current = controller;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/ai-assistant/plan-outcomes?planId=' + encodeURIComponent(planId), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
      const result = await response.json();
      if (current !== generation.current || controller.signal.aborted) return null;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          pollingAllowed.current = false; setWatching(false);
          setOutcomes(null); setError('Rezultatul nu mai este accesibil.');
          return { pollAfterMs: null };
        }
        throw new Error(result.error || 'Rezultatul nu a fost verificat.');
      }
      if (result.planId !== planId || !Array.isArray(result.rows)) throw new Error('Răspunsul nu corespunde planului curent.');
      if (!result.pollAfterMs) { pollingAllowed.current = false; setWatching(false); }
      setOutcomes({ ...result, viewer: user }); setError(null);
      return result;
    } catch (failure) {
      if (current === generation.current) setError(controller.signal.aborted ? 'Verificarea a expirat. Rezultatul anterior nu a fost actualizat.' : failure instanceof Error ? failure.message : 'Rezultatul nu a fost verificat.');
      return null;
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) active.current = null;
      if (current === generation.current) setRefreshing(false);
    }
  }, [planId, user]);

  useEffect(() => {
    generation.current++; active.current?.abort(); active.current = null;
    setOutcomes(null); setError(null); setRefreshing(false); setWatching(false);
    pollingAllowed.current = enabled && !!user;
    if (!enabled || !user) return;
    let disposed = false, attempts = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => { clearTimeout(timer); timer = setTimeout(tick, delay); };
    const tick = async () => {
      if (disposed || document.hidden || !pollingAllowed.current) return;
      if (attempts >= 60) { setWatching(false); setError('Urmărirea automată a ajuns la limita de verificări. Poți verifica manual rezultatul actual.'); return; }
      setWatching(true);
      if (active.current) { schedule(15000); return; }
      attempts++;
      const result = await refresh();
      if (disposed) return;
      const delay = result?.pollAfterMs;
      if (result && !delay) { setWatching(false); return; }
      // Failure retries back off. No provider action is ever retried here.
      schedule(result ? Math.max(15000, Math.min(60000, Number(delay) || 15000)) : Math.min(60000, 15000 * attempts));
    };
    const visible = () => { if (!document.hidden) { clearTimeout(timer); void tick(); } };
    document.addEventListener('visibilitychange', visible);
    void tick();
    return () => { disposed = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); generation.current++; active.current?.abort(); active.current = null; };
  }, [enabled, checkpoint, refresh, user]);

  return { outcomes: outcomes?.planId === planId && outcomes.viewer === user && user ? outcomes : null, refreshing, watching, error, refresh };
}
