import { randomUUID } from 'node:crypto';
import { PLAN_WORKER_STEPS } from './plan-limits';
import { collectionFor, referencesAllowed, type AssistantContext } from './access';
import { chatTurn, getPlan, runPlan } from './workspace';
import { validateApproval } from './approval';
import { CommunicationError } from '@/lib/communications/server';
import { adminAuth } from '@/firebase/admin';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { failureCategory } from './failure';
import { saveWorkerTurnFailure } from './worker-failure';
import { assertAutomationFence } from '@/lib/crm/automation-fence';

export async function renewAgentJobLease(db: Firestore, ctx: AssistantContext) {
  if (!ctx.agentJobFence) throw new CommunicationError('Claim worker necesar.', 409);
  return db.runTransaction(async tx => {
    await assertAutomationFence(db, tx, ctx);
    tx.update(db.collection('assistantAgentJobs').doc(ctx.agentJobFence!.jobId), { leaseUntil: Date.now() + 300000, heartbeatAt: new Date().toISOString() });
  });
}

export async function enqueueTurn(ctx: AssistantContext, input: { sessionId: string; requestId: string; prompt: string }) {
  if (ctx.runtimeMode === 'demo') throw new CommunicationError('Joburile durabile sunt indisponibile în demo.', 403);
  const ref = ctx.adminDb.collection('assistantAgentJobs').doc(input.requestId);
  const queue = collectionFor(ctx, 'assistantLocks').doc(`queue-${ctx.uid}`);
  await ctx.adminDb.runTransaction(async tx => {
    const [job, session, actor] = await Promise.all([tx.get(ref), tx.get(collectionFor(ctx, 'assistantSessions').doc(input.sessionId)), tx.get(queue)]);
    if (session.exists && session.data()?.ownerId !== ctx.uid) throw new CommunicationError('Conversație inaccesibilă.', 403);
    if (job.exists) { if (job.data()?.userId !== ctx.uid || job.data()?.agencyId !== ctx.agencyId) throw new CommunicationError('Job inaccesibil.', 403); return; }
    const previousId = actor.data()?.jobId;
    if (previousId && ['pending', 'running'].includes((await tx.get(ctx.adminDb.collection('assistantAgentJobs').doc(previousId))).data()?.status)) throw new CommunicationError('O comandă este deja în coadă pentru acest agent.', 409);
    tx.create(ref, { ...input, jobType: 'turn', agencyId: ctx.agencyId, userId: ctx.uid, role: ctx.role, status: 'pending', attempts: 0, createdAt: new Date().toISOString(), events: [] });
    tx.set(queue, { jobId: input.requestId });
  });
  return { jobId: ref.id, status: 'pending' };
}
export async function enqueuePlan(ctx: AssistantContext, planId: string) {
  if (ctx.runtimeMode === 'demo') throw new CommunicationError('Execuția durabilă este indisponibilă în demo.', 403);
  const { data } = await getPlan(ctx, planId);
  validateApproval((data as any).approval, ctx.uid, ctx.agencyId, planId, data.actions);
  const ref = ctx.adminDb.collection('assistantAgentJobs').doc(planId);
  await ctx.adminDb.runTransaction(async tx => {
    const job = await tx.get(ref);
    if (job.exists) {
      if (job.data()?.userId !== ctx.uid || job.data()?.agencyId !== ctx.agencyId) throw new CommunicationError('Job inaccesibil.', 403);
      if (!(job.data()?.status === 'failed' && data.status === 'failed') && !(job.data()?.status === 'completed' && job.data()?.planStatus === 'paused' && data.status === 'pending')) return;
    }
    if (!['pending', 'failed'].includes(data.status)) throw new CommunicationError('Planul necesită verificarea stării.', 409);
    tx.set(ref, { jobType: 'plan', planId, sessionId: data.sessionId, agencyId: ctx.agencyId, userId: ctx.uid, role: ctx.role, status: 'pending', attempts: 0, approvedAt: new Date().toISOString(), createdAt: new Date().toISOString(), events: [] });
  });
  return { jobId: ref.id, status: 'pending' };
}
export async function readJob(ctx: AssistantContext, id: string) {
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const data = (await ctx.adminDb.collection('assistantAgentJobs').doc(id).get()).data();
  if (!data || data.userId !== ctx.uid || data.agencyId !== ctx.agencyId) throw new CommunicationError('Job inaccesibil.', 404);
  if (data.message && !(await referencesAllowed(ctx, data.message.accessRefs))) throw new CommunicationError('Acces revocat la rezultat.', 403);
  const plan = data.planId ? (await getPlan(ctx, data.planId)).data : null;
  return { jobId: id, status: data.status, businessStatus: data.planStatus || plan?.status || data.status, events: data.events || [], message: data.message || null, plan, error: data.error || null };
}
export async function recoverAgentJob(db: Firestore, ref: DocumentReference) {
  await db.runTransaction(async tx => {
    const fresh = await tx.get(ref), job = fresh.data();
    if (!job || job.status !== 'running' || !(job.leaseUntil < Date.now())) return;
    if (job.jobType === 'verification') {
      // attempts counts ordinary polling too. Only interrupted checks consume
      // the recovery allowance; never renew the original verification deadline.
      const recoveries = job.recoveryAttempts ?? 0;
      const retry = Number.isSafeInteger(recoveries) && recoveries >= 0 && recoveries < 2 && Number.isFinite(job.deadline) && job.deadline > Date.now();
      tx.update(ref, retry
        ? { status: 'pending', recoveryAttempts: recoveries + 1, error: null }
        : { status: 'failed', planStatus: 'BLOCKED', error: 'Verificarea rezultatului a fost întreruptă și nu mai poate continua automat. Efectul extern nu a fost repetat; verifică starea în modulul dedicat.' });
      return;
    }
    tx.update(ref, { status: job.jobType !== 'plan' && job.attempts < 2 ? 'pending' : 'failed', error: 'Execuție întreruptă; verifică planul. Acțiunile externe nu se repetă automat.' });
  });
}

