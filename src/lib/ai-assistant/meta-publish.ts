import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { validateMetaCampaignForPublish } from '@/lib/meta-campaign-validation';
import type { MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus, Property } from '@/lib/types';
const displayedTime=(value:unknown)=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;const time=bucharestInputFromIso(value);return time.date+' '+time.time+', București';};
const id=z.string().regex(/^[A-Za-z0-9_-]{1,180}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
const shape=z.object({kind:z.literal('existing_operation'),operation:z.literal('meta_campaign_publish'),params:z.object({campaignId:id}).strict(),query:z.object({}).strict(),body:z.object({jarvisPublish:z.literal(true),propertyId:id,expectedRevision:hash,propertyRevision:hash,grantRevision:hash}).strict()}).strict();
export const metaPublishAction=(action:AssistantAction)=>shape.safeParse(action).success;
const answer=(prompt:string)=>/^Confirm publicarea Meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
const pending=(history:AssistantMessage[])=>history.filter(row=>row.role==='assistant'&&row.id!=='current-page-context').at(-1)?.cards?.find(card=>card.source==='metaPublishSelection');
export const metaPublishRequest=(prompt:string)=>normalized(prompt).trim().replace(/[.!?]+$/,'')==='publica campania dupa aprobarea mea';
export const metaPublishApproved=(action:AssistantAction,prompt:string)=>{const parsed=shape.safeParse(action);return parsed.success&&answer(prompt)?.[1]===parsed.data.params.campaignId;};
export async function prepareMetaPublish(ctx:AssistantContext,prompt:string,history:AssistantMessage[]){
 const selected=answer(prompt);if(!selected&&!metaPublishRequest(prompt))return null;
 const actions:AssistantAction[]=[];
 const page=history.find(row=>row.id==='current-page-context')?.cards?.find(card=>card.source==='properties')?.rows;
 const contextPropertyId=page?.length===1?String(page[0].id):null,offered=pending(history);
 return ctx.adminDb.runTransaction(async tx=>{
  const member=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
  if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role)throw new Error('Acces revocat');
  if(ctx.role!=='admin')return {actions,source:'metaPublishReview',rows:[],text:'Publicarea reclamelor Meta este disponibilă administratorului agenției. Nu am publicat campanii.'};
  const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const [campaigns,properties,grant]=await Promise.all([tx.get(agency.collection('metaCampaignDrafts')),tx.get(agency.collection('properties')),tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId+'__meta'))]);
  const integration=grant.data();if(!integration||integration.agencyId!==ctx.agencyId)throw new Error('Conexiune indisponibilă');
  const rows=campaigns.docs.flatMap(doc=>{
   const campaign=doc.data(),property=properties.docs.find(row=>row.id===campaign.propertyId)?.data();
   if(campaign.agencyId!==ctx.agencyId||campaign.deletedAt||!['draft','ready','error'].includes(campaign.status)||contextPropertyId&&campaign.propertyId!==contextPropertyId||!property||property.deletedAt||property.agencyId&&property.agencyId!==ctx.agencyId)return [];
   const validation=validateMetaCampaignForPublish(campaign as MetaMarketingCampaignDraft,integration as MetaMarketingIntegrationPublicStatus,property as Property);
   return [{id:doc.id,campaignName:String(campaign.campaignName||doc.id),propertyId:String(campaign.propertyId),budgetAmount:campaign.budgetAmount??null,currency:campaign.currency??null,budgetType:campaign.budgetType??null,durationDays:campaign.durationDays??null,objective:campaign.objective??null,locationLabel:campaign.locationLabel??null,radiusKm:campaign.radiusKm??null,placements:campaign.placements||[],startsAt:displayedTime(campaign.startsAt),endsAt:displayedTime(campaign.endsAt),adAccountId:String(integration.selectedAdAccount?.id||''),pageId:String(integration.selectedPage?.id||''),headline:campaign.headline??null,primaryText:campaign.primaryText??null,mediaItems:campaign.mediaItems||[],destinationUrl:campaign.destinationUrl??null,readyLocally:validation.ok,errors:validation.errors,campaignRevision:metaDraftRevision(campaign),propertyRevision:metaDraftRevision(property),grantRevision:metaDraftRevision(integration),contextPropertyId}];
  });
  if(!selected)return {actions,source:'metaPublishSelection',rows,text:rows.length?'Verifică configurația și confirmă campania: „Confirm publicarea Meta: ID”. Creez obiectele la Meta în PAUSED; aprobarea Meta și livrarea nu sunt incluse.':'Nu există o campanie eligibilă pentru publicare în contextul curent.'};
  const prior=offered?.rows.find(row=>row.id===selected[1]),target=rows.find(row=>row.id===selected[1]);
  if(!prior||!target||['campaignRevision','propertyRevision','grantRevision','contextPropertyId'].some(key=>prior[key]!==target[key as keyof typeof target]))throw new Error('Aprobarea nu mai corespunde configurației actuale');
  if(!target.readyLocally)return {actions,source:'metaPublishReview',rows:[target],text:'Campania are lipsurile indicate. Corectează configurația înainte de publicare.'};
  actions.push({kind:'existing_operation',operation:'meta_campaign_publish',params:{campaignId:target.id},query:{},body:{jarvisPublish:true,propertyId:target.propertyId,expectedRevision:target.campaignRevision,propertyRevision:target.propertyRevision,grantRevision:target.grantRevision}});
  return {actions,source:'metaPublishReview',rows:[],text:'Public campania aprobată și verific obiectele create la Meta.'};
 });
}
