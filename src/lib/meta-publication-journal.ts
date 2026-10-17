import { createHash, randomUUID } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
type Params = Record<string, string | number | boolean | null | undefined>;
export type PublicationEdge = 'campaigns' | 'adsets' | 'adcreatives' | 'ads';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const publicationConfiguration=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>!['id','status','updatedAt','publishLog','lastPublishAttemptAt','publishAttempts','lastPublishError','publicationRun','publicationApproval','publicationConfigurationHash','providerPublicationVerification','providerPauseVerification','metaCampaignId','metaAdSetId','metaCreativeId','metaAdId','metaImageHash','metaImageHashes','metaVideoId'].includes(key)));
/** A pending durable intent is never dispatched again, including after process death. */
export async function ensureMetaPublicationObject(options:{
 ref:DocumentReference; field:string; edge:PublicationEdge; accountId:string; params:Params;
 guard:(tx:Transaction)=>Promise<void>;
 post:(params:Params)=>Promise<{id?:string}>;
 list:(after?:string)=>Promise<{data?:Record<string,unknown>[];paging?:{next?:string;cursors?:{after?:string}}}>;
}){
 const {ref,field,edge,accountId,params}=options,stepRef=ref.collection('publicationSteps').doc(field),requestHash=hash({accountId,edge,params});
 const prepared=await ref.firestore.runTransaction(async tx=>{
  await options.guard(tx);const [campaign,step]=await Promise.all([tx.get(ref),tx.get(stepRef)]);const row=campaign.data(),intent=step.data();
  if(!row)throw new Error('Campania nu mai există.');
  if(intent&&(intent.requestHash!==requestHash||intent.accountId!==accountId))throw new Error('Configurația publicării s-a schimbat; nu reutilizez o operație incertă.');
  if(row[field]){if(!/^\d+$/.test(String(row[field])))throw new Error('ID Meta invalid.');return {id:String(row[field]),dispatch:false,name:''};}
  if(intent)return {id:'',dispatch:false,name:String(intent.name)};
  const name=String(params.name||'Campanie').slice(0,160)+' [imo:'+randomUUID()+']';
  tx.create(stepRef,{requestHash,accountId,edge,name,state:'pending',createdAt:new Date().toISOString()});
  return {id:'',dispatch:true,name};
 });
 if(prepared.id)return {id:prepared.id};
 let id='';
 if(prepared.dispatch){try{await ref.firestore.runTransaction(options.guard);const response=await options.post({...params,name:prepared.name});if(typeof response.id==='string'&&/^\d+$/.test(response.id))id=response.id;}catch{/* Resolve a lost create response by reading; never repeat the POST. */}}
 if(!id){
  const matches=new Set<string>(),seen=new Set<string>();let after:string|undefined,complete=false;
  const deadline=Date.now()+25000;
  for(let page=0;page<20&&Date.now()<deadline;page++){
   await ref.firestore.runTransaction(options.guard);const result=await options.list(after);if(!Array.isArray(result.data))throw new Error('Lista Meta nu poate fi verificată.');
   for(const row of result.data){if(row.name!==prepared.name)continue;if(typeof row.id!=='string'||!/^\d+$/.test(row.id)||row.account_id!==accountId.replace(/^act_/,''))throw new Error('Identitate Meta neconfirmată pentru operația incertă.');if(edge==='adsets'&&row.campaign_id!==params.campaign_id)throw new Error('Ad setul recuperat aparține altei campanii.');
    if(edge==='ads'&&(row.adset_id!==params.adset_id||(row.creative as {id?:unknown}|undefined)?.id!==JSON.parse(String(params.creative)).creative_id))throw new Error('Reclama recuperată are alte asocieri.');
    matches.add(row.id);}
   if(!result.paging?.next){complete=true;break;}
   const cursor=result.paging.cursors?.after;if(!cursor||seen.has(cursor))throw new Error('Paginarea Meta nu poate fi verificată.');seen.add(cursor);after=cursor;
  }
  if(!complete||matches.size!==1)throw new Error('Rezultatul creării Meta rămâne neclar. Nu retrimit comanda; reia verificarea după sincronizarea Meta.');
  id=[...matches][0];
 }
 await ref.firestore.runTransaction(async tx=>{
  await options.guard(tx);const [campaign,step]=await Promise.all([tx.get(ref),tx.get(stepRef)]);
  if(!campaign.exists||step.data()?.requestHash!==requestHash||(campaign.data()?.[field]&&campaign.data()?.[field]!==id))throw new Error('Publicarea s-a schimbat înainte de salvarea identificatorului.');
  tx.update(ref,{[field]:id});tx.update(stepRef,{state:'resolved',id,resolvedAt:new Date().toISOString()});
 });
 return {id};
}

export const publicationPropertyContent=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='metaMarketing'));
