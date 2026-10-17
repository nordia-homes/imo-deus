import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { MAX_PLAN_ACTIONS } from './plan-limits';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
const schema = z.object({ kind: z.literal('existing_operation'), operation: z.literal('social_destination_remove'), params: z.object({ postId: id, connectionId: id }).strict(), query: z.object({}).strict(), body: z.object({ remote: z.literal(true), expectedExternalId: z.string().regex(/^[0-9]+_[0-9]+$/) }).strict() }).strict();
export function socialRemoveAction(action: AssistantAction) { return schema.safeParse(action).success; }
export function socialRemoveRequest(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'sterge postarea numai dupa confirmare' ? 'post' : text === 'elimina doar destinatia selectata' ? 'destination' : null;
}
function selection(prompt: string) {
  const post = /^confirm[aă] [șs]tergerea post[aă]rii sociale:\s*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
  if (post) return { postId: post[1], connectionId: null, mode: 'post' };
  const destination = /^elimin[aă] destina[țt]ia social[aă]:\s*([A-Za-z0-9_-]{1,180})\s*\|\s*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
  return destination ? { postId: destination[1], connectionId: destination[2], mode: 'destination' } : null;
}
function pending(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialRemoveRequest')?.rows || []; }
export function socialRemoveExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  const chosen = selection(prompt), rows = pending(history);
  return chosen && rows.length && chosen.mode === socialRemoveRequest(String(rows[0].prompt)) ? String(rows[0].prompt) : prompt;
}
export async function prepareSocialRemove(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = socialRemoveExecutionPrompt(prompt, history), mode = socialRemoveRequest(effective);
  if (!mode) return null;
  const chosen = effective !== prompt ? selection(prompt) : null;
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const posts = await tx.get(agency.collection('socialPosts'));
    const accounts = await tx.get(agency.collection('channelConnections'));
    const rows = posts.docs.flatMap(doc => {
      const post = doc.data(); if (post.agencyId !== ctx.agencyId || post.deletedAt) return [];
      const entries = Object.entries(post.destinations || {}) as [string, Record<string, any>][];
      const active = entries.filter(([, entry]) => entry.status !== 'deleted');
      const eligible = active.filter(([connectionId, entry]) => {
        const account = accounts.docs.find(row => row.id === connectionId)?.data();
        return entry.status === 'published' && entry.channel === 'messenger' && typeof entry.externalId === 'string' && /^[0-9]+_[0-9]+$/.test(entry.externalId) && account?.agencyId === ctx.agencyId && !account.deletedAt && account.status === 'connected' && account.channel === 'messenger' && account.capabilities?.publish?.status === 'active' && entry.externalId.split('_')[0] === account.externalId;
      });
      if (mode === 'post' && (eligible.length !== active.length || active.length > MAX_PLAN_ACTIONS)) return [];
      return eligible.map(([connectionId, entry]) => ({ id: doc.id + ':' + connectionId, postId: doc.id, connectionId, propertyTitle: String(post.propertyTitle || 'Proprietate'), externalId: entry.externalId as string, prompt: effective }));
    });
    const actions: AssistantAction[] = [];
    if (!chosen) return { actions, rows, text: rows.length ? mode === 'post' ? 'Selectează și confirmă postarea: „Confirmă ștergerea postării sociale: ID_POSTARE”. Voi șterge destinațiile Facebook publicate ale postării alese.' : 'Selectează destinația: „Elimină destinația socială: ID_POSTARE | ID_CONT”. Cererea autorizează ștergerea acelei destinații Facebook; celelalte rămân nemodificate.' : 'Nu există destinații eligibile. Ștergerea de la distanță este disponibilă aici doar pentru paginile Facebook conectate; nu confirm automat ștergerea Instagram.' };
    const selected = rows.filter(row => row.postId === chosen.postId && (mode === 'post' || row.connectionId === chosen.connectionId));
    const offered = pending(history).filter(row => row.postId === chosen.postId && (mode === 'post' || row.connectionId === chosen.connectionId));
    if (!selected.length || selected.length !== offered.length || selected.some(row => !offered.some(old => old.connectionId === row.connectionId && old.externalId === row.externalId))) throw new Error('Destinațiile s-au schimbat sau nu au fost oferite');
    for (const row of selected) actions.push({ kind: 'existing_operation', operation: 'social_destination_remove', params: { postId: row.postId, connectionId: row.connectionId }, query: {}, body: { remote: true, expectedExternalId: row.externalId } });
    return { actions, rows: [], text: 'Execut ștergerea destinațiilor selectate și verific separat confirmările Meta.' };
  });
}
export async function executeSocialRemove(ctx: AssistantContext, action: AssistantAction) {
  const input = schema.parse(action);
  const { removePublishedSocialPost } = await import('@/lib/communications/social');
  await removePublishedSocialPost(ctx.adminDb, { uid: ctx.uid, agencyId: ctx.agencyId, role: ctx.role }, input.params.postId, input.params.connectionId, true, input.body.expectedExternalId);
  const post = (await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('socialPosts').doc(input.params.postId).get()).data();
  const destination = post?.destinations?.[input.params.connectionId];
  if (post?.agencyId !== ctx.agencyId || destination?.status !== 'deleted' || destination.externalId !== input.body.expectedExternalId || destination.removal !== 'meta') throw new Error('Ștergerea persistată nu este confirmată');
  return { operation: 'social_destination_remove', postId: input.params.postId, connectionId: input.params.connectionId, externalId: destination.externalId, executionState: 'succeeded', deletionConfirmed: true, evidenceSource: 'meta_delete_and_persisted_destination' };
}