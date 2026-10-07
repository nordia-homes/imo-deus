import type { AssistantContext } from './access';
import { collectionFor } from './access';
import { CommunicationError } from '@/lib/communications/server';
import { getPlan } from './workspace';
import { readPlanOutcomes } from './plan-outcomes';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { createHash } from 'node:crypto';

// Uses the existing durable queue; these jobs only read domain evidence.
export async function enqueueOutcomeWatch(ctx: AssistantContext, planId: string) {
  const identity = createHash('sha256').update(JSON.stringify([ctx.agencyId, ctx.uid, planId])).digest('hex');
  const ref = ctx.adminDb.collection('assistantAgentJobs').doc(`verify-${identity}`);
  const plan = (await getPlan(ctx, planId)).data;
  await ctx.adminDb.runTransaction(async tx => {
    const [prior, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    if (!prior.exists) tx.create(ref, { jobType: 'verification', planId, sessionId: plan.sessionId, agencyId: ctx.agencyId, userId: ctx.uid, role: ctx.role, status: 'pending', attempts: 0, createdAt: new Date().toISOString(), deadline: Date.now() + 30 * 60000 });
  });
}

export async function verifyPlanOutcome(ctx: AssistantContext, planId: string, deadline: number) {
  const expired = () => !Number.isFinite(deadline) || Date.now() >= deadline;
  const verification = await readPlanOutcomes(ctx, planId);
  const watchRequested = Boolean(verification.pollAfterMs) && !['paused', 'cancelled'].includes(verification.executionStatus);
  const keepWatching = watchRequested && !expired();
  const outcome = !keepWatching && watchRequested
    ? { ...verification.outcome, state: 'BLOCKED' as const, note: 'Verificarea automată a ajuns la termen. Efectul nu se repetă; verifică starea în modulul dedicat.' }
    : verification.outcome;
  const plan = collectionFor(ctx, 'assistantPlans').doc(planId);
  const persisted = await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [fresh, member] = await Promise.all([tx.get(plan), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (fresh.data()?.ownerId !== ctx.uid || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    // Status alone is insufficient: pause/resume or another reconciliation can
    // return to the same status while this provider read was in flight.
    const revision = fresh.updateTime ? `${fresh.updateTime.seconds}:${fresh.updateTime.nanoseconds}` : null;
    if (!revision || revision !== verification.planRevision || fresh.data()?.status !== verification.executionStatus) return { saved: false, status: fresh.data()?.status };
    tx.update(plan, { outcome });
    return { saved: true, status: fresh.data()?.status };
  });
  if (!persisted.saved) {
    const stopped = ['paused', 'cancelled'].includes(persisted.status);
    const deadlineReached = expired();
    return { status: stopped || deadlineReached ? 'completed' : 'pending', planStatus: stopped ? persisted.status.toUpperCase() : deadlineReached ? 'BLOCKED' : 'RUNNING', notBefore: stopped || deadlineReached ? 0 : Date.now() + 15000, createdAt: new Date().toISOString(), ...(deadlineReached && !stopped ? { note: 'Verificarea a expirat în timpul unei modificări concurente. Planul curent nu a fost suprascris; verifică starea în modulul dedicat.' } : {}) };
  }
  return { status: keepWatching ? 'pending' : 'completed', planStatus: outcome.state, notBefore: keepWatching ? Date.now() + verification.pollAfterMs! : 0, createdAt: new Date().toISOString(), outcome };
}
