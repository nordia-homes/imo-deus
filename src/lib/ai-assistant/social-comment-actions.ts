import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const base = z.object({ kind: z.literal('existing_operation'), operation: z.enum(['social_like', 'social_reply']), params: z.object({ postId: id, commentId: id }).strict(), query: z.object({}).strict(), body: z.object({ connectionId: id, text: z.string().trim().min(1).max(2000).optional() }).strict() }).strict();
export function socialCommentAction(action: AssistantAction) {
  const parsed = base.safeParse(action);
  return parsed.success && (parsed.data.operation === 'social_reply' ? !!parsed.data.body.text : parsed.data.body.text === undefined);
}
export function socialCommentCommand(prompt: string) {
  const text = normalized(prompt).replace(/[.!?]+$/, '');
  return text === 'raspunde comentariului selectat' ? 'social_reply' : text === 'da like comentariului daca functia este suportata' ? 'social_like' : null;
}
function selection(prompt: string) { return /^(?:comentariu social|raspuns social|răspuns social):\s*([A-Za-z0-9_-]{1,128})(?:\s*\|\s*([\s\S]+))?$/i.exec(prompt.trim()); }
function pending(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialCommentActionRequest')?.rows || []; }
export function socialCommentExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  const rows = pending(history);
  return selection(prompt) && rows.length && typeof rows[0].prompt === 'string' ? rows[0].prompt : prompt;
}
export async function validateSocialCommentAction(ctx: AssistantContext, action: AssistantAction) {
  if (!socialCommentAction(action) || action.kind !== 'existing_operation') throw new Error('Acțiune invalidă');
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    const post = (await tx.get(agency.collection('socialPosts').doc(action.params.postId))).data();
    const connection = (await tx.get(agency.collection('channelConnections').doc(String(action.body.connectionId)))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId || post?.agencyId !== ctx.agencyId || post.deletedAt || post.destinations?.[String(action.body.connectionId)]?.status !== 'published' || connection?.agencyId !== ctx.agencyId || connection.deletedAt || connection.status !== 'connected' || connection.capabilities?.comments?.status !== 'active' || !['messenger', 'instagram'].includes(connection.channel)) throw new Error('Acces indisponibil');
    return action.operation !== 'social_like' || connection.channel === 'messenger';
  });
}
export async function prepareSocialCommentAction(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = socialCommentExecutionPrompt(prompt, history), operation = socialCommentCommand(effective);
  if (!operation) return null;
  const chosen = effective !== prompt ? selection(prompt) : null;
  const previous = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const offered = chosen ? pending(history) : previous?.cards?.find(card => card.source === 'socialComments')?.rows || [];
  const rows = offered.filter(row => id.safeParse(row.id).success && id.safeParse(row.postId).success && id.safeParse(row.connectionId).success).map(row => ({ id: row.id, postId: row.postId, connectionId: row.connectionId, text: row.text, prompt: effective }));
  const actions: AssistantAction[] = [];
  if (!chosen) return { rows, actions, text: rows.length ? operation === 'social_like' ? 'Alege comentariul: „Comentariu social: ID”. Solicitarea autorizează aprecierea dacă integrarea o permite.' : 'Indică comentariul și textul exact: „Răspuns social: ID | textul răspunsului”.' : 'Citește mai întâi comentariile postării pentru a selecta comentariul dorit.' };
  const matches = rows.filter(row => row.id === chosen[1]);
  if (matches.length !== 1) throw new Error('Comentariu neofertat sau ambiguu');
  if (operation === 'social_reply' && !chosen[2]?.trim() || operation === 'social_like' && chosen[2]) return { rows, actions, text: operation === 'social_reply' ? 'Lipsește textul răspunsului. Folosește „Răspuns social: ID | textul răspunsului”.' : 'Pentru apreciere folosește „Comentariu social: ID”, fără text suplimentar.' };
  const row = matches[0];
  const action: AssistantAction = { kind: 'existing_operation', operation, params: { postId: String(row.postId), commentId: String(row.id) }, query: {}, body: { connectionId: row.connectionId, ...(operation === 'social_reply' ? { text: chosen[2].trim() } : {}) } };
  if (!await validateSocialCommentAction(ctx, action)) return { rows: [], actions, text: 'Integrarea existentă nu permite aprecierea comentariilor Instagram. Nu am trimis o apreciere.' };
  actions.push(action);
  return { rows: [], actions, text: operation === 'social_like' ? 'Aplic aprecierea solicitată.' : 'Trimit răspunsul exact solicitat.' };
}
export function socialCommentReceipt(action: AssistantAction, raw: Record<string, any>) {
  if (action.kind !== 'existing_operation' || !socialCommentAction(action) || (action.operation === 'social_like' ? raw.success !== true : !id.safeParse(raw.id).success)) throw new Error('Meta nu a confirmat acțiunea asupra comentariului');
  return { operation: action.operation, executionState: 'succeeded', postId: action.params.postId, commentId: action.params.commentId, connectionId: action.body.connectionId, ...(action.operation === 'social_reply' ? { replyId: raw.id } : {}), evidenceSource: 'provider_response' };
}