import type { Property } from '@/lib/types';
import type { RemovalContext } from './service';

export async function withdrawPortal(portal: string, ctx: RemovalContext, property: Property): Promise<boolean> {
  if (ctx.demo) throw new Error('External calls are disabled in demo.');
  if (portal === 'imobiliare') {
    const { withdrawImobiliareForRemoval } = await import('@/lib/imobiliare');
    return withdrawImobiliareForRemoval(ctx.agencyId, property);
  }
  if (portal === 'storia') {
    const { withdrawStoriaForRemoval } = await import('@/lib/storia');
    return withdrawStoriaForRemoval(ctx.agencyId, property);
  }
  if (portal === 'publi24') {
    const { checkOrUnpublish } = await import('@/lib/romimo/service');
    const saved = (await ctx.db.collection('agencyPrivateIntegrations').doc(`${ctx.agencyId}__romimo`).collection('operations').doc(ctx.propertyId).get()).data();
    if (!saved?.submitted) throw new Error('Missing authoritative Romimo association.');
    if (saved.lastAction === 'deleted' && saved.state === 'unpublished') return true;
    // Resolve uncertain deletes before retrying. A bare 404 is not confirmation.
    if (['deleting', 'delete-unconfirmed', 'delete-uncertain', 'checked', 'not-found'].includes(saved.lastAction)) {
      if ((await checkOrUnpublish(ctx, ctx.propertyId, false)).state === 'unpublished') return true;
    }
    return (await checkOrUnpublish(ctx, ctx.propertyId, true)).state === 'unpublished';
  }
  return false;
}
