import type { AssistantContext } from './access';
import { metaDraftRevision } from './meta-draft';
import { metaPublishAction } from './meta-publish';
import { operationResult } from './operation-result';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { publicationConfiguration, publicationPropertyContent } from '@/lib/meta-publication-journal';
import type { Transaction } from 'firebase-admin/firestore';
/** Resolve only an actor's approved publication, using GETs; never create or activate ads. */
export async function reconcileMetaPublication(ctx:AssistantContext,campaignId:string,expectedRevision:string){
 if(ctx.role!=='admin')return null;
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId),ref=agency.collection('metaCampaignDrafts').doc(campaignId);
 const read=async(tx:Transaction)=>{
  const [member,campaign,grant,ledgers,steps]=await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)),tx.get(ref),tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId+'__meta')),tx.get(agency.collection('assistantExecutions').where('status','==','unknown')),tx.get(ref.collection('publicationSteps'))]);
  if(member.data()?.agencyId!==ctx.agencyId||member.data()?.role!=='admin')throw new Error('Acces revocat');
  const current=campaign.data(),stamp=current?.publicationApproval;
  if(!current||current.agencyId!==ctx.agencyId||current.deletedAt||metaDraftRevision(current)!==expectedRevision)throw new Error('Campania s-a schimbat');
  if(!stamp||stamp.actorId!==ctx.uid||!['error','publishing','published'].includes(current.status)||Date.parse(current.publicationRun?.expiresAt||'')>Date.now())return null;
  if(current.publicationConfigurationHash!==stamp.configuration||metaDraftRevision(publicationConfiguration(current))!==stamp.configuration||!grant.exists||metaDraftRevision(grant.data())!==stamp.grantRevision)return null;
  const matching=ledgers.docs.filter(doc=>{const row=doc.data(),action=row.action;return row.actorId===ctx.uid&&metaPublishAction(action)&&action.params.campaignId===campaignId&&action.body.propertyId===current.propertyId&&['expectedRevision','propertyRevision','grantRevision'].every(key=>action.body[key]===stamp[key]);});
  if(!matching.length)return null;
  for(const field of ['metaCampaignId','metaAdSetId','metaCreativeId','metaAdId']){const step=steps.docs.find(doc=>doc.id===field)?.data();if(!step||step.state!=='resolved'||step.id!==current[field]||step.accountId!==grant.data()?.selectedAdAccount?.id)return null;}
  const propertyRef=agency.collection('properties').doc(current.propertyId),property=await tx.get(propertyRef),value=property.data();
  if(!value||value.deletedAt||value.agencyId&&value.agencyId!==ctx.agencyId||metaDraftRevision(publicationPropertyContent(value))!==stamp.propertyContentRevision)return null;
  return {current,matching,propertyRef,property:value,grantRevision:metaDraftRevision(grant.data())};
 };
 const prepared=await ctx.adminDb.runTransaction(read);if(!prepared)return null;
 const {readMetaPublicationProviderStatus}=await import('@/lib/meta-marketing');
 const observed=await readMetaPublicationProviderStatus(ctx.agencyId,campaignId,{expectedRevision,actor:{uid:ctx.uid,role:ctx.role}});
 return ctx.adminDb.runTransaction(async tx=>{
  await assertAutomationFence(ctx.adminDb,tx,ctx);const fresh=await read(tx);
  if(!fresh||fresh.grantRevision!==observed.grantRevision||fresh.matching.map(doc=>doc.id).join(',')!==prepared.matching.map(doc=>doc.id).join(','))throw new Error('Execuția sau datele s-au schimbat');
  const checkedAt=observed.proof.checkedAt,campaign={...fresh.current,id:campaignId,status:'published',updatedAt:checkedAt,lastPublishError:null,publicationRun:null,providerPublicationVerification:observed.proof};
  const result=operationResult('meta_campaign_publish',{campaign});
  if(result.publicationConfirmed!==true)throw new Error('Publicare neconfirmată');
  tx.update(ref,{status:'published',updatedAt:checkedAt,lastPublishError:null,publicationRun:null,providerPublicationVerification:observed.proof});
  if(fresh.property.metaMarketing?.latestCampaignDraftId===campaignId)tx.update(fresh.propertyRef,{'metaMarketing.status':'published','metaMarketing.updatedAt':checkedAt});
  for(const doc of fresh.matching)tx.update(doc.ref,{status:'completed',result,reconciledAt:checkedAt,completedAt:checkedAt});
  return {count:fresh.matching.length,checkedAt};
 });
}
