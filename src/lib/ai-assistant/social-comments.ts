import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { postInteraction } from '@/lib/communications/social';

export function socialCommentsRequest(prompt: string) {
  return normalized(prompt).replace(/[.!?]+$/, '') === 'arata-mi comentariile recente';
}
export function socialCommentsSelection(prompt: string) {
  return /^postare social[aă]:\s*([A-Za-z0-9_-]{1,180});\s*cont social:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt.trim());
}
export function socialCommentRows(value: unknown) {
  const response = value as { data?: unknown[]; paging?: { next?: unknown } } | null;
  if (!response || !Array.isArray(response.data)) throw new Error('Răspuns Meta invalid');
  const rows = response.data.map(item => {
    const row = item as Record<string, any> | null;
    if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(row.id) || typeof (row.message ?? row.text) !== 'string') throw new Error('Comentariu Meta invalid');
    const rawDate = row.created_time ?? row.timestamp;
    const date = typeof rawDate === 'string' && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate) : null;
    return { id: row.id, name: typeof row.from?.name === 'string' ? row.from.name : typeof row.username === 'string' ? row.username : 'Autor necunoscut',
      text: String(row.message ?? row.text), description: (date ? date.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' }) + ' (ora Bucureștiului)\n' : '') + String(row.message ?? row.text), createdAt: date?.toISOString() ?? null };
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id));
  return { rows, complete: !response.paging?.next };
}
export async function prepareSocialComments(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const selection = socialCommentsSelection(prompt);
  const pending = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialCommentsRequest')?.rows;
  if (!socialCommentsRequest(prompt) && !(selection && pending)) return null;
  const choices = await ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const posts = await tx.get(agency.collection('socialPosts'));
    const connections = await tx.get(agency.collection('channelConnections'));
    const accounts = new Map(connections.docs.map(doc => [doc.id, doc.data()]));
    return posts.docs.flatMap(doc => {
      const post = doc.data();
      if (post.agencyId !== ctx.agencyId || post.deletedAt) return [];
      return Object.entries(post.destinations || {}).flatMap(([connectionId, raw]) => {
        const destination = raw as Record<string, unknown> | null, connection = accounts.get(connectionId);
        if (destination?.status !== 'published' || typeof destination.externalId !== 'string' || !/^\d+(?:_\d+)?$/.test(destination.externalId) || !connection || connection.agencyId !== ctx.agencyId || connection.deletedAt || connection.status !== 'connected' || !['messenger', 'instagram'].includes(connection.channel) || connection.capabilities?.comments?.status !== 'active') return [];
        return [{ id: doc.id + ':' + connectionId, postId: doc.id, connectionId, propertyTitle: typeof post.propertyTitle === 'string' ? post.propertyTitle : 'Proprietate', description: 'Postare socială: ' + doc.id + '; Cont social: ' + connectionId }];
      });
    }).sort((a, b) => a.id.localeCompare(b.id));
  });
  if (!selection) return { choices, comments: null, text: choices.length ? 'Alege postarea și contul din listă: „Postare socială: ID; Cont social: ID”. Voi citi comentariile disponibile prin integrarea Meta.' : 'Nu există postări publicate pe conexiuni active cu acces la comentarii.' };
  if (!pending?.some(row => row.postId === selection[1] && row.connectionId === selection[2]) || !choices.some(row => row.postId === selection[1] && row.connectionId === selection[2])) throw new Error('Selecția nu mai este disponibilă');
  const result = await postInteraction(ctx.adminDb, { uid: ctx.uid, agencyId: ctx.agencyId, role: 'admin' }, selection[1], selection[2], 'comments');
  const comments = socialCommentRows(result);
  return { choices: [], comments, text: 'Am citit ' + comments.rows.length + ' comentarii pentru postarea ' + selection[1] + ', contul ' + selection[2] + '. Sunt ordonate după data disponibilă, în ora Bucureștiului.' + (comments.complete ? '' : ' Meta indică pagini suplimentare; lista reprezintă numai segmentul returnat de integrare (maximum 50).') };
}
