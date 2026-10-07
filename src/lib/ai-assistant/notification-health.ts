import type { AssistantContext } from './access';

// Expose service status only: global cursor, user paths, tokens and counts stay server-side.
export async function notificationReconciliationHealth(ctx: Pick<AssistantContext, 'adminDb'>) {
  const note = 'Starea descrie ultimul lot verificat, nu întregul inbox. Un ciclu poate necesita mai multe execuții; alertele legacy și utilizatorii fără acces CRM sunt omişi.';
  if (!process.env.AI_ASSISTANT_WORKER_SECRET) return { status: 'unconfigured', running: false, lastFinishedAt: null, note };
  try {
    const [scan, worker] = await Promise.all(['notificationSweep', 'global'].map(id => ctx.adminDb.collection('assistantWorkerState').doc(id).get()));
    const row = scan.data(), now = Date.now();
    const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now ? Date.parse(value) : null;
    const finished = timestamp(row?.lastFinishedAt);
    const failures = [timestamp(row?.lastFailedAt), timestamp(worker.data()?.lastNotificationSweepFailureAt)].filter((value): value is number => value !== null);
    const lastFailure = failures.length ? Math.max(...failures) : null;
    const running = Number.isFinite(row?.leaseUntil) && row!.leaseUntil > now && row!.leaseUntil <= now + 60000;
    const latest = Math.max(finished ?? 0, lastFailure ?? 0);
    const status = !latest ? 'unknown' : now - latest >= 15 * 60000 ? 'stale'
      : lastFailure !== null && (finished === null || lastFailure >= finished) ? 'degraded'
        : !Number.isSafeInteger(row?.failed) || row!.failed < 0 ? 'unknown'
          : row!.failed > 0 ? 'degraded' : 'current';
    return { status, running, lastFinishedAt: finished === null ? null : new Date(finished).toISOString(), note };
  } catch {
    return { status: 'unavailable', running: false, lastFinishedAt: null, note };
  }
}
