import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { isDemoAgencyId } from '@/lib/demo/guards';
const requests: Record<string,string> = { 'foloseste materialul media pe care l-am selectat': 'select', 'nu asocia materialul gresit campaniei': 'check', 'verifica daca assetul selectat mai exista': 'check', 'elimina draftul gresit daca este permis': 'remove' };
export const metaMediaRequest = (prompt: string) => requests[normalized(prompt).trim().replace(/[.!?]+$/, '')] || null;
const last = (history: AssistantMessage[]) => history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
const pending = (history: AssistantMessage[]) => last(history)?.cards?.find(card => ['metaMediaSelection','metaMediaCampaignSelection'].includes(card.source));
const selection = (prompt: string) => /^(Material Meta|Campanie material Meta):[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
export function metaMediaExecutionPrompt(prompt: string, history: AssistantMessage[]) { const offered=pending(history); return selection(prompt) && offered?.rows.length ? String(offered.rows[0].prompt) : prompt; }
const id=z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
const removalSchema=z.object({kind:z.literal('existing_operation'),operation:z.literal('meta_campaign_remove'),params:z.object({}).strict(),query:z.object({}).strict(),body:z.object({jarvisLocalRemoval:z.literal(true),campaignId:id,campaignRevision:z.string().length(64),propertyId:id,propertyRevision:z.string().length(64)}).strict()}).strict();
export const metaDraftRemovalAction = (action: AssistantAction) => removalSchema.safeParse(action).success;
export const localMetaDraft = (row: Record<string, any>, agencyId: string) => row.agencyId === agencyId && !row.deletedAt && ['draft','ready'].includes(row.status) && !['metaCampaignId','metaAdSetId','metaAdId','metaCreativeId'].some(key => row[key]);
export async function prepareMetaMedia(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
 const effective=metaMediaExecutionPrompt(prompt,history),mode=metaMediaRequest(effective);if(!mode)return null;
 const offered=pending(history),answer=selection(prompt),actions:AssistantAction[]=[];
 const page=history.find(row=>row.id==='current-page-context')?.cards?.find(card=>card.source==='properties')?.rows;
 const pageId=page?.length===1?String(page[0].id):null;
 return ctx.adminDb.runTransaction(async tx=>{
  const member=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
  if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role||!['admin','agent'].includes(ctx.role||''))throw new Error('Acces revocat');
  const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId),snap=await tx.get(agency.collection('metaCampaignDrafts'));
  const eligible=snap.docs.filter(doc=>localMetaDraft(doc.data(),ctx.agencyId)&&(!pageId||doc.data().propertyId===pageId));
  const inferred=last(history)?.cards?.find(card=>card.source==='metaCampaignReview')?.rows?.[0]?.id||(last(history)?.cards?.find(card=>card.source==='autonomy')?.rows?.[0]?.result as any)?.campaignId;
  const chosen=answer&&offered?.source==='metaMediaCampaignSelection'?answer[2]:answer&&offered?.source==='metaMediaSelection'?offered.rows[0]?.campaignId:inferred;
  const campaign=chosen?eligible.find(doc=>doc.id===chosen):eligible.length===1?eligible[0]:null;
  if(answer&&(!offered||!offered.rows.some(row=>row.id===answer[2])||offered.rows.some(row=>row.contextPropertyId!==pageId)||!campaign))throw new Error('Selecție indisponibilă');
  if(!campaign)return {actions,source:'metaMediaCampaignSelection',rows:eligible.map(doc=>({id:doc.id,campaignName:doc.data().campaignName||doc.id,contextPropertyId:pageId,prompt:effective})),text:eligible.length?'Alege draftul: „Campanie material Meta: ID”.':'Nu există drafturi locale eligibile în context.'};
  const row=campaign.data(),propertyId=String(row.propertyId),property=(await tx.get(agency.collection('properties').doc(propertyId))).data();
  if(!property||property.deletedAt||property.agencyId&&property.agencyId!==ctx.agencyId)throw new Error('Proprietate indisponibilă');
  const propertyRevision=metaDraftRevision(property),campaignRevision=metaDraftRevision(row);
  if(mode==='remove'){
   actions.push({kind:'existing_operation',operation:'meta_campaign_remove',params:{},query:{},body:{jarvisLocalRemoval:true,campaignId:campaign.id,campaignRevision,propertyId,propertyRevision}});
   return {actions,source:'metaMediaReview',rows:[],text:'Elimin numai draftul local selectat. Nu șterg obiecte la Meta.'};
  }
  const images=Array.isArray(property.images)?property.images.filter((image:any)=>typeof image?.url==='string'&&image.url.startsWith('https://')):[];
  if(mode==='check'){
   const media=Array.isArray(row.mediaItems)&&row.mediaItems.length?row.mediaItems:row.imageUrl?[{url:row.imageUrl,type:'image',source:'property'}]:[];
   return {actions,source:'metaMediaReview',rows:media.map((item:any,index:number)=>({id:String(index+1),campaignId:campaign.id,propertyId,url:typeof item?.url==='string'?item.url:null,type:item?.type||null,inCurrentProperty:item?.type==='image'&&images.some((image:any)=>image.url===item.url),source:item?.source||null})),text:media.length?'Am comparat materialele campaniei cu fotografiile actuale ale proprietății. Un material absent nu este înlocuit automat. Verificarea privește asocierea din CRM; disponibilitatea fișierului la adresa externă nu a fost verificată.':'Campania nu are materiale selectate. Nu am asociat alte materiale.'};
  }
  if(property.status!=='Activ')return {actions,source:'metaMediaReview',rows:[],text:'Activează proprietatea înainte de schimbarea materialului campaniei.'};
  if(answer&&offered?.source==='metaMediaSelection'){
   const selected=offered.rows.find(item=>item.id===answer[2]);
   if(!selected||selected.propertyRevision!==propertyRevision||selected.campaignRevision!==campaignRevision||selected.campaignId!==campaign.id||!images.some((image:any)=>image.url===selected.url))throw new Error('Materialul sau campania s-a schimbat');
   actions.push({kind:'existing_operation',operation:'meta_campaign_update',params:{},query:{},body:{jarvisDraft:true,propertyId,propertyRevision,campaignId:campaign.id,campaignRevision,patch:{selectedImageUrl:selected.url}}});
   return {actions,source:'metaMediaReview',rows:[],text:'Salvez fotografia selectată numai în draftul ales.'};
  }
  return {actions,source:'metaMediaSelection',rows:images.map((image:any,index:number)=>({id:String(index+1),url:image.url,imageUrl:image.url,description:image.alt||'Fotografie '+(index+1),campaignId:campaign.id,propertyId,propertyRevision,campaignRevision,contextPropertyId:pageId,prompt:effective})),text:images.length?'Alege fotografia din proprietate: „Material Meta: NUMĂR”. Nu aleg automat alt material.':'Proprietatea nu are fotografii HTTPS disponibile pentru selecție.'};
 });
}
export async function executeMetaDraftRemoval(ctx:AssistantContext,input:AssistantAction,key:string){
 const action=removalSchema.parse(input),body=action.body;
 if(isDemoAgencyId(ctx.agencyId))throw new Error('Operație indisponibilă în demo');
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId),ref=agency.collection('metaCampaignDrafts').doc(body.campaignId),propertyRef=agency.collection('properties').doc(body.propertyId),ledger=agency.collection('assistantExecutions').doc(key);
 const result=await ctx.adminDb.runTransaction(async tx=>{
  await assertAutomationFence(ctx.adminDb,tx,ctx);
  const member=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data(),prior=(await tx.get(ledger)).data();
  if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role||!['agent','admin'].includes(ctx.role||''))throw new Error('Acces revocat');
  if(prior){if(prior.actorId!==ctx.uid||prior.actionHash!==metaDraftRevision(action)||prior.status!=='completed')throw new Error('Execuție incompatibilă');return prior.result;}
  const row=(await tx.get(ref)).data(),property=(await tx.get(propertyRef)).data(),campaigns=await tx.get(agency.collection('metaCampaignDrafts'));
  if(!row||!localMetaDraft(row,ctx.agencyId)||row.propertyId!==body.propertyId||metaDraftRevision(row)!==body.campaignRevision)throw new Error('Draftul s-a schimbat');
  if(!property||property.deletedAt||property.agencyId&&property.agencyId!==ctx.agencyId||metaDraftRevision(property)!==body.propertyRevision)throw new Error('Proprietatea s-a schimbat');
  const now=new Date().toISOString();
  const remaining=campaigns.docs.filter(doc=>doc.id!==ref.id&&doc.data().agencyId===ctx.agencyId&&doc.data().propertyId===body.propertyId&&doc.data().status!=='deleted'&&!doc.data().deletedAt).sort((a,b)=>String(b.data().updatedAt||'').localeCompare(String(a.data().updatedAt||''))||a.id.localeCompare(b.id));
  const next=remaining[0];
  tx.delete(ref);
  if(property.metaMarketing?.latestCampaignDraftId===ref.id)tx.set(propertyRef,{metaMarketing:{latestCampaignDraftId:next?.id||null,status:next?.data().status||null,updatedAt:now}},{merge:true});
  const receipt={operation:'meta_campaign_remove',campaignId:ref.id,propertyId:body.propertyId,executionState:'succeeded',businessStatus:'deleted',localOnly:true,deletedAt:now};
  tx.create(ledger,{actorId:ctx.uid,actionHash:metaDraftRevision(action),status:'completed',result:receipt,deletedDraft:row,completedAt:now});return receipt;
 });
 if((await ref.get()).exists)throw new Error('Eliminare neconfirmată');return result;
}
