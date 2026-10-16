import type { AssistantContext } from './access';
import { normalized } from './contracts';

export function socialPostSearchRequest(prompt: string) {
  const match = normalized(prompt).match(/^(?:gaseste|arata-mi) postarile proprietatii (?:din|numite) (.+?)[.!?]*$/);
  return match?.[1]?.replace(/[„”"«»]/g, '').trim() || null;
}
export function socialPropertyMatches(query: string, values: unknown[]) {
  const words = normalized(query).match(/[\p{L}\p{N}]+/gu) || [];
  const available = new Set(values.filter(value => typeof value === 'string').flatMap(value => normalized(value).match(/[\p{L}\p{N}]+/gu) || []));
  return words.length > 0 && words.every(word => available.has(word));
}
export async function searchSocialPosts(ctx: AssistantContext, query: string) {
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    // Keep the same permission boundary as the existing social-post history API.
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== 'admin' || ctx.role !== 'admin') throw new Error('Istoricul postărilor sociale este disponibil administratorului.');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const properties = await tx.get(agency.collection('properties'));
    const byId = new Map(properties.docs.map(doc => [doc.id, doc.data()]));
    // Search the complete snapshot: limiting before matching loses older posts.
    const posts = await tx.get(agency.collection('socialPosts'));
    const rows = posts.docs.flatMap(doc => {
      const post = doc.data();
      if (post.agencyId !== ctx.agencyId || post.deletedAt) return [];
      const property = typeof post.propertyId === 'string' ? byId.get(post.propertyId) : undefined;
      if (property && (property.deletedAt || (property.agencyId && property.agencyId !== ctx.agencyId))) return [];
      const currentMatch = property && socialPropertyMatches(query, [property.title, property.location, property.address]);
      const savedMatch = socialPropertyMatches(query, [post.propertyTitle]);
      if (!currentMatch && !savedMatch) return [];
      const statusLabels: Record<string, string> = { draft: 'ciornă', queued: 'în așteptare', processing: 'în procesare', published: 'publicată', needs_review: 'necesită verificare', deleted: 'ștearsă', cancelled: 'anulată' };
      const status = Object.hasOwn(statusLabels, post.status) ? post.status as string : 'unknown';
      const title = typeof property?.title === 'string' ? property.title : typeof post.propertyTitle === 'string' ? post.propertyTitle : 'Proprietate';
      return [{ id: doc.id, propertyId: typeof post.propertyId === 'string' ? post.propertyId : null, propertyTitle: title, status,
        description: 'Postare ' + doc.id + ': ' + (statusLabels[status] || 'stare necunoscută') + (currentMatch ? '. Potrivire în datele CRM actuale.' : '. Potrivire în titlul salvat la creare.'),
        createdAt: typeof post.createdAt === 'string' && Number.isFinite(Date.parse(post.createdAt)) ? new Date(post.createdAt).toISOString() : null }];
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
    return { rows, text: 'Am găsit ' + rows.length + ' postări pentru „' + query + '” în istoricul social al agenției. Căutarea include titlul salvat al postării și titlul, zona și adresa actuală din CRM. Stările sunt cele salvate în aplicație; nu am verificat live publicarea în Meta.' };
  });
}
