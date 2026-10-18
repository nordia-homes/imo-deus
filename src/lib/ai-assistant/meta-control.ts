import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
const requests: Record<string, string> = {
 'pune campania pe pauza': 'pause',
 'opreste campania daca am confirmat explicit': 'confirm',
 'nu o sterge daca am spus doar pauza': 'protect',
 'nu opri celelalte campanii': 'protect',
};
export const metaControlRequest = (prompt: string) => requests[normalized(prompt).trim().replace(/[.!?]+$/, '')] || null;
const last = (history: AssistantMessage[]) => history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
const pending = (history: AssistantMessage[]) => last(history)?.cards?.find(card => card.source === 'metaPauseSelection');
const selection = (prompt: string) => /^Confirm pauza Meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
export function metaControlExecutionPrompt(prompt: string, history: AssistantMessage[]) {
 return selection(prompt) && pending(history)?.rows.length ? 'Pune campania pe pauză.' : prompt;
}
const shape = z.object({ kind: z.literal('existing_operation'), operation: z.literal('meta_campaign_pause'), params: z.object({ campaignId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/) }).strict(), query: z.object({}).strict(), body: z.object({ jarvisPause: z.literal(true), propertyId: z.string().regex(/^[A-Za-z0-9_-]{1,180}$/), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict();
export const metaControlAction = (action: AssistantAction) => shape.safeParse(action).success;
export async function prepareMetaControl(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
 const answer = selection(prompt), offered = pending(history);
 const mode = answer && offered ? 'pause' : metaControlRequest(prompt);
 if (!mode && !answer) return null;
 if (!mode) throw new Error('Selecție expirată');
 const actions: AssistantAction[] = [];
 const page = history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows;
 const propertyId = page?.length === 1 ? String(page[0].id) : null;
 return ctx.adminDb.runTransaction(async tx => {
  const member = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
  if (member?.agencyId !== ctx.agencyId || member.role !== ctx.role || !['agent','admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  if (mode === 'protect') return { actions, source: offered?.rows.length ? 'metaPauseSelection' : 'metaPauseReview', rows: offered?.rows || [], text: 'Comanda de pauză nu șterge campania și se aplică exclusiv campaniei selectate. Prin această cerere nu am modificat nicio campanie.' };
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const snapshot = await tx.get(agency.collection('metaCampaignDrafts'));
  const rows = snapshot.docs.filter(doc => {
   const row = doc.data(); return row.agencyId === ctx.agencyId && !row.deletedAt && ['published','paused','error'].includes(row.status) && /^\d+$/.test(String(row.metaCampaignId || '')) && (!propertyId || row.propertyId === propertyId);
  }).map(doc => ({ id: doc.id, propertyId: String(doc.data().propertyId), campaignName: String(doc.data().campaignName || 'Campanie fără denumire'), status: String(doc.data().status), campaignRevision: metaDraftRevision(doc.data()), contextPropertyId: propertyId }));
  const previous = last(history);
  const reviewed = previous?.cards?.find(card => card.source === 'metaCampaignReview')?.rows;
  const receipt = previous?.cards?.find(card => card.source === 'autonomy')?.rows?.[0]?.result as Record<string, unknown> | undefined;
  const inferred = reviewed?.length === 1 ? reviewed[0].id : receipt?.campaignId;
  const target = answer ? rows.find(row => row.id === answer[1]) : inferred ? rows.find(row => row.id === inferred) : rows.length === 1 ? rows[0] : undefined;
  if (answer) {
   const selected = offered?.rows.find(row => row.id === answer[1]);
   if (!selected || !target || selected.contextPropertyId !== propertyId || selected.campaignRevision !== target.campaignRevision || selected.propertyId !== target.propertyId) throw new Error('Campania selectată s-a schimbat');
  }
  if (!target || mode === 'confirm') return { actions, source: 'metaPauseSelection', rows: target ? [target] : rows, text: rows.length ? 'Selectează campania și confirmă pauza folosind butonul din card. Verific rezultatul la Meta; celelalte campanii rămân nemodificate.' : 'Nu există o campanie publicată eligibilă în context. Drafturile nu se pun în pauză.' };
  const property = (await tx.get(agency.collection('properties').doc(target.propertyId))).data();
  if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId) throw new Error('Proprietate indisponibilă');
  actions.push({ kind: 'existing_operation', operation: 'meta_campaign_pause', params: { campaignId: target.id }, query: {}, body: { jarvisPause: true, propertyId: target.propertyId, expectedRevision: target.campaignRevision } });
  return { actions, source: 'metaPauseReview', rows: [], text: 'Pun în pauză campania ' + target.id + ' și verific confirmarea la Meta.' };
 });
}
