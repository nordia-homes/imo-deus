import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { automationSchema, safeData } from './contracts';
import { collectionFor, getResource, type AssistantContext } from './access';
import { executeAction, matchContact } from './actions';
import { getInsights } from './insights';
import { searchProperties } from './search';
import { getConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { featureFlags } from './skills';
import { runEventRule } from './event-rules';
import { deliverDailyBrief } from './daily-brief';
import { nextBriefRun, briefSettingsSchema } from './daily-brief-contract';
import { assertNoReplySince } from './reply-stop';
import { createInsightNotification } from './insight-notifications';

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
      const ctx = { uid: claim.actorId, agencyId: claim.agencyId, role: claim.actorRole, adminDb: db, authorization: '', automationFence: { jobId: doc.id, claimId }, runtimeMode: 'real' } as AssistantContext;
      const automation = automationSchema.parse(claim.automation);
      const run = Number(claim.runCount || 0) + 1;
      let result: unknown;
      const stopReason = automation.stopAfter && Date.parse(automation.stopAfter) <= Date.now() ? 'Termenul de oprire a fost atins.' : 'contactId' in automation && automation.stopOnContactStatuses?.includes((await getResource(ctx, 'contacts', automation.contactId)).status) ? 'Clientul a ajuns într-un status configurat pentru oprire.' : null;
      if (stopReason) {
        result = { skipped: true, reason: stopReason };
      } else if (automation.type === 'legal_source_watch') {
        const { watchOfficialSources } = await import('./legal-source-watch');
        result = await watchOfficialSources(ctx, claim.id, automation.sourceUrls, claim.lastResult?.versions);
      } else if (automation.type === 'daily_sales_brief') {
        const settings = briefSettingsSchema.parse(Object.fromEntries(Object.keys(briefSettingsSchema.shape).map(key => [key, (automation as Record<string, unknown>)[key]])));
        result = await deliverDailyBrief(ctx, settings, new Date(), claim.nextRunAt);
      } else if (automation.type === 'event_rule') {
        result = await runEventRule(ctx, claim, automation, executeAction, async () => {
          const fresh = (await doc.ref.get()).data();
          if (fresh?.claimId !== claimId || fresh.status !== 'running' || fresh.leaseUntil <= Date.now()) throw new Error('Execuția regulii nu mai deține lease-ul.');
        });
      } else if (automation.type === 'followup_task') {
        result = await executeAction(ctx, { kind: 'create_task', contactId: automation.contactId, description: automation.description, dueDate: now }, `${claim.id}-run-${run}`);
      } else if (automation.type === 'whatsapp_template') {
        if (isDemoAgencyId(claim.agencyId)) throw new Error('Mesajele externe sunt indisponibile în demo.');
        const conversation = await getConversation(db, ctx, automation.conversationId);
        const replyCutoff = automation.stopOnReply ? claim.createdAt : undefined;
        // Compare instants, including offsets. Invalid persisted dates fail closed.
        let replied = false;
        if (replyCutoff !== undefined) {
          const cutoff = Date.parse(replyCutoff), inbound = Date.parse(conversation.lastInboundAt || '');
          if (!Number.isFinite(cutoff) || (conversation.lastInboundAt && !Number.isFinite(inbound))) assertNoReplySince(conversation, replyCutoff);
          replied = Number.isFinite(inbound) && inbound >= cutoff;
        } else if (automation.stopOnReply) throw new Error('Momentul activării follow-upului lipsește.');
        if (replied) {
          result = { skipped: true, reason: 'Destinatarul a răspuns după crearea automatizării.' };
        } else {
          // requestId is persisted BEFORE provider interaction, reused if the queue is inspected.
          let requestId = claim.requestId as string | undefined;
          if (!requestId) { requestId = randomUUID(); await db.runTransaction(async tx => { await assertAutomationFence(db, tx, ctx); tx.update(doc.ref, { requestId }); }); }
          result = await queueMessage(db, ctx, automation.conversationId, { template: automation.template, requestId, ...(automation.stopOnReply ? { stopOnReplySince: replyCutoff } : {}) });
        }
      } else if (automation.type === 'insight_report' || automation.type === 'matching_watch') {
        const report = automation.type === 'insight_report' ? await getInsights(ctx, automation.limit) : { rows: (await matchContact(ctx, automation.contactId, automation.limit)).filter(row => row.matchScore >= automation.threshold), complete: true };
        result = report;
        const notificationResults: unknown[] = [];
        for (const row of report.rows) {
          const id = automation.type === 'matching_watch' ? `${claim.id}-${row.id}` : `insight-${createHash('sha256').update(JSON.stringify([claim.id, run, row.id])).digest('hex')}`;
          if (automation.type === 'insight_report') {
            notificationResults.push(await createInsightNotification(ctx, claim.id, id, row, `${claim.id}-run-${run}-${row.id}`));
            continue;
          }
          const notification = db.collection('users').doc(ctx.uid).collection('notifications').doc(id);
          await db.runTransaction(async tx => { await assertAutomationFence(db, tx, ctx); if ((await tx.get(notification)).exists) return; tx.create(notification, { eventId: id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: automation.type === 'matching_watch' ? 'Potrivire ImoDeus peste pragul configurat' : String(row.title), body: automation.type === 'matching_watch' ? String(row.title) : 'Verifică insight-ul în AI Assistant.', actionUrl: '/ai-assistant', entityId: row.id, isRead: false, createdAt: now }); });
        }
        if (automation.type === 'insight_report') result = { ...report, notificationResults };
      } else {
        const search = { ...automation.search, source: 'owners' as const, cursor: claim.scanCursor || undefined, limit: 100 };
        result = await searchProperties(ctx, search);
        const page = result as Awaited<ReturnType<typeof searchProperties>>;
        const notifications = db.collection('users').doc(ctx.uid).collection('notifications');
        for (const row of page.rows) {
          const ref = notifications.doc(`${claim.id}-${String(row.id)}`);
          await db.runTransaction(async tx => {
            await assertAutomationFence(db, tx, ctx);
            if ((await tx.get(ref)).exists) return;
            tx.create(ref, { eventId: ref.id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Anunț potrivit căutării salvate', body: String(row.title), actionUrl: '/owner-listings', entityType: 'ownerListing', entityId: row.id, isRead: false, createdAt: now });
          });
        }
        // Keep an explicit continuation if the corpus exceeds this worker's read budget.
        if (page.nextCursor) result = { ...page, partial: true, note: 'Monitorizarea a verificat o pagină de rezultate; continuarea este disponibilă în AI Assistant.' };
      }
      const skipped = Boolean((result as { skipped?: boolean })?.skipped);
      const eventResult = automation.type === 'event_rule' ? result as Awaited<ReturnType<typeof runEventRule>> : null;
      const nextRun = !skipped && !eventResult?.limitReached && run < automation.maxRuns
        ? automation.type === 'daily_sales_brief'
          ? nextBriefRun(briefSettingsSchema.parse(Object.fromEntries(Object.keys(briefSettingsSchema.shape).map(key => [key, (automation as Record<string, unknown>)[key]]))))
          : automation.intervalMinutes ? new Date(Date.now() + automation.intervalMinutes * 60000).toISOString() : null
        : null;
      outcome = { status: nextRun ? 'active' : 'completed', runCount: run, nextRunAt: nextRun, lastRunAt: now, lastResult: safeData(result), scanCursor: automation.type === 'owner_watch' ? (result as { nextCursor?: string }).nextCursor || null : null, ...(eventResult ? { eventCursor: eventResult.eventCursor, eventCount: eventResult.eventCount } : {}), requestId: null, error: null };
      if (['whatsapp_template', 'daily_sales_brief'].includes(automation.type) && ['unknown', 'failed'].includes(String((result as { status?: string }).status))) outcome.status = (result as { status: string }).status === 'unknown' ? 'unknown' : 'blocked';
    } catch (error) {
      outcome = { status: 'blocked', lastRunAt: now, error: error instanceof Error ? error.message : 'Automatizarea a fost oprită.' };
      if (error instanceof Error && 'briefReceiptId' in error && typeof error.briefReceiptId === 'string' && /^[a-f0-9]{64}$/.test(error.briefReceiptId)) {
        outcome.status = 'unknown';
        outcome.lastResult = { receiptId: error.briefReceiptId, status: 'unknown' };
      }
    }
    await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.claimId !== claimId || fresh.data()?.status !== 'running') return;
      tx.update(doc.ref, outcome); tx.update(mirror, outcome);
      tx.create(mirror.collection('audit').doc(claimId), { id: claimId, action: 'run', actorId: claim.actorId, occurredAt: now, runCount: outcome.runCount || claim.runCount || 0, status: outcome.status, ...(outcome.error ? { error: outcome.error } : {}), ...(outcome.lastResult ? { result: outcome.lastResult } : {}) });
    });
    results.push({ id: doc.id, status: String(outcome.status) });
  }
  return { processed: results.length, results };
}
