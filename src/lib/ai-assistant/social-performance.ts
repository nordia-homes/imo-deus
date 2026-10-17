import type { AssistantContext } from './access';
import { normalized } from './contracts';
import { postInteraction } from '@/lib/communications/social';

export function socialPerformanceRequest(prompt: string) {
  return normalized(prompt).replace(/[.!?]+$/, '') === 'compara performanta postarilor disponibile';
}
export function socialPerformanceMetrics(channel: string, raw: any) {
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  return { likes: count(channel === 'instagram' ? raw?.like_count : raw?.likes?.summary?.total_count), comments: count(channel === 'instagram' ? raw?.comments_count : raw?.comments?.summary?.total_count), shares: channel === 'instagram' ? null : count(raw?.shares?.count) };
}
export async function compareSocialPerformance(ctx: AssistantContext) {
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const candidates = await ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const posts = await tx.get(agency.collection('socialPosts'));
    const connections = await tx.get(agency.collection('channelConnections'));
    const accounts = new Map(connections.docs.map(doc => [doc.id, doc.data()]));
    return posts.docs.flatMap(doc => {
      const post = doc.data();
      if (post.agencyId !== ctx.agencyId || post.deletedAt) return [];
      return Object.entries(post.destinations || {}).flatMap(([connectionId, raw]) => {
        const destination = raw as any, account = accounts.get(connectionId);
        if (destination?.status !== 'published' || typeof destination.externalId !== 'string' || !/^\d+(?:_\d+)?$/.test(destination.externalId) || !account || account.agencyId !== ctx.agencyId || account.deletedAt || !['messenger', 'instagram'].includes(account.channel)) return [];
        return [{ id: doc.id + ':' + connectionId, postId: doc.id, connectionId, externalId: destination.externalId as string, channel: account.channel as string, propertyTitle: typeof post.propertyTitle === 'string' ? post.propertyTitle : 'Proprietate', createdAt: typeof post.createdAt === 'string' && Number.isFinite(Date.parse(post.createdAt)) ? new Date(post.createdAt).toISOString() : '' }];
      });
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  });
  const rows: Record<string, unknown>[] = [];
  for (const candidate of candidates.slice(0, 20)) {
    const eligible = await ctx.adminDb.runTransaction(async tx => {
      const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
      if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces revocat');
      const post = (await tx.get(agency.collection('socialPosts').doc(candidate.postId))).data();
      const connection = (await tx.get(agency.collection('channelConnections').doc(candidate.connectionId))).data();
      return post?.agencyId === ctx.agencyId && !post.deletedAt && post.destinations?.[candidate.connectionId]?.status === 'published' && post.destinations[candidate.connectionId].externalId === candidate.externalId && connection?.agencyId === ctx.agencyId && !connection.deletedAt && connection.status === 'connected' && connection.channel === candidate.channel && connection.capabilities?.insights?.status === 'active';
    });
    let metrics = { likes: null, comments: null, shares: null } as ReturnType<typeof socialPerformanceMetrics>;
    let available = false;
    if (eligible) {
      try { metrics = socialPerformanceMetrics(candidate.channel, await postInteraction(ctx.adminDb, { uid: ctx.uid, agencyId: ctx.agencyId, role: 'admin' }, candidate.postId, candidate.connectionId, 'insights')); available = true; }
      catch { /* Keep the failed destination visible, without exposing provider errors. */ }
    }
    const label = (value: number | null) => value === null ? 'necunoscut' : String(value);
    const description = (candidate.channel === 'instagram' ? 'Instagram' : 'Facebook') + ': aprecieri ' + label(metrics.likes) + ', comentarii ' + label(metrics.comments) + (candidate.channel === 'instagram' ? '. Distribuirile nu sunt furnizate de această integrare pentru Instagram.' : ', distribuiri ' + label(metrics.shares) + '.') + (available ? '' : ' Indicatorii nu au putut fi citiți; verifică accesul și conexiunea.');
    rows.push({ id: candidate.id, postId: candidate.postId, connectionId: candidate.connectionId, propertyTitle: candidate.propertyTitle, channel: candidate.channel, ...metrics, available, description });
  }
  return { rows, complete: candidates.length <= 20, text: 'Comparație pentru ' + rows.length + ' destinații publicate' + (candidates.length > 20 ? ' dintre cele ' + candidates.length + ' disponibile (cele mai recente 20)' : '') + '. Indicatorii sunt citiți acum, dar sunt totaluri cumulative, nu valori pentru un interval comun. Lipsa unei valori nu înseamnă zero. Integrarea nu furnizează aici acoperire, impresii sau conversii; nu calculez rate de conversie și nu deduc ce platformă este mai performantă din indicatori diferiți.' };
}