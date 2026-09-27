import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { secretMatches, stableId } from '@/lib/communications/crypto';
import { normalizeWebhook } from '@/lib/communications/normalize';
import { agencyCollection, ingestMessage, migrateStoria, nowIso } from '@/lib/communications/server';
import { drainOutbound } from '@/lib/communications/outbound';
import { drainSearch } from '@/lib/communications/search';
import { drainSocial } from '@/lib/communications/social';
import type { Connection } from '@/lib/communications/model';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get('authorization') || '', process.env.COMMUNICATIONS_WORKER_SECRET ? `Bearer ${process.env.COMMUNICATIONS_WORKER_SECRET}` : '')) return new NextResponse('Forbidden', { status: 403 });
  const lease = adminDb.collection('communicationWorkerLocks').doc('drain');
  const owner = crypto.randomUUID();
  const claimed = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(lease);
    if ((snap.data()?.expiresAt || 0) > Date.now()) return false;
    tx.set(lease, { owner, expiresAt: Date.now() + 360000 }); return true;
  });
  if (!claimed) return NextResponse.json({ busy: true });
  try {
  const projections = await adminDb.collection('communicationStoriaEvents').where('status', '==', 'queued').limit(10).get();
  for (const projection of projections.docs) {
    const value = projection.data();
    await migrateStoria(adminDb, { agencyId: value.agencyId, uid: 'system', role: 'admin' }, undefined, value.leadId);
    await projection.ref.update({ status: 'completed' });
  }
  const stalled = await adminDb.collection('communicationSocialJobs').where('status', '==', 'processing').limit(20).get();
  for (const job of stalled.docs) if (Date.parse(job.data().startedAt) < Date.now() - 360000) {
    await job.ref.update({ status: 'blocked', error: 'Rezultat necunoscut după întrerupere; verifică publicările externe înainte de reluare.' });
    await agencyCollection(adminDb, job.data().agencyId, 'socialPosts').doc(job.id).update({ status: 'needs_review' });
  }
  const rows = await adminDb.collection('communicationWebhookEvents').where('status', '==', 'queued').limit(10).get();
  for (const row of rows.docs) {
    try {
      const events = normalizeWebhook(JSON.parse(row.data().raw));
      for (const event of events) {
        const owner = await adminDb.collection('communicationAccountOwners').doc(stableId(event.channel, event.accountId)).get();
        if (!owner.exists) throw new Error('Contul din webhook nu are încă o conexiune înregistrată.');
        const data = owner.data()!;
        const ref = agencyCollection(adminDb, data.agencyId, 'channelConnections').doc(data.connectionId);
        const snapshot = await ref.get(); const connection = snapshot.data() as Connection;
        if (!connection || connection.status !== 'connected') continue;
        await ingestMessage(adminDb, connection, event);
        const update: Record<string, unknown> = { lastSyncAt: nowIso() };
        if (!event.status && !event.imported) {
          if (event.direction === 'received') update['capabilities.receive'] = { status: 'active', reason: 'Recepție verificată prin webhook.' };
          if (event.nativeEcho) update['capabilities.nativeSync'] = { status: 'active', reason: 'Activitate din aplicația WhatsApp Business confirmată prin webhook.' };
        }
        await ref.update(update);
      }
      await row.ref.update({ status: 'completed', processedAt: nowIso() });
    } catch (error) {
      const attempts = (row.data().attempts || 0) + 1;
      await row.ref.update({ status: attempts >= 5 ? 'failed' : 'queued', attempts, error: error instanceof Error ? error.message : 'Procesare eșuată' });
    }
  }
  const results = await Promise.allSettled([drainOutbound(adminDb), drainSearch(adminDb), drainSocial(adminDb)]);
  return NextResponse.json({ webhookEvents: rows.size, workers: results.map(r => r.status === 'fulfilled' ? { completed: r.value } : { error: r.reason instanceof Error ? r.reason.message : 'Worker failed' }) });
  } finally {
    await adminDb.runTransaction(async tx => { const snap = await tx.get(lease); if (snap.data()?.owner === owner) tx.delete(lease); });
  }
}
