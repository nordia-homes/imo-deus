import type { AssistantContext } from './access';
import { normalized } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
export function metaInventoryRequest(prompt:string){const text=normalized(prompt).trim().replace(/[.!?]+$/,'');return text==='arata-mi campaniile meta active'?'active':text==='arata-mi proprietatile fara campanie activa'?'without':null;}
export function metaCampaignActivity(status:string,effectiveStatus:string):'active'|'inactive'|'unknown'{
 if(status==='ACTIVE'&&effectiveStatus==='ACTIVE')return 'active';
 if(['PAUSED','ARCHIVED','DELETED'].includes(status)&&effectiveStatus===status)return 'inactive';
 return 'unknown';
}
export async function readMetaInventory(ctx:AssistantContext,prompt:string){
 const mode=metaInventoryRequest(prompt);if(!mode)return null;
 if(isDemoAgencyId(ctx.agencyId)||ctx.runtimeMode==='demo')throw new Error('Citire externă indisponibilă în demo');
 const agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId),memberRef=ctx.adminDb.collection('users').doc(ctx.uid),grantRef=ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId+'__meta');
 const assertMember=(member:Record<string,unknown>|undefined)=>{if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role||!['agent','admin'].includes(ctx.role||''))throw new Error('Acces revocat');};
 const readSnapshot=()=>ctx.adminDb.runTransaction(async tx=>{
  assertMember((await tx.get(memberRef)).data());
  const [campaigns,properties,grant]=await Promise.all([tx.get(agency.collection('metaCampaignDrafts')),tx.get(agency.collection('properties')),tx.get(grantRef)]);
  return {campaigns:campaigns.docs.map(doc=>({id:doc.id,data:doc.data()})),properties:properties.docs.map(doc=>({id:doc.id,data:doc.data()})),grant:grant.data()||null};
 });
 const snapshot=await readSnapshot(),revision=metaDraftRevision(snapshot);
 const campaigns=snapshot.campaigns.filter(doc=>!doc.data.agencyId||doc.data.agencyId===ctx.agencyId);
 const {readMetaCampaignProviderStatus}=await import('@/lib/meta-marketing');
 const states:Array<{id:string;propertyId:string;campaignName:string;localStatus:string;activity:'active'|'inactive'|'unknown';providerStatus:string|null;effectiveStatus:string|null;checkedAt:string|null;reason:string}>=new Array(campaigns.length);
 let cursor=0;const deadline=Date.now()+25000;
 await Promise.all(Array.from({length:Math.min(3,campaigns.length)},async()=>{
  for(;;){const index=cursor++;if(index>=campaigns.length)return;const doc=campaigns[index],row=doc.data;
   const base={id:doc.id,propertyId:typeof row.propertyId==='string'?row.propertyId:'',campaignName:String(row.campaignName||doc.id),localStatus:String(row.status||'unknown'),providerStatus:null,effectiveStatus:null,checkedAt:null};
   if(row.agencyId!==ctx.agencyId){states[index]={...base,activity:'unknown',reason:'Identificarea agenției în campanie este incompletă; starea nu este confirmată.'};continue;}
   if(!row.metaCampaignId){
    const localOnly=['draft','ready'].includes(row.status)&&!['metaAdSetId','metaAdId','metaCreativeId','lastPublishAttemptAt','publishAttempts'].some(key=>row[key]);
    states[index]={...base,activity:localOnly?'inactive':'unknown',reason:localOnly?'Draft local, fără obiecte Meta.':'Lipsește identificatorul Meta; absența unei campanii active nu este confirmată.'};continue;
   }
   if(Date.now()>=deadline){states[index]={...base,activity:'unknown',reason:'Limita de timp a verificării a fost atinsă; starea acestei campanii rămâne neconfirmată.'};continue;}
   try{
    const observation=await readMetaCampaignProviderStatus(ctx.agencyId,doc.id,{expectedRevision:metaDraftRevision(row),actor:{uid:ctx.uid,role:ctx.role}}),provider=observation.provider,time=bucharestInputFromIso(observation.checkedAt),activity=metaCampaignActivity(provider.status,provider.effectiveStatus);
    states[index]={...base,activity,providerStatus:provider.status,effectiveStatus:provider.effectiveStatus,checkedAt:time.date+' '+time.time+', București',reason:activity==='unknown'?'Stare intermediară sau neconcordantă la Meta.':'Stare verificată la Meta.'};
   }catch{states[index]={...base,activity:'unknown',reason:'Starea Meta nu a putut fi verificată; nu o tratez ca inactivă.'};}
  }
 }));
 if(metaDraftRevision(await readSnapshot())!==revision)throw new Error('Inventarul sau conexiunea s-a schimbat în timpul verificării');
 const unknownRows=states.filter(row=>row.activity==='unknown'),active=states.filter(row=>row.activity==='active');
 const properties=snapshot.properties.filter(doc=>!doc.data.deletedAt&&(!doc.data.agencyId||doc.data.agencyId===ctx.agencyId));
 const without=properties.filter(doc=>{const linked=states.filter(row=>row.propertyId===doc.id);return linked.every(row=>row.activity==='inactive');}).map(doc=>({id:doc.id,title:String(doc.data.title||doc.id),propertyStatus:String(doc.data.status||'unknown'),campaignCount:states.filter(row=>row.propertyId===doc.id).length,reason:states.some(row=>row.propertyId===doc.id)?'Campaniile asociate sunt inactive sau drafturi pur locale.':'Nu există campanii asociate în registrul CRM.'}));
 const unknownProperties=properties.filter(doc=>{const linked=states.filter(row=>row.propertyId===doc.id);return !linked.some(row=>row.activity==='active')&&linked.some(row=>row.activity==='unknown');}).length;
 return {source:mode==='active'?'metaActiveCampaigns':'metaPropertiesWithoutActive',rows:mode==='active'?active:without,unknownRows,complete:unknownRows.length===0,text:(mode==='active'?active.length+' campanii confirmate ACTIVE la Meta.':without.length+' proprietăți fără campanie activă în registrul verificat; '+unknownProperties+' proprietăți cu stare neclară sunt excluse din această listă.')+' Domeniu: campaniile asociate în CRM, nu campaniile create separat în contul Meta. '+unknownRows.length+' campanii au stare necunoscută și sunt afișate separat. Verificarea nu modifică și nu publică nimic; ACTIVE la nivel de campanie nu certifică livrarea fiecărei reclame.'};
}
