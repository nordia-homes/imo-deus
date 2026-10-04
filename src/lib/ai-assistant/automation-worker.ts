import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { automationSchema, safeData } from './contracts';
import { collectionFor, type AssistantContext } from './access';
import { executeAction, matchContact } from './actions';
import { getInsights } from './insights';
import { searchProperties } from './search';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { featureFlags } from './skills';

export async function drainAssistantAutomations(db: Firestore, limit = 10) {
  if (!featureFlags().automations) return { processed: 0, results: [], disabled: true };
  const now = new Date().toISOString();
  const jobs = db.collection('assistantAutomationJobs');
  const stale = await jobs.where('status', '==', 'running').where('leaseUntil', '<', Date.now()).limit(limit).get();
  for (const doc of stale.docs) {
    await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      const row = fresh.data();
      if (!row || row.status !== 'running' || row.leaseUntil >= Date.now()) return;
      const mirror = db.collection('agencies').doc(row.agencyId).collection('assistantAutomations').doc(row.id);
      const existing = await tx.get(mirror);
      const patch = { status: 'unknown', error: 'Execuție întreruptă; verifică rezultatele înainte de reluare.' };
      tx.update(doc.ref, patch); if (existing.exists) tx.update(mirror, patch);
    });
  }
  const due = await jobs.where('status', '==', 'active').where('nextRunAt', '<=', now).orderBy('nextRunAt').limit(limit).get();
  const results: { id: string; status: string }[] = [];
  for (const doc of due.docs) {
    const claimId = randomUUID();
    const claim = await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== 'active' || fresh.data()?.nextRunAt > now) return null;
      const data = fresh.data()!;
      const mirror = db.collection('agencies').doc(data.agencyId).collection('assistantAutomations').doc(data.id);
      if (!(await tx.get(mirror)).exists) {
        tx.update(doc.ref, { status: 'blocked', error: 'Automatizarea nu mai există în agenție.' });
        return null;
      }
      const patch = { status: 'running', leaseUntil: Date.now() + 300000, claimId };
      tx.update(doc.ref, patch);
      tx.update(mirror, patch);
      return data;
    });
    if (!claim) continue;
    const mirror = db.collection('agencies').doc(claim.agencyId).collection('assistantAutomations').doc(claim.id);
    let outcome: Record<string, unknown>;
    try {
      const user = await db.collection('users').doc(claim.actorId).get();
      if (user.data()?.agencyId !== claim.agencyId || user.data()?.role !== claim.actorRole || !['agent', 'admin'].includes(user.data()?.role)) throw new Error('Permisiunile agentului au fost revocate sau schimbate.');
      const ctx = { uid: claim.actorId, agencyId: claim.agencyId, role: claim.actorRole, adminDb: db, authorization: '', runtimeMode: 'real' } as AssistantContext;
      const automation = automationSchema.parse(claim.automation);
      const run = Number(claim.runCount || 0) + 1;
      let result: unknown;
      if (automation.type === 'followup_task') {
        result = await executeAction(ctx, { kind: 'create_task', contactId: automation.contactId, description: automation.description, dueDate: now }, `${claim.id}-run-${run}`);
      } else if (automation.type === 'whatsapp_template') {
        if (isDemoAgencyId(claim.agencyId)) throw new Error('Mesajele externe sunt indisponibile în demo.');
        const conversation = await getConversation(db, ctx, automation.conversationId);
        if (automation.stopOnReply && conversation.lastInboundAt && conversation.lastInboundAt > claim.createdAt) {
          result = { skipped: true, reason: 'Destinatarul a răspuns după crearea automatizării.' };
        } else {
          // requestId is persisted BEFORE provider interaction, reused if the queue is inspected.
          let requestId = claim.requestId as string | undefined;
          if (!requestId) { requestId = randomUUID(); await doc.ref.update({ requestId }); }
          result = await queueMessage(db, ctx, automation.conversationId, { template: automation.template, requestId });
        }
      } else if (automation.type === 'insight_report' || automation.type === 'matching_watch') {
        const report = automation.type === 'insight_report' ? await getInsights(ctx, automation.limit) : { rows: (await matchContact(ctx, automation.contactId, automation.limit)).filter(row => row.matchScore >= automation.threshold), complete: true };
        result = report;
        for (const row of report.rows) {
          const id = automation.type === 'matching_watch' ? `${claim.id}-${row.id}` : `${claim.id}-run-${run}-${row.id}`;
          const notification = db.collection('users').doc(ctx.uid).collection('notifications').doc(id);
          await db.runTransaction(async tx => { if ((await tx.get(notification)).exists) return; tx.create(notification, { eventId: id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: automation.type === 'matching_watch' ? 'Potrivire ImoDeus peste pragul configurat' : String(row.title), body: automation.type === 'matching_watch' ? String(row.title) : 'Verifică insight-ul în AI Assistant.', actionUrl: '/ai-assistant', entityId: row.id, isRead: false, createdAt: now }); });
        }
      } else {
        const search = { ...automation.search, source: 'owners' as const, cursor: claim.scanCursor || undefined, limit: 100 };
        result = await searchProperties(ctx, search);
        const page = result as Awaited<ReturnType<typeof searchProperties>>;
        const notifications = db.collection('users').doc(ctx.uid).collection('notifications');
        for (const row of page.rows) {
          const ref = notifications.doc(`${claim.id}-${String(row.id)}`);
          await db.runTransaction(async tx => {
            if ((await tx.get(ref)).exists) return;
            tx.create(ref, { eventId: ref.id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Anunț potrivit căutării salvate', body: String(row.title), actionUrl: '/owner-listings', entityType: 'ownerListing', entityId: row.id, isRead: false, createdAt: now });
          });
        }
        // Keep an explicit continuation if the corpus exceeds this worker's read budget.
        if (page.nextCursor) result = { ...page, partial: true, note: 'Monitorizarea a verificat o pagină de rezultate; continuarea este disponibilă în AI Assistant.' };
      }
      const skipped = Boolean((result as { skipped?: boolean })?.skipped);
      const nextRun = !skipped && automation.intervalMinutes && run < automation.maxRuns ? new Date(Date.now() + automation.intervalMinutes * 60000).toISOString() : null;
      outcome = { status: nextRun ? 'active' : 'completed', runCount: run, nextRunAt: nextRun, lastRunAt: now, lastResult: safeData(result), scanCursor: automation.type === 'owner_watch' ? (result as { nextCursor?: string }).nextCursor || null : null, requestId: null, error: null };
      if (automation.type === 'whatsapp_template' && ['unknown', 'failed'].includes(String((result as { status?: string }).status))) outcome.status = (result as { status: string }).status === 'unknown' ? 'unknown' : 'blocked';
    } catch (error) {
      outcome = { status: 'blocked', lastRunAt: now, error: error instanceof Error ? error.message : 'Automatizarea a fost oprită.' };
    }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.claimId !== claimId || fresh.data()?.status !== 'running') return;
      tx.update(doc.ref, outcome); tx.update(mirror, outcome);
    });
    results.push({ id: doc.id, status: String(outcome.status) });
  }
  return { processed: results.length, results };
}
