import { z } from 'zod';
import { createHash } from 'node:crypto';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import type { AssistantContext } from './access';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { buildMetaCampaignDraft } from '@/lib/meta-campaign-draft';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';
import type { Agency, Property, MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus } from '@/lib/types';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
const patchSchema = z.object({ budgetAmount: z.number().finite().min(10).max(1000000).optional(), budgetType: z.enum(['daily','lifetime']).optional(), currency: z.enum(['EUR','RON','USD']).optional(), durationDays: z.number().int().min(1).max(365).optional(), mainPhoto: z.literal(true).optional() }).strict();
const actionSchema = z.object({ kind: z.literal('existing_operation'), operation: z.enum(['meta_campaign_draft','meta_campaign_update']), params: z.object({}).strict(), query: z.object({}).strict(), body: z.object({ jarvisDraft: z.literal(true), propertyId: id, propertyRevision: z.string().length(64), campaignId: id.optional(), campaignRevision: z.string().length(64).optional(), patch: patchSchema }).strict() }).strict();
type DraftAction = z.infer<typeof actionSchema>;
export const metaDraftRevision = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function metaDraftAction(action: AssistantAction) { const parsed=actionSchema.safeParse(action); return parsed.success && (parsed.data.operation === 'meta_campaign_draft' ? !parsed.data.body.campaignId && !parsed.data.body.campaignRevision : Boolean(parsed.data.body.campaignId && parsed.data.body.campaignRevision)); }
const requests: Record<string,string> = { 'creeaza draft de campanie meta pentru proprietate': 'create', 'pregateste o campanie de sapte zile': 'seven', 'pregateste campania cu buget total 300 €': 'total', 'pregateste campania pentru proprietatea aleasa': 'create', 'seteaza bugetul campaniei la suma ceruta': 'budget', 'actualizeaza campania draft': 'update', 'foloseste fotografia principala a proprietatii': 'photo', 'nu publica draftul inca': 'hold', 'nu modifica bugetul fara approval daca politica il cere': 'hold', 'cere-mi aprobarea inainte sa cheltui bani': 'hold' };
export function metaDraftRequest(prompt: string) { return requests[normalized(prompt).trim().replace(/[.!?]+$/, '')] || null; }
function last(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1); }
function pending(history: AssistantMessage[]) { return last(history)?.cards?.find(card => card.source === 'metaDraftSelection')?.rows || []; }
function reply(prompt: string) {
 const raw=prompt.trim();
 const selected=/^draft meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(raw);
 if (selected) return { selected: selected[1], patch: null };
 const values=/^parametri draft meta:[ ]*buget ([0-9]+(?:[.,][0-9]{1,2})?) (EUR|RON|USD) (zilnic|total)(?:;[ ]*durata ([0-9]+) zile)?[.!?]*$/i.exec(normalized(raw));
 if (!values) return null;
 const parsed=patchSchema.safeParse({ budgetAmount: Number(values[1].replace(',','.')), currency: values[2].toUpperCase(), budgetType: values[3] === 'zilnic' ? 'daily' : 'lifetime', ...(values[4] ? { durationDays: Number(values[4]) } : {}) });
 return parsed.success ? { selected: null, patch: parsed.data } : null;
}
export function metaDraftExecutionPrompt(prompt: string, history: AssistantMessage[]) { const rows=pending(history); return reply(prompt) && rows.length ? String(rows[0].prompt) : prompt; }
export function requestedMetaDraftAction(action: AssistantAction, prompt: string) {
 if (!metaDraftAction(action)) return false;
 const mode=metaDraftRequest(prompt), a=action as DraftAction;
 const keys=Object.keys(a.body.patch).sort().join(',');
 if (mode === 'create') return a.operation === 'meta_campaign_draft' && keys === '';
 if (mode === 'seven') return a.operation === 'meta_campaign_draft' && keys === 'durationDays' && a.body.patch.durationDays === 7;
 if (mode === 'total') return a.operation === 'meta_campaign_draft' && keys === 'budgetAmount,budgetType,currency' && a.body.patch.budgetAmount === 300 && a.body.patch.currency === 'EUR' && a.body.patch.budgetType === 'lifetime';
 if (mode === 'photo') return a.operation === 'meta_campaign_update' && keys === 'mainPhoto' && a.body.patch.mainPhoto === true;
 return ['budget','update'].includes(mode || '') && a.operation === 'meta_campaign_update' && !a.body.patch.mainPhoto && Boolean(a.body.patch.budgetAmount && a.body.patch.currency && a.body.patch.budgetType);
}
export async function prepareMetaDraft(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
 const offered=pending(history), answer=reply(prompt), effective=metaDraftExecutionPrompt(prompt,history), mode=metaDraftRequest(effective);
 if (!mode) return null;
 const actions: AssistantAction[]=[];
 const page=history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows;
 const pageId=page?.length === 1 ? String(page[0].id) : null;
 return ctx.adminDb.runTransaction(async tx => {
  const profile=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
  if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent','admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId), campaigns=await tx.get(agency.collection('metaCampaignDrafts'));
  const eligible=campaigns.docs.filter(doc => { const row=doc.data(); return row.agencyId === ctx.agencyId && !row.deletedAt && ['draft','ready'].includes(row.status) && !row.metaCampaignId && !row.metaAdId && !row.metaAdSetId && !row.metaCreativeId && (!pageId || row.propertyId === pageId); });
  if (mode === 'hold') return { actions, rows: [], text: 'Nu public și nu modific bugete prin această cerere. Drafturile rămân nepublicate; publicarea și cheltuielile necesită aprobarea explicită în fluxul de publicare. Nu am oprit campanii deja publicate.' };
  let propertyId=pageId, campaign: typeof eligible[number] | undefined;
  if (['budget','update','photo'].includes(mode)) {
   const prior=last(history)?.cards?.find(card => card.source === 'metaCampaignReview')?.rows?.[0]?.id || (last(history)?.cards?.find(card => card.source === 'autonomy')?.rows?.[0]?.result as any)?.campaignId;
   const target=answer?.selected || (answer?.patch && offered.length === 1 ? String(offered[0].id) : prior);
   campaign=target ? eligible.find(doc => doc.id === target) : eligible.length === 1 ? eligible[0] : undefined;
   if (answer?.selected && (!offered.some(row => row.id === answer.selected) || !campaign)) throw new Error('Draft neofertat sau indisponibil');
   if (answer && offered.some(row => row.contextPropertyId !== pageId)) throw new Error('Contextul proprietății s-a schimbat');
   const selectionRows=(campaign ? [campaign] : eligible).map(doc => ({ id: doc.id, campaignName: doc.data().campaignName || doc.id, propertyId: doc.data().propertyId, contextPropertyId: pageId, prompt: effective }));
   if (!campaign) return { actions, rows: selectionRows, text: selectionRows.length ? 'Alege draftul: „Draft Meta: ID”.' : 'Nu există drafturi editabile în contextul curent.' };
   propertyId=campaign.data().propertyId;
   if (['budget','update'].includes(mode) && !answer?.patch) return { actions, rows: selectionRows, text: 'Indică valorile exacte: „Parametri draft Meta: buget 150 EUR zilnic; durata 7 zile”. Moneda trebuie să coincidă cu moneda contului și a draftului. Nu modific campanii publicate.' };
  }
  if (!propertyId || !id.safeParse(propertyId).success) return { actions, rows: [], text: 'Deschide proprietatea aleasă din CRM pentru pregătirea campaniei.' };
  const property=(await tx.get(agency.collection('properties').doc(propertyId))).data();
  if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId || property.status !== 'Activ') throw new Error('Proprietate indisponibilă');
  const patch=mode === 'total' ? { budgetAmount: 300, budgetType: 'lifetime' as const, currency: 'EUR' as const } : mode === 'seven' ? { durationDays: 7 } : mode === 'photo' ? { mainPhoto: true as const } : answer?.patch || {};
  const integration=(await tx.get(agency.collection('integrations').doc('meta'))).data();
  if (!integration?.connected || !integration.selectedAdAccount?.id || !integration.selectedPage?.id) return { actions, rows: [], text: 'Conectează Meta și selectează contul de reclame și pagina înainte de salvarea draftului.' };
  const currency=integration.selectedAdAccount.currency;
  if (!['EUR','RON','USD'].includes(currency) || ('currency' in patch && patch.currency !== currency) || campaign && campaign.data().currency !== currency) return { actions, rows: [], text: 'Moneda cerută sau moneda draftului diferă de moneda contului Meta. Nu convertesc sumele automat; verifică moneda contului și reia cererea.' };
  actions.push({ kind: 'existing_operation', operation: campaign ? 'meta_campaign_update' : 'meta_campaign_draft', params: {}, query: {}, body: { jarvisDraft: true, propertyId, propertyRevision: metaDraftRevision(property), ...(campaign ? { campaignId: campaign.id, campaignRevision: metaDraftRevision(campaign.data()) } : {}), patch } });
  return { actions, rows: [], text: 'Salvez draftul Meta și verific rezultatul. Campania nu va fi publicată și nu se vor cheltui bani.' };
 });
}
export async function executeMetaDraft(ctx: AssistantContext, input: AssistantAction, key: string) {
 if (!metaDraftAction(input)) throw new Error('Comandă draft invalidă');
 const action=actionSchema.parse(input), body=action.body;
 if (isDemoAgencyId(ctx.agencyId)) throw new Error('Campaniile sunt doar preview în demo');
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId), ledger=agency.collection('assistantExecutions').doc(key);
 const campaignId=body.campaignId || createHash('sha256').update(ctx.agencyId+':'+ctx.uid+':'+key).digest('hex'), ref=agency.collection('metaCampaignDrafts').doc(campaignId), propertyRef=agency.collection('properties').doc(body.propertyId);
 const receipt=await ctx.adminDb.runTransaction(async tx => {
  await assertAutomationFence(ctx.adminDb,tx,ctx);
  const profile=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data(), prior=(await tx.get(ledger)).data();
  if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent','admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  if (prior) { if (prior.actorId !== ctx.uid || prior.actionHash !== metaDraftRevision(action) || prior.status !== 'completed') throw new Error('Execuție incompatibilă'); return prior.result; }
  const property=(await tx.get(propertyRef)).data(), existing=(await tx.get(ref)).data(), integration=(await tx.get(agency.collection('integrations').doc('meta'))).data(), agencyData=(await tx.get(agency)).data();
  if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId || property.status !== 'Activ' || metaDraftRevision(property) !== body.propertyRevision) throw new Error('Proprietatea s-a schimbat');
  if (!integration?.connected || !integration.selectedAdAccount?.id || !integration.selectedPage?.id || integration.agencyId && integration.agencyId !== ctx.agencyId) throw new Error('Configurează conexiunea Meta');
  const currency=integration.selectedAdAccount.currency;
  if (!['EUR','RON','USD'].includes(currency) || body.patch.currency && body.patch.currency !== currency) throw new Error('Moneda cerută diferă de moneda contului Meta');
  if (body.campaignId && (!existing || existing.agencyId !== ctx.agencyId || existing.propertyId !== body.propertyId || existing.deletedAt || !['draft','ready'].includes(existing.status) || existing.metaCampaignId || existing.metaAdId || existing.metaAdSetId || existing.metaCreativeId || metaDraftRevision(existing) !== body.campaignRevision || existing.currency !== currency)) throw new Error('Draftul s-a schimbat sau nu mai este editabil');
  if (!body.campaignId && existing) throw new Error('ID campanie deja ocupat');
  const now=new Date().toISOString();
  const publicUrl=buildAgencyPublicUrl({ ...agencyData, id: ctx.agencyId } as Agency, '/properties/'+body.propertyId);
  const destinationUrl=publicUrl.startsWith('https://') ? publicUrl : (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://imodeus.ro').replace(/[/]+$/,'')+publicUrl;
  const { mainPhoto, currency: _currency, ...patch }=body.patch;
  let campaign: MetaMarketingCampaignDraft = existing ? { ...(existing as MetaMarketingCampaignDraft), ...patch, status: 'draft', updatedAt: now } : buildMetaCampaignDraft({ agencyId: ctx.agencyId, propertyId: body.propertyId, requestedByUid: ctx.uid, ...patch }, property as Property, integration as MetaMarketingIntegrationPublicStatus, destinationUrl,campaignId,now);
  if (mainPhoto) {
   const photo=Array.isArray(property.images) ? property.images.find((image: any) => image?.url) : null;
   if (!photo || typeof photo.url !== 'string' || !photo.url.startsWith('https://')) throw new Error('Fotografie principală indisponibilă');
   campaign={ ...campaign, creativeFormat: 'single_image', imageUrl: photo.url, imageAlt: photo.alt || property.title || null, mediaItems: [{ type: 'image', url: photo.url, alt: photo.alt || property.title || null, source: 'property', name: null }], videoUrl: null, videoThumbnailUrl: null };
  }
  const result={ operation: action.operation, campaignId, propertyId: body.propertyId, executionState: 'succeeded', businessStatus: 'draft', budgetAmount: campaign.budgetAmount, budgetType: campaign.budgetType, currency: campaign.currency, durationDays: campaign.durationDays, imageUrl: campaign.imageUrl || null, published: false };
  tx.set(ref,campaign);
  if (!body.campaignId || property.metaMarketing?.latestCampaignDraftId === campaignId) tx.set(propertyRef,{ metaMarketing: { latestCampaignDraftId: campaignId, status: 'draft', updatedAt: now } },{ merge: true });
  tx.create(ledger,{ actorId: ctx.uid, actionHash: metaDraftRevision(action), status: 'completed', result, completedAt: now });
  return result;
 });
 const saved=(await ref.get()).data();
 if (!saved || saved.status !== 'draft' || saved.agencyId !== ctx.agencyId || saved.propertyId !== body.propertyId || saved.budgetAmount !== receipt.budgetAmount || saved.budgetType !== receipt.budgetType || saved.durationDays !== receipt.durationDays || saved.currency !== receipt.currency || (saved.imageUrl || null) !== receipt.imageUrl) throw new Error('Rezultatul draftului nu mai corespunde execuției');
 return receipt;
}
