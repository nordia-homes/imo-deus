import type { AssistantContext } from './access';
import { collectionFor } from './access';
import { CommunicationError } from '@/lib/communications/server';
import { getPlan } from './workspace';
import { readPlanOutcomes } from './plan-outcomes';
import { assertAutomationFence } from '@/lib/crm/automation-fence';

// Uses the existing durable queue; these jobs only read domain evidence.
export async function enqueueOutcomeWatch(ctx: AssistantContext, planId: string) {
  const ref = ctx.adminDb.collection('assistantAgentJobs').doc(`verify-${planId}`);
  const plan = (await getPlan(ctx, planId)).data;
  await ctx.adminDb.runTransaction(async tx => {
    const [prior, member] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    if (!prior.exists) tx.create(ref, { jobType: 'verification', planId, sessionId: plan.sessionId, agencyId: ctx.agencyId, userId: ctx.uid, role: ctx.role, status: 'pending', attempts: 0, createdAt: new Date().toISOString(), deadline: Date.now() + 30 * 60000 });
  });
}

export async function verifyPlanOutcome(ctx: AssistantContext, planId: string, deadline: number) {
  const verification = await readPlanOutcomes(ctx, planId);
  const keepWatching = Boolean(verification.pollAfterMs) && Date.now() < deadline;
  const outcome = !keepWatching && verification.pollAfterMs
    ? { ...verification.outcome, state: 'BLOCKED' as const, note: 'Verificarea automată a ajuns la termen. Efectul nu se repetă; verifică starea în modulul dedicat.' }
    : verification.outcome;
  const plan = collectionFor(ctx, 'assistantPlans').doc(planId);
  await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [fresh, member] = await Promise.all([tx.get(plan), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (fresh.data()?.ownerId !== ctx.uid || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    // Do not overwrite a concurrent pause/cancel/continuation with an old read.
    if (fresh.data()?.status === verification.executionStatus) tx.update(plan, { outcome });
  });
  return { status: keepWatching ? 'pending' : 'completed', planStatus: outcome.state, notBefore: keepWatching ? Date.now() + verification.pollAfterMs! : 0, createdAt: new Date().toISOString(), outcome };
}