export async function drainAgentJobs(db: Firestore, limit = 1) {
  const jobs = db.collection('assistantAgentJobs');
  const stale = await jobs.where('status', '==', 'running').where('leaseUntil', '<', Date.now()).limit(limit).get();
  for (const row of stale.docs) await recoverAgentJob(db, row.ref);
  const due = await jobs.where('status', '==', 'pending').orderBy('createdAt').limit(limit).get();
  let processed = 0;
  for (const row of due.docs) {
    const claimId = randomUUID();
    const job = await db.runTransaction(async tx => {
      const fresh = await tx.get(row.ref), data = fresh.data(); if (!data || data.status !== 'pending') return null;
      if (Number(data.notBefore || 0) > Date.now()) { tx.update(row.ref, { createdAt: new Date().toISOString() }); return null; }
      const member = await tx.get(db.collection('users').doc(data.userId));
      if (member.data()?.agencyId !== data.agencyId || member.data()?.role !== data.role || !['agent', 'admin'].includes(data.role)) { tx.update(row.ref, { status: 'failed', error: 'Acces revocat.' }); return null; }
      tx.update(row.ref, { status: 'running', claimId, leaseUntil: Date.now() + 300000, attempts: data.attempts + 1 }); return data;
    });
    if (!job) continue; processed++;
    const ctx = { uid: job.userId, agencyId: job.agencyId, role: job.role, adminDb: db, adminAuth, runtimeMode: 'real', authorization: '', appOrigin: process.env.APP_BASE_URL, agentJobFence: { jobId: row.id, claimId } } as AssistantContext;
    const events: unknown[] = [];
    const publishProgress = async (progress: unknown[]) => db.runTransaction(async tx => {
      await assertAutomationFence(db, tx, ctx);
      const fresh = await tx.get(row.ref);
      if (fresh.data()?.claimId !== claimId || fresh.data()?.status !== 'running') throw new CommunicationError('Execuția workerului a fost înlocuită. Verifică istoricul.', 409);
      tx.update(row.ref, { events: progress, leaseUntil: Date.now() + 300000 });
    });
    let outcome: Record<string, unknown>;
    let renewing: Promise<void> | null = null;
    const heartbeat = setInterval(() => {
      if (renewing) return;
      renewing = renewAgentJobLease(db, ctx).catch(() => { clearInterval(heartbeat); }).finally(() => { renewing = null; });
    }, 60000);
    heartbeat.unref();
    try {
      if (job.jobType === 'verification') {
        const { verifyPlanOutcome } = await import('./outcome-watcher');
        outcome = await verifyPlanOutcome(ctx, job.planId, Number(job.deadline || 0));
      } else if (job.jobType === 'plan') {
        await publishProgress([{ type: 'PROGRESS_EVENT', stage: 'executing_plan', text: 'Execut planul confirmat pe server.', step: 0, at: new Date().toISOString() }]);
        const plan = await runPlan(ctx, job.planId, false, PLAN_WORKER_STEPS);
        outcome = plan.status === 'pending'
          ? { status: 'pending', planStatus: 'pending', notBefore: plan.waitUntil || 0, confirmedSteps: plan.results?.length || 0, createdAt: new Date().toISOString() }
          : { status: 'completed', planStatus: plan.status, confirmedSteps: plan.results?.length || 0, completedAt: new Date().toISOString() };
      } else {
        const result = await chatTurn(ctx, { sessionId: job.sessionId, requestId: row.id, prompt: job.prompt }, async event => { events.push(event); await publishProgress(events.slice(-60)); });
        outcome = { status: 'completed', message: result.message, ...(result.message.outputType === 'ERROR_EVENT' ? { planStatus: 'failed' } : {}), completedAt: new Date().toISOString() };
      }
    } catch (error) {
      const errorCategory = failureCategory(error);
      console.error(JSON.stringify({ event: 'jarvis_job_failed', errorCategory }));
      outcome = { status: 'failed', errorCategory, completedAt: new Date().toISOString(), error: 'Comanda nu a fost confirmată. Verifică istoricul înainte de reluare.' };
      if (job.jobType !== 'plan' && job.jobType !== 'verification') {
        try {
          const message = await saveWorkerTurnFailure(ctx, { sessionId: job.sessionId, requestId: row.id, prompt: job.prompt }, claimId);
          if (message) outcome = { ...outcome, message, planStatus: 'failed' };
        } catch (saveError) { console.error(JSON.stringify({ event: 'jarvis_failure_reply_unavailable', errorCategory: failureCategory(saveError) })); }
      }
    }
    clearInterval(heartbeat);
    if (renewing) await renewing;
    await db.runTransaction(async tx => { const fresh = await tx.get(row.ref); if (fresh.data()?.claimId === claimId && fresh.data()?.status === 'running') tx.update(row.ref, outcome); });
  }
  return { processed };
}
