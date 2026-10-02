import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { secretMatches, stableId } from '@/lib/communications/crypto';
import { isExternalSocialEcho, normalizeWebhookSafely } from '@/lib/communications/normalize';
import { agencyCollection, ingestMessage, migrateStoria, nowIso } from '@/lib/communications/server';
import { drainOutbound } from '@/lib/communications/outbound';
import { drainSearch } from '@/lib/communications/search';
import { drainSocial } from '@/lib/communications/social';
import { recordInboundOptOut } from '@/lib/communications/optout';
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
  const stageErrors: Array<{ error: string }> = [];
  try {
  const expiredSignups = await adminDb.collection('communicationWhatsAppSignupStates').where('expiresAt', '<', Date.now()).limit(50).get();
  if (!expiredSignups.empty) {
    const cleanup = adminDb.batch();
    for (const signup of expiredSignups.docs) cleanup.delete(signup.ref);
    await cleanup.commit();
  }
  } catch { stageErrors.push({ error: 'Signup cleanup failed' }); }
  try {
  const progressRef = adminDb.collection('communicationWorkerProgress').doc('tokenExpiry');
  const progress = (await progressRef.get()).data();
  let expiryQuery = adminDb.collection('communicationSecrets').where('tokenExpiresAt', '>', 0).where('tokenExpiresAt', '<=', Date.now()).orderBy('tokenExpiresAt').orderBy('__name__');
  if (progress?.expiresAt && progress?.id) expiryQuery = expiryQuery.startAfter(progress.expiresAt, progress.id);
  const expiredTokens = await expiryQuery.limit(50).get();
  for (const secret of expiredTokens.docs) {
    const value = secret.data();
    if (!value.tokenExpiresAt || !value.agencyId) continue;
    const ref = agencyCollection(adminDb, value.agencyId, 'channelConnections').doc(secret.id);
    const connection = await ref.get();
    if (connection.exists && connection.data()?.channel === 'whatsapp' && connection.data()?.capabilities?.send?.status === 'active') {
      await ref.update({ 'capabilities.send': { status: 'reconnect_required', reason: 'Autorizarea Meta a expirat.' },
        'capabilities.templates': { status: 'reconnect_required', reason: 'Autorizarea Meta a expirat.' } });
    }
  }
  const last = expiredTokens.docs.at(-1);
  await progressRef.set(expiredTokens.size === 50 && last ? { expiresAt: last.data().tokenExpiresAt, id: last.id } : { expiresAt: null, id: null });
  } catch { stageErrors.push({ error: 'Token expiry scan failed' }); }
  try {
  const projections = await adminDb.collection('communicationStoriaEvents').where('status', '==', 'queued').limit(10).get();
  for (const projection of projections.docs) {
    const value = projection.data();
    await migrateStoria(adminDb, { agencyId: value.agencyId, uid: 'system', role: 'admin' }, undefined, value.leadId);
    await projection.ref.update({ status: 'completed' });
  }
  } catch { stageErrors.push({ error: 'Storia projection failed' }); }
  try {
  const stalled = await adminDb.collection('communicationSocialJobs').where('status', '==', 'processing').limit(20).get();
  for (const job of stalled.docs) if (Date.parse(job.data().startedAt) < Date.now() - 360000) {
    await job.ref.update({ status: 'blocked', error: 'Rezultat necunoscut după întrerupere; verifică publicările externe înainte de reluare.' });
    await agencyCollection(adminDb, job.data().agencyId, 'socialPosts').doc(job.id).update({ status: 'needs_review' });
  }
  } catch { stageErrors.push({ error: 'Social recovery failed' }); }
  const rows = await adminDb.collection('communicationWebhookEvents').where('status', '==', 'queued').limit(10).get();
  for (const row of rows.docs) {
    try {
      const { events, errors } = normalizeWebhookSafely(JSON.parse(row.data().raw));
      for (const event of events) {
        try {
        const owner = await adminDb.collection('communicationAccountOwners').doc(stableId(event.channel, event.accountId)).get();
        if (!owner.exists) throw new Error('Contul din webhook nu are încă o conexiune înregistrată.');
        const data = owner.data()!;
        const ref = agencyCollection(adminDb, data.agencyId, 'channelConnections').doc(data.connectionId);
        const snapshot = await ref.get(); const connection = snapshot.data() as Connection;
        if (!connection || connection.status !== 'connected') continue;
        let nativeSocialEcho = false;
        if (event.socialEcho) {
          const mapped = await adminDb.collection('communicationMessageMappings').doc(stableId(connection.id, event.externalId)).get();
          const mapping = mapped.data();
          const message = mapping?.conversationId && mapping?.messageId
            ? await agencyCollection(adminDb, connection.agencyId, 'conversations').doc(mapping.conversationId).collection('messages').doc(mapping.messageId).get()
            : null;
          let possibleOutgoing = false;
          if (message?.data()?.origin !== 'imodeus' && !event.sourceAppId) {
            const pending = await adminDb.collection('communicationOutboundJobs').where('status', 'in', ['sending', 'unknown']).limit(100).get();
            possibleOutgoing = pending.size === 100 || pending.docs.some(job => job.data().connectionId === connection.id && Math.abs(Date.parse(job.data().createdAt) - Date.parse(event.createdAt)) < 600000);
          }
          nativeSocialEcho = isExternalSocialEcho(event, process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '', message?.data()?.origin || null, possibleOutgoing);
        }
        if (row.data().sourceAppId && row.data().sourceAppId !== (connection.appId || process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '')) throw new Error('Aplicația webhookului diferă de cea a conexiunii.');
        await recordInboundOptOut(adminDb, connection, event);
        await ingestMessage(adminDb, connection, event);
        const update: Record<string, unknown> = { lastSyncAt: nowIso() };
        if (!event.status && !event.imported) {
          if (event.direction === 'received') update['capabilities.receive'] = { status: 'active', reason: 'Recepție verificată prin webhook.' };
          if (event.nativeEcho || nativeSocialEcho) update['capabilities.nativeSync'] = { status: 'active', reason: event.channel === 'whatsapp' ? 'Activitate din aplicația WhatsApp Business confirmată prin webhook.' : 'Răspuns extern confirmat prin webhook.' };
        }
        await ref.update(update);
        } catch (error) { errors.push(error instanceof Error ? error.message : 'Procesare eveniment eșuată.'); }
      }
      if (errors.length) throw new Error(errors.join(' ').slice(0, 1000));
      await row.ref.update({ status: 'completed', processedAt: nowIso() });
    } catch (error) {
      const attempts = (row.data().attempts || 0) + 1;
      await row.ref.update({ status: attempts >= 5 ? 'failed' : 'queued', attempts, error: error instanceof Error ? error.message : 'Procesare eșuată' });
    }
  }
  const results = await Promise.allSettled([drainOutbound(adminDb), drainSearch(adminDb), drainSocial(adminDb)]);
  return NextResponse.json({ webhookEvents: rows.size, workers: [...stageErrors, ...results.map(r => r.status === 'fulfilled' ? { completed: r.value } : { error: r.reason instanceof Error ? r.reason.message : 'Worker failed' })] });
  } finally {
    await adminDb.runTransaction(async tx => { const snap = await tx.get(lease); if (snap.data()?.owner === owner) tx.delete(lease); });
  }
}
