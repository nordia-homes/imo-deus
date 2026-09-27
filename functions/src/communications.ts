import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
if (!getApps().length) initializeApp();
const db = getFirestore();
const secret = defineSecret('COMMUNICATIONS_WORKER_SECRET');
const baseUrl = defineSecret('COMMUNICATIONS_APP_BASE_URL');

export const communicationMessageSearchProjection = onDocumentWritten({ document: 'agencies/{agencyId}/conversations/{conversationId}/messages/{messageId}', region: 'us-central1', retry: true }, async event => {
  const { agencyId, conversationId, messageId } = event.params;
  const id = createHash('sha256').update(JSON.stringify([conversationId, messageId])).digest('hex');
  await db.collection('communicationSearchJobs').doc(id).set({ agencyId, conversationId, messageId, status: 'queued', updatedAt: new Date().toISOString() });
});

// Keep the legacy collection as a source during rollout; retries only enqueue one event.
export const communicationStoriaProjection = onDocumentWritten({ document: 'agencies/{agencyId}/storiaInboxLeads/{leadId}', region: 'us-central1', retry: true }, async event => {
  if (!event.data?.after.exists) return;
  const id = createHash('sha256').update(event.id).digest('hex');
  await db.runTransaction(async tx => {
    const ref = db.collection('communicationStoriaEvents').doc(id);
    if (!(await tx.get(ref)).exists) tx.create(ref, { agencyId: event.params.agencyId, leadId: event.params.leadId, status: 'queued', createdAt: new Date().toISOString() });
  });
});
export const communicationsMinuteTick = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Europe/Bucharest', region: 'us-central1', timeoutSeconds: 300, secrets: [secret, baseUrl] }, async () => {
  const response = await fetch(`${baseUrl.value().replace(/\/$/, '')}/api/communications-worker`, { method: 'POST', headers: { Authorization: `Bearer ${secret.value()}` }, signal: AbortSignal.timeout(270000) });
  if (!response.ok) throw new Error(`Communications worker HTTP ${response.status}`);
  const result = await response.json() as { workers?: Array<{ error?: string }> };
  if (result.workers?.some(worker => worker.error)) throw new Error('A communications worker requires attention.');
});
