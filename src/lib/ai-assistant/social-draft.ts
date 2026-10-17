import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage, type AssistantAction } from './contracts';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
const schema = z.object({ kind: z.literal('existing_operation'), operation: z.literal('social_create'), params: z.object({}).strict(), query: z.object({}).strict(), body: z.object({ propertyId: id, connectionId: id, draft: z.literal(true), contentSource: z.literal('crm') }).strict() }).strict();
export function socialDraftAction(action: AssistantAction) { return schema.safeParse(action).success; }
export function socialDraftRequest(prompt: string) { return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'creeaza o postare sociala pentru proprietatea deschisa'; }
function pending(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialDraftRequest')?.rows || []; }
const selection = (prompt: string) => /^cont pentru ciorna sociala:\s*([A-Za-z0-9_-]{1,180})$/i.exec(normalized(prompt).trim());
export function socialDraftExecutionPrompt(prompt: string, history: AssistantMessage[]) { return selection(prompt) && pending(history).length ? String(pending(history)[0].prompt) : prompt; }
export async function prepareSocialDraft(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = socialDraftExecutionPrompt(prompt, history);
  if (!socialDraftRequest(effective)) return null;
  const chosen = effective !== prompt ? selection(prompt) : null;
  const page = history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows || [];
  const pageId = page.length === 1 ? page[0].id : null;
  const offered = pending(history);
  const propertyId = chosen ? offered[0]?.propertyId : pageId;
  const actions: AssistantAction[] = [];
  if (!id.safeParse(propertyId).success) return { actions, rows: [], text: 'Deschide o proprietate din CRM pentru a crea ciorna socială.' };
  if (chosen && pageId && pageId !== propertyId) throw new Error('Proprietatea deschisă s-a schimbat');
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const property = (await tx.get(agency.collection('properties').doc(String(propertyId)))).data();
    if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId || property.status !== 'Activ') throw new Error('Proprietate indisponibilă');
    if (typeof property.description !== 'string' || !property.description.trim()) return { actions, rows: [], text: 'Completează descrierea proprietății în CRM înainte de crearea ciornei sociale.' };
    const accounts = await tx.get(agency.collection('channelConnections'));
    const rows = accounts.docs.filter(doc => { const row = doc.data(); return row.agencyId === ctx.agencyId && !row.deletedAt && row.status === 'connected' && row.capabilities?.publish?.status === 'active' && ['messenger', 'instagram'].includes(row.channel); }).map(doc => ({ id: doc.id, name: String(doc.data().name || doc.data().channel), channel: doc.data().channel, propertyId, prompt: effective }));
    if (!chosen) return { actions, rows, text: rows.length ? 'Alege contul pentru ciorna salvată: „Cont pentru ciorna sociala: ID”. Voi prelua descrierea și fotografiile actuale din CRM. Crearea ciornei nu publică postarea.' : 'Nu există conturi sociale cu publicare configurată. Configurează conexiunea înainte de crearea ciornei.' };
    // Use the original ID spelling from the offered card, not normalized identifiers.
    const rawId = prompt.trim().split(':').slice(1).join(':').trim();
    if (!offered.some(row => row.id === rawId) || !rows.some(row => row.id === rawId)) throw new Error('Cont neofertat sau indisponibil');
    actions.push({ kind: 'existing_operation', operation: 'social_create', params: {}, query: {}, body: { propertyId, connectionId: rawId, draft: true, contentSource: 'crm' } });
    return { actions, rows: [], text: 'Salvez ciorna în modulul social cu descrierea și fotografiile actuale ale proprietății.' };
  });
}