import { createHash, randomUUID } from 'node:crypto';
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
type CommentCheckpoint = { after: string; externalId: string; seen: string[] };
export async function readSocialCommentPages(ctx: AssistantContext, postId: string, connectionId: string, checkpoint?: CommentCheckpoint) {
  const collected = new Map<string, ReturnType<typeof socialCommentRows>['rows'][number]>();
  const seen = new Set<string>(checkpoint?.seen || []);
  let after: string | undefined = checkpoint?.after, expectedId: string | undefined = checkpoint?.externalId;
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
    if (typeof cursor !== 'string' || !cursor.length || cursor.length > 2048) { after = undefined; stopReason = 'cursorul paginii următoare lipsește sau este invalid'; break; }
    if (seen.has(createHash('sha256').update(cursor).digest('hex'))) { after = undefined; stopReason = 'Meta a repetat cursorul paginii'; break; }
    seen.add(createHash('sha256').update(cursor).digest('hex')); after = cursor;
  }
  return { rows: [...collected.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || a.id.localeCompare(b.id)), complete, stopReason, checkpoint: !complete && after && expectedId && seen.size < 1000 ? { after, externalId: expectedId, seen: [...seen] } : null };
}
export async function saveCommentContinuation(ctx: AssistantContext, postId: string, connectionId: string, checkpoint: CommentCheckpoint | null) {
  if (!checkpoint) return null;
  const id = randomUUID();
  await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantResultSets').doc(id).set({ kind: 'social_comment_continuation', ownerId: ctx.uid, agencyId: ctx.agencyId, postId, connectionId, checkpoint, expiresAt: Date.now() + 60 * 60 * 1000 });
  return { id, description: 'Scrie „Continuă comentariile” pentru următorul segment. Reluarea este disponibilă o oră.' };
}
export async function prepareSocialComments(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  if (normalized(prompt).replace(/[.!?]+$/, '') === 'continua comentariile') {
    const pointer = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialCommentsContinuation')?.rows[0]?.id;
    if (typeof pointer !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(pointer)) return { diagnostic: false, choices: [], comments: null, text: 'Nu există o citire de comentarii de continuat în ultimul răspuns.' };
    const saved = (await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantResultSets').doc(pointer).get()).data();
    if (!saved || saved.kind !== 'social_comment_continuation' || !Number.isFinite(saved.expiresAt) || saved.ownerId !== ctx.uid || saved.agencyId !== ctx.agencyId || saved.expiresAt <= Date.now()) throw new Error('Reluare indisponibilă');
    const comments = await readSocialCommentPages(ctx, saved.postId, saved.connectionId, saved.checkpoint);
    const continuation = await saveCommentContinuation(ctx, saved.postId, saved.connectionId, comments.checkpoint);
    return { diagnostic: false, choices: [], comments, continuation, text: 'Am citit următorul segment: ' + comments.rows.length + ' comentarii pentru postarea ' + saved.postId + '. Rezultatele anterioare rămân în conversație.' + (comments.complete ? ' Nu mai există pagini indicate de Meta.' : ' Lista este incompletă: ' + comments.stopReason + '.') + (continuation ? ' Scrie „Continuă comentariile” pentru a relua.' : '') };
  }
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
  const continuation = await saveCommentContinuation(ctx, selection[1], selection[2], comments.checkpoint);
  return { diagnostic, choices: [], comments, continuation, text: 'Am citit ' + comments.rows.length + ' comentarii pentru postarea ' + selection[1] + ', contul ' + selection[2] + '. Sunt ordonate după data disponibilă, în ora Bucureștiului.' + (comments.complete ? '' : ' Lista este incompletă: ' + comments.stopReason + '.') };
}
