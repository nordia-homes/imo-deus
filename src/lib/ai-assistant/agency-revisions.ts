import type { AssistantContext } from './access';
import type { AssistantAction } from './contracts';

export async function bindAgencyRevisions(ctx: AssistantContext, actions: AssistantAction[]): Promise<AssistantAction[]> {
  if (!actions.some(action => action.kind === 'update_agency' && action.expectedUpdatedAt === undefined)) return actions;
  const snapshot = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).get();
  if (!snapshot.exists) throw new Error('Agenția nu există.');
  const revision = snapshot.data()?.updatedAt || null;
  return actions.map(action => action.kind === 'update_agency' && action.expectedUpdatedAt === undefined ? { ...action, expectedUpdatedAt: revision } : action);
}
