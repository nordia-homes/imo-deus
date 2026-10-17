import {diagnoseMetaState} from './meta-diagnosis';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { operationResult } from './operation-result';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
const requests: Record<string,string> = {'spune-mi daca problema este in imodeus sau la meta':'diagnose','verifica statusul providerului dupa publicare':'status','reconciliaza statusul daca rezultatul este neclar':'reconcile'};
export const metaStatusRequest = (prompt:string) => requests[normalized(prompt).trim().replace(/[.!?]+$/,'')] || null;
const last=(history:AssistantMessage[])=>history.filter(row=>row.role==='assistant'&&row.id!=='current-page-context').at(-1);
export async function prepareMetaStatus(ctx:AssistantContext,prompt:string,history:AssistantMessage[]){
 const answer=/^Stare Meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim()),offered=last(history)?.cards?.find(card=>card.source==='metaStatusSelection');
 const effective=answer&&offered?.rows.length?String(offered.rows[0].prompt):prompt,mode=metaStatusRequest(effective);
 if(!mode&&!answer)return null;if(!mode)throw new Error('Selecție expirată');
 if(isDemoAgencyId(ctx.agencyId)||ctx.runtimeMode==='demo')throw new Error('Citire externă indisponibilă în demo');
 const page=history.find(row=>row.id==='current-page-context')?.cards?.find(card=>card.source==='properties')?.rows,propertyId=page?.length===1?String(page[0].id):null;
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId);
 const assertMember=(member:Record<string,unknown>|undefined)=>{if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role||!['agent','admin'].includes(ctx.role||''))throw new Error('Acces revocat');};
 const prepared=await ctx.adminDb.runTransaction(async tx=>{
  assertMember((await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data());
  const snapshot=await tx.get(agency.collection('metaCampaignDrafts'));
  const rows=snapshot.docs.filter(doc=>{const row=doc.data();return row.agencyId===ctx.agencyId&&!row.deletedAt&&row.status!=='deleted'&&(mode==='diagnose'||/^\d+$/.test(String(row.metaCampaignId||'')))&&(!propertyId||row.propertyId===propertyId);}).map(doc=>({id:doc.id,campaignName:String(doc.data().campaignName||doc.id),propertyId:String(doc.data().propertyId),status:String(doc.data().status),hasProviderId:/^\d+$/.test(String(doc.data().metaCampaignId||'')),campaignRevision:metaDraftRevision(doc.data()),contextPropertyId:propertyId,prompt:effective}));
  const prior=last(history)?.cards?.find(card=>['metaCampaignReview','metaStatusReview'].includes(card.source))?.rows;
  const receipt=last(history)?.cards?.find(card=>card.source==='autonomy')?.rows?.[0]?.result as Record<string,unknown>|undefined;
  const inferred=prior?.length===1?prior[0].id:receipt?.campaignId;
  const target=answer?rows.find(row=>row.id===answer[1]):inferred?rows.find(row=>row.id===inferred):rows.length===1?rows[0]:undefined;
  if(answer){const selected=offered?.rows.find(row=>row.id===answer[1]);if(!selected||!target||selected.contextPropertyId!==propertyId||selected.campaignRevision!==target.campaignRevision)throw new Error('Selecție schimbată');}
  return {rows,target};
 });
 if(!prepared.target)return {source:'metaStatusSelection',rows:prepared.rows,text:prepared.rows.length?'Alege campania pentru verificare: „Stare Meta: ID”. Nu retrimit operații la Meta.':'Nu există o campanie cu identificator Meta în contextul curent.'};
 const target=prepared.target;
 if(mode==='diagnose'&&!target.hasProviderId){const diagnosis=diagnoseMetaState(target.status,[],false);return {source:'metaStatusReview',rows:[{id:target.id,campaignName:target.campaignName,propertyId:target.propertyId,localStatus:target.status,providerValidated:false,hierarchyValidated:false,diagnosis}],text:diagnosis.findings.map(row=>row.location+': '+row.reason+' '+row.nextStep).join(' ')+' '+diagnosis.certainty};}
 const {readMetaCampaignProviderStatus}=await import('@/lib/meta-marketing');
 const observation=await readMetaCampaignProviderStatus(ctx.agencyId,target.id,{hierarchy:mode==='status'||mode==='diagnose',expectedRevision:target.campaignRevision,actor:{uid:ctx.uid,role:ctx.role}});
 const {provider,checkedAt}=observation;let reconciled=0;
 if(mode==='diagnose'){
  const states=observation.hierarchy?.states||[{kind:'campaign',status:provider.status,effectiveStatus:provider.effectiveStatus}],diagnosis=diagnoseMetaState(target.status,states,!!observation.hierarchy),when=bucharestInputFromIso(checkedAt);
  return {source:'metaStatusReview',rows:[{id:target.id,campaignName:target.campaignName,propertyId:target.propertyId,localStatus:target.status,providerStatus:provider.status,effectiveStatus:provider.effectiveStatus,providerValidated:true,hierarchyValidated:!!observation.hierarchy,providerObjects:states,checkedAt:when.date+' '+when.time+', București',diagnosis}],text:diagnosis.findings.map(row=>row.location+': '+row.reason+' '+row.nextStep).join(' ')+' '+diagnosis.certainty+' Verificat la '+when.date+' '+when.time+', ora Bucureștiului. Nu am modificat campanii, bugete sau execuții.'};
 }
 if(mode==='reconcile'){
  const {reconcileMetaPublication}=await import('./meta-publication-reconcile');
  const publication=await reconcileMetaPublication(ctx,target.id,target.campaignRevision);
  if(publication){const when=bucharestInputFromIso(publication.checkedAt);return {source:'metaStatusReview',rows:[{id:target.id,campaignName:target.campaignName,propertyId:target.propertyId,localStatus:'published',providerStatus:'PAUSED',effectiveStatus:'PAUSED',checkedAt:when.date+' '+when.time+', București',providerValidated:true,reconciledExecutions:publication.count}],text:'Publicarea este confirmată: campania, setul, materialul și reclama au fost verificate la Meta. Am reconciliat execuția și starea CRM fără retrimitere. Obiectele sunt în pauză; aprobarea Meta și livrarea nu sunt confirmate.'};}
 }
 if(mode==='reconcile'&&provider.status==='PAUSED'&&provider.effectiveStatus==='PAUSED'){
  reconciled=await ctx.adminDb.runTransaction(async tx=>{
   await assertAutomationFence(ctx.adminDb,tx,ctx);
   assertMember((await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data());
   const ref=agency.collection('metaCampaignDrafts').doc(target.id),current=(await tx.get(ref)).data(),grant=(await tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId+'__meta'))).data();
   if(!current||metaDraftRevision(current)!==target.campaignRevision||!grant||metaDraftRevision(grant)!==observation.grantRevision)throw new Error('Campania sau conexiunea s-a schimbat');
   const ledgers=await tx.get(agency.collection('assistantExecutions').where('status','==','unknown'));
   const matching=ledgers.docs.filter(doc=>{const row=doc.data(),action=row.action;return row.actorId===ctx.uid&&action?.kind==='existing_operation'&&action.operation==='meta_campaign_pause'&&action.params?.campaignId===target.id&&action.body?.jarvisPause===true&&action.body?.expectedRevision===target.campaignRevision;});
   if(!matching.length)return 0;
   const propertyRef=agency.collection('properties').doc(target.propertyId),property=await tx.get(propertyRef);
   const proof={...provider,checkedAt},campaign={...current,id:target.id,status:'paused',updatedAt:checkedAt,lastPublishError:null,providerPauseVerification:proof};
   const result=operationResult('meta_campaign_pause',{campaign});
   tx.update(ref,{status:'paused',updatedAt:checkedAt,lastPublishError:null,providerPauseVerification:proof});
   if(property.exists&&property.data()?.metaMarketing?.latestCampaignDraftId===target.id)tx.update(propertyRef,{'metaMarketing.status':'paused','metaMarketing.updatedAt':checkedAt});
   for(const doc of matching)tx.update(doc.ref,{status:'completed',result,reconciledAt:checkedAt,completedAt:checkedAt});
   return matching.length;
  });
 }
 if(mode==='status'&&observation.hierarchy){
  const time=bucharestInputFromIso(checkedAt),labels:Record<string,string>={campaign:'Campanie',adSet:'Set de reclame',ad:'Reclamă'};
  const details=observation.hierarchy.states.map(state=>labels[state.kind]+': '+state.status+', stare efectivă '+state.effectiveStatus).join('; ');
  const ad=observation.hierarchy.states.find(state=>state.kind==='ad')!;
  const explanation:Record<string,string>={PENDING_REVIEW:'Reclama este în verificare la Meta.',DISAPPROVED:'Reclama a fost respinsă de Meta.',PENDING_BILLING_INFO:'Meta solicită informații de facturare.',IN_PROCESS:'Meta procesează reclama.',WITH_ISSUES:'Meta raportează probleme la reclamă.',CAMPAIGN_PAUSED:'Reclama este oprită prin pauza campaniei.',ADSET_PAUSED:'Reclama este oprită prin pauza setului.',PAUSED:'Reclama este în pauză.'};
  return {source:'metaStatusReview',rows:[{id:target.id,campaignName:target.campaignName,propertyId:target.propertyId,localStatus:target.status,providerStatus:provider.status,effectiveStatus:provider.effectiveStatus,checkedAt:time.date+' '+time.time+', București',providerValidated:true,hierarchyValidated:true,deliveryConfirmed:false,providerObjects:observation.hierarchy.states,creativeId:observation.hierarchy.creativeId,reconciledExecutions:0}],text:details+'. '+(explanation[ad.effectiveStatus]||'Starea reclamei a fost verificată la Meta.')+' Materialul și asocierile celor patru obiecte au fost verificate. Aceste stări nu confirmă livrarea efectivă sau rezultate comerciale. Verificat la '+time.date+' '+time.time+', ora Bucureștiului.'};
 }
 const time=bucharestInputFromIso(checkedAt);
 const text='Meta raportează pentru campania '+target.id+': '+provider.status+', stare efectivă '+provider.effectiveStatus+'. Verificat la '+time.date+' '+time.time+', ora Bucureștiului. ';
 return {source:'metaStatusReview',rows:[{id:target.id,campaignName:target.campaignName,propertyId:target.propertyId,localStatus:reconciled?'paused':target.status,providerStatus:provider.status,effectiveStatus:provider.effectiveStatus,checkedAt:time.date+' '+time.time+', București',providerValidated:true,reconciledExecutions:reconciled}],text:text+(mode==='reconcile'?(reconciled?'Pauza este confirmată; am reconciliat starea din CRM și execuția incertă, fără retrimiterea comenzii.':'Nu am găsit o execuție incertă eligibilă și confirmată pentru această configurație. Nu am repetat operația și nu am declarat-o finalizată.'):'Verificare parțială: CRM nu conține toți identificatorii setului, materialului și reclamei. Aceasta este doar starea campaniei; nu certifică livrarea fiecărei reclame sau rezultate comerciale.')};
}
