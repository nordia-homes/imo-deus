import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { diagnoseSocialPost, postInteraction } from '@/lib/communications/social';

export function socialDiagnosticsRequest(prompt: string) {
  return normalized(prompt).replace(/[.!?]+$/, '') === 'ruleaza diagnosticul social';
}
export function socialDiagnosticRows(result: Awaited<ReturnType<typeof diagnoseSocialPost>>) {
  const state = (value: unknown) => value === true ? 'confirmat' : value === false ? 'neconfirmat' : 'necunoscut';
  return [
    { id: 'token', name: 'Validitatea autorizării', description: state(result.tokenValid) },
    { id: 'app', name: 'Aplicația autorizată corespunde', description: state(result.appMatches) },
    { id: 'account', name: 'Postarea apare în primele 100 ale contului', description: state(result.postInAccountList) },
    { id: 'direct', name: 'Postarea poate fi citită direct', description: state(result.directPostReadable) },
    { id: 'permissions', name: 'Permisiuni pentru comentarii', description: result.missingScopes === null ? 'necunoscute' : result.missingScopes.length ? 'lipsesc permisiuni; reautorizează contul cu acces la comentarii' : 'permisiunile cerute sunt prezente' },
    { id: 'identity', name: 'Pagina asociată autorizării', description: result.expectedPageId && result.tokenPageId ? result.expectedPageId === result.tokenPageId ? 'corespunde paginii configurate' : 'diferă de pagina configurată; reconectează contul corect' : 'identitate neconfirmată' },
  ];
}
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
export async function readSocialCommentPages(ctx: AssistantContext, postId: string, connectionId: string) {
  const collected = new Map<string, ReturnType<typeof socialCommentRows>['rows'][number]>();
  const seen = new Set<string>();
  let after: string | undefined, expectedId: string | undefined;
  let complete = false, stopReason = 'limita de 10 pagini';
  for (let page = 0; page < 10; page++) {
    // Revalidate between provider calls; a changed post must not mix two comment threads.
    const externalId = await ctx.adminDb.runTransaction(async tx => {
      const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
      const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
      const post = (await tx.get(agency.collection('socialPosts').doc(postId))).data();
      const connection = (await tx.get(agency.collection('channelConnections').doc(connectionId))).data();
      const destination = post?.destinations?.[connectionId];
      if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId || post?.agencyId !== ctx.agencyId || post.deletedAt || destination?.status !== 'published' || typeof destination.externalId !== 'string' || !/^\d+(?:_\d+)?$/.test(destination.externalId) || connection?.agencyId !== ctx.agencyId || connection.deletedAt || connection.status !== 'connected' || !['messenger', 'instagram'].includes(connection.channel) || connection.capabilities?.comments?.status !== 'active') throw new Error('Accesul la comentarii s-a schimbat');
      return destination.externalId as string;
    });
    if (expectedId && expectedId !== externalId) throw new Error('Destinația postării s-a schimbat');
    expectedId = externalId;
    let result: any, segment: ReturnType<typeof socialCommentRows>;
    try {
      result = await postInteraction(ctx.adminDb, { uid: ctx.uid, agencyId: ctx.agencyId, role: 'admin' }, postId, connectionId, 'comments', undefined, after);
      segment = socialCommentRows(result);
    } catch (error) {
      if (!page) throw error;
      stopReason = 'următoarea pagină nu a putut fi citită'; break;
    }
    for (const row of segment.rows) if (!collected.has(row.id)) collected.set(row.id, row);
    if (segment.complete) { complete = true; break; }
    const cursor = result.paging?.cursors?.after;
    if (typeof cursor !== 'string' || !cursor.length || cursor.length > 2048) { stopReason = 'cursorul paginii următoare lipsește sau este invalid'; break; }
    if (seen.has(cursor)) { stopReason = 'Meta a repetat cursorul paginii'; break; }
    seen.add(cursor); after = cursor;
  }
  return { rows: [...collected.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id)), complete, stopReason };
}
export async function prepareSocialComments(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const selection = socialCommentsSelection(prompt);
  const pendingCard = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => ['socialCommentsRequest', 'socialDiagnosticsRequest'].includes(card.source));
  const pending = pendingCard?.rows;
  const diagnostic = socialDiagnosticsRequest(prompt) || Boolean(selection && pendingCard?.source === 'socialDiagnosticsRequest');
  if (!socialCommentsRequest(prompt) && !socialDiagnosticsRequest(prompt) && !(selection && pending)) return null;
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
  if (!selection) return { diagnostic, choices, comments: null, text: choices.length ? 'Alege postarea și contul din listă: „Postare socială: ID; Cont social: ID”. ' + (diagnostic ? 'Voi verifica accesul Meta la postarea selectată.' : 'Voi citi comentariile disponibile prin integrarea Meta.') : 'Nu există postări publicate pe conexiuni active cu acces la comentarii.' };
  if (!pending?.some(row => row.postId === selection[1] && row.connectionId === selection[2]) || !choices.some(row => row.postId === selection[1] && row.connectionId === selection[2])) throw new Error('Selecția nu mai este disponibilă');
  if (diagnostic) {
    const result = await diagnoseSocialPost(ctx.adminDb, { uid: ctx.uid, agencyId: ctx.agencyId, role: 'admin' }, selection[1], selection[2]);
    const rows = socialDiagnosticRows(result);
    return { diagnostic, choices: [], comments: { rows, complete: true }, text: 'Diagnosticul pentru postarea ' + selection[1] + ', contul ' + selection[2] + ':\n' + rows.map(row => row.name + ': ' + row.description).join('\n') + '\nDiagnosticul verifică autorizarea și accesul la postare. Nu verifică citirea comentariilor și nu reconectează contul. Absența din primele 100 de postări nu dovedește ștergerea.' };
  }
  const comments = await readSocialCommentPages(ctx, selection[1], selection[2]);
  return { diagnostic, choices: [], comments, text: 'Am citit ' + comments.rows.length + ' comentarii pentru postarea ' + selection[1] + ', contul ' + selection[2] + '. Sunt ordonate după data disponibilă, în ora Bucureștiului.' + (comments.complete ? '' : ' Lista este incompletă: ' + comments.stopReason + '.') };
}
