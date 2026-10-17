import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { socialDraftRevision } from '@/lib/communications/social-content';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
const shape = z.object({ kind: z.literal('existing_operation'), operation: z.literal('social_publish'), params: z.object({ postId: id }).strict(), query: z.object({}).strict(), body: z.object({ immediate: z.literal(true), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict();
export function socialPublishAction(action: AssistantAction) { return shape.safeParse(action).success; }
export function socialPublishRequest(prompt: string) { return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'publica postarea dupa approval'; }
const selection = (prompt: string) => /^public[aă] postarea social[aă]:\s*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
function pending(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialPublishRequest')?.rows || []; }
export function socialPublishExecutionPrompt(prompt: string, history: AssistantMessage[]) { return selection(prompt) && pending(history).length ? String(pending(history)[0].prompt) : prompt; }
export async function prepareSocialPublish(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = socialPublishExecutionPrompt(prompt, history);
  if (!socialPublishRequest(effective)) return null;
  const chosen = effective !== prompt ? selection(prompt) : null;
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const posts = await tx.get(ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('socialPosts'));
    const rows = posts.docs.filter(doc => { const post = doc.data(); return post.agencyId === ctx.agencyId && !post.deletedAt && post.status === 'draft' && post.contentSource === 'crm'; }).map(doc => ({ id: doc.id, propertyTitle: String(doc.data().propertyTitle || 'Proprietate'), prompt: effective, revision: socialDraftRevision(doc.data()) }));
    const actions: AssistantAction[] = [];
    if (!chosen) return { rows, actions, text: rows.length ? 'Selectează și confirmă ciorna de publicat: „Publică postarea socială: ID”. Public descrierea și fotografiile salvate din CRM, pe contul ciornei.' : 'Nu există o ciornă CRM eligibilă pentru publicare.' };
    const offered = pending(history).find(row => row.id === chosen[1]), current = rows.find(row => row.id === chosen[1]);
    if (!offered || !current || offered.revision !== current.revision) throw new Error('Ciorna s-a schimbat sau nu a fost oferită');
    actions.push({ kind: 'existing_operation', operation: 'social_publish', params: { postId: chosen[1] }, query: {}, body: { immediate: true, expectedRevision: current.revision } });
    return { rows: [], actions, text: 'Public ciorna selectată și verific rezultatul salvat de worker.' };
  });
}