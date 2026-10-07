import { collectionFor, canReadResource, getResource, type AssistantContext } from './access';
import { automationReadiness } from './readiness';
import { CommunicationError } from '@/lib/communications/server';
import { notificationReconciliationHealth } from './notification-health';

export function projectionLag(events: Record<string, any>[]) {
  const lag = events.filter(row => row.source === 'firestore_change').map(row => Date.parse(row.recordedAt) - Date.parse(row.occurredAt)).filter(ms => Number.isFinite(ms) && ms >= 0).sort((a, b) => a - b);
  return { measuredEvents: lag.length, averageMs: lag.length ? Math.round(lag.reduce((sum, ms) => sum + ms, 0) / lag.length) : null, p95Ms: lag.length ? lag[Math.ceil(lag.length * .95) - 1] : null, maxMs: lag.at(-1) ?? null };
}
export async function crmHealth(ctx: AssistantContext) {
  const [worker, page, notificationReconciliation] = await Promise.all([automationReadiness(ctx), collectionFor(ctx, 'crmEvents').orderBy('recordedAt', 'desc').limit(100).get(), notificationReconciliationHealth(ctx)]);
  const events: Record<string, any>[] = [];
  // Revalidate sensitive parents using current permissions, not projection snapshots.
  for (let offset = 0; offset < page.docs.length; offset += 5) {
    const batch = await Promise.all(page.docs.slice(offset, offset + 5).map(async doc => {
      const row = doc.data();
      if (!canReadResource(ctx, 'crmEvents', row)) return null;
      try {
        for (const [field, resource] of [['saleId', 'sales'], ['conversationId', 'conversations']]) if (typeof row.entities?.[field] === 'string') await getResource(ctx, resource, row.entities[field]);
        return row;
      } catch (error) { if (error instanceof CommunicationError && [403, 404].includes(error.status)) return null; throw error; }
    }));
    events.push(...batch.filter((row): row is Record<string, any> => Boolean(row)));
  }
  const changes = events.filter(row => row.source === 'firestore_change');
  return { checkedAt: new Date().toISOString(), scope: ctx.role === 'admin' ? 'agency' : 'authorized_events', worker, notificationReconciliation, modelConfigured: Boolean(process.env.OPENAI_API_KEY), projection: { ...projectionLag(events), scanned: page.size, authorizedEvents: events.length, lastRecordedAt: changes[0]?.recordedAt || null, sampled: true, complete: page.size < 100, authority: 'crmEvents', note: 'Întârziere măsurată numai pentru evenimentele deja proiectate din acest eșantion. Nu certifică lipsa evenimentelor încă neprocesate sau acoperirea istoricului vechi.' }, note: 'Datele de business sunt citite din sursele autoritative înainte de execuție. Starea worker-ului nu dovedește funcționarea unui provider extern.' };
}
