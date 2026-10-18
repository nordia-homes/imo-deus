import type { AssistantContext } from './access';
import type { AssistantMessage } from './contracts';
import { metaImageActionSchema,metaImageResumeSelection } from './meta-image';
import { operationResult } from './operation-result';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import type { Transaction } from 'firebase-admin/firestore';
const original=(row:Record<string,any>,uid:string,campaignId?:string,proposalId?:string,includeResume=false)=>{
 const parsed=metaImageActionSchema.safeParse(row.action);
 return row.actorId===uid&&row.status==='unknown'&&parsed.success&&(includeResume||!parsed.data.body.resume)&&(!campaignId||parsed.data.params.campaignId===campaignId)&&(!proposalId||parsed.data.body.proposalId===proposalId)?parsed.data:null;
};
export async function prepareMetaImageResume(ctx:AssistantContext,prompt:string,history:AssistantMessage[]){
 const selected=metaImageResumeSelection(prompt);
 const page=history.find(row=>row.id==='current-page-context')?.cards?.find(card=>card.source==='properties')?.rows,propertyId=page?.length===1?String(page[0].id):null;
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId);
 const rows=await ctx.adminDb.runTransaction(async tx=>{
  const [member,ledgers]=await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)),tx.get(agency.collection('assistantExecutions').where('status','==','unknown'))]);
  if(ctx.role!=='admin'||member.data()?.agencyId!==ctx.agencyId||member.data()?.role!=='admin')throw Error('Acces revocat.');
  const result:Record<string,any>[]=[],seen=new Set<string>();
  for(const ledger of ledgers.docs){const action=original(ledger.data(),ctx.uid);if(!action)continue;const key=action.params.campaignId+'/'+action.body.proposalId;if(seen.has(key))continue;seen.add(key);
   const ref=agency.collection('metaCampaignDrafts').doc(action.params.campaignId),[campaign,proposal]=await Promise.all([tx.get(ref),tx.get(ref.collection('imageProposals').doc(action.body.proposalId))]);const c=campaign.data(),p=proposal.data();
   if(!c||c.agencyId!==ctx.agencyId||c.deletedAt||!p||p.actorId!==ctx.uid||p.campaignId!==campaign.id||p.propertyId!==c.propertyId||propertyId&&c.propertyId!==propertyId)continue;
   result.push({id:key,campaignId:campaign.id,proposalId:proposal.id,campaignName:String(c.campaignName||'Campanie fără denumire'),imageUrl:String(p.imageUrl),contextPropertyId:propertyId});
  }return result;
 });
 const target=selected?rows.find(row=>row.id===selected[1]+'/'+selected[2]):rows.length===1?rows[0]:undefined;
 if(selected&&!target)throw Error('Nu există o optimizare aprobată eligibilă.');
 if(!target)return {actions:[],source:'metaImageResumeSelection',rows,text:rows.length?'Alege optimizarea aprobată pe care vrei să o continui. Nu este necesară o nouă aprobare a fotografiei.':'Nu există o optimizare aprobată cu rezultat incert în contextul curent.'};
 return {actions:[metaImageActionSchema.parse({kind:'existing_operation',operation:'meta_campaign_optimize_image',params:{campaignId:target.campaignId},query:{},body:{proposalId:target.proposalId,resume:true}})],source:'metaImageReview',rows:[],text:'Continui optimizarea deja aprobată și verific rezultatul. Pașii trimiși anterior sunt recuperați prin jurnal, fără retrimitere oarbă.'};
}
type ResumeContext=Pick<AssistantContext,'agencyId'|'uid'|'role'|'adminDb'|'automationFence'|'agentJobFence'>;
export async function resumeMetaImageProposal(ctx:ResumeContext,campaignId:string,proposalId:string){
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId),campaignRef=agency.collection('metaCampaignDrafts').doc(campaignId);
 const matching=await ctx.adminDb.runTransaction(async tx=>{
  await assertAutomationFence(ctx.adminDb,tx,ctx);const [member,ledgers]=await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)),tx.get(agency.collection('assistantExecutions').where('status','==','unknown'))]);
  if(ctx.role!=='admin'||member.data()?.agencyId!==ctx.agencyId||member.data()?.role!=='admin')throw Error('Acces revocat.');
  if(!ledgers.docs.some(doc=>original(doc.data(),ctx.uid,campaignId,proposalId)))throw Error('Lipsește execuția aprobată cu rezultat incert.');return ledgers.docs.filter(doc=>original(doc.data(),ctx.uid,campaignId,proposalId,true)).map(doc=>({ref:doc.ref,action:JSON.stringify(doc.data().action)}));
 });
 const guard=async(tx:Transaction)=>{
  await assertAutomationFence(ctx.adminDb,tx,ctx);
  const ledgers=await Promise.all(matching.map(row=>tx.get(row.ref)));
  if(ledgers.some((doc,index)=>!doc.exists||!original(doc.data()!,ctx.uid,campaignId,proposalId,true)||JSON.stringify(doc.data()!.action)!==matching[index].action))throw Error('Execuția aprobată s-a schimbat.');
 };
 const {executeMetaImageProposal}=await import('@/lib/meta-image-workflow');
 const raw=await executeMetaImageProposal(ctx.agencyId,campaignId,{uid:ctx.uid,role:ctx.role},proposalId,guard);
 const result=operationResult('meta_campaign_optimize_image',raw);
 if(!result.completionSatisfied)throw Error('Rezultat Meta neconfirmat.');
 await ctx.adminDb.runTransaction(async tx=>{
  await guard(tx);const [member,campaign]=await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)),tx.get(campaignRef)]);const c=campaign.data();
  if(member.data()?.agencyId!==ctx.agencyId||member.data()?.role!=='admin'||!c||c.deletedAt||c.metaCreativeId!==raw.proof.newCreativeId||c.updatedAt!==raw.proof.checkedAt)throw Error('Rezultatul sau accesul s-a schimbat.');
  for(const row of matching)tx.update(row.ref,{status:'completed',result,completedAt:new Date().toISOString(),reconciledAt:new Date().toISOString()});
 });
 return {...raw,reconciledExecutions:matching.length};
}
