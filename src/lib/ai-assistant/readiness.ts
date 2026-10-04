import type { AssistantContext } from './access';
export async function automationReadiness(ctx: Pick<AssistantContext, 'adminDb'>) {
  if (!process.env.AI_ASSISTANT_WORKER_SECRET) return { configured: false, active: false, lastSuccessAt: null };
  const state = (await ctx.adminDb.collection('assistantWorkerState').doc('global').get()).data();
  const lastSuccessAt = typeof state?.lastSuccessAt === 'string' ? state.lastSuccessAt : null;
  const age = lastSuccessAt ? Date.now() - Date.parse(lastSuccessAt) : NaN;
  return { configured: true, active: Number.isFinite(age) && age >= 0 && age < 15 * 60000, lastSuccessAt };
}
