import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { metaComparisonPeriods, metaMetricChanges } from '@/lib/meta-insights-period';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { isDemoAgencyId } from '@/lib/demo/guards';
export function metaPerformanceRequest(prompt:string){const text=normalized(prompt).trim().replace(/[.!?]+$/,'');return text==='compara ultimele sapte zile cu precedentele sapte'?'periods':text==='compara doua campanii meta'?'campaigns':null;}
export async function prepareMetaPerformance(ctx:AssistantContext,prompt:string,history:AssistantMessage[]){
 const answer=/^Statistici Meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
 const last=history.filter(row=>row.role==='assistant'&&row.id!=='current-page-context').at(-1);
 const offered=last?.cards?.find(card=>card.source==='metaPerformanceSelection');
 const effective=answer&&offered?.rows.length?String(offered.rows[0].prompt):prompt,mode=metaPerformanceRequest(effective);
 if(!mode&&!answer)return null;if(!mode)throw new Error('Selecție expirată');
 if(isDemoAgencyId(ctx.agencyId)||ctx.runtimeMode==='demo')throw new Error('Statistici externe indisponibile în demo');
 const page=history.find(row=>row.id==='current-page-context')?.cards?.find(card=>card.source==='properties')?.rows;
 const propertyId=page?.length===1?String(page[0].id):null,agency=ctx.adminDb.collection('agencies').doc(ctx.agencyId);
 const snapshot=()=>ctx.adminDb.runTransaction(async tx=>{
  const member=(await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
  if(member?.agencyId!==ctx.agencyId||member.role!==ctx.role||!['admin','agent'].includes(ctx.role||''))throw new Error('Acces revocat');
  const campaigns=await tx.get(agency.collection('metaCampaignDrafts')),grant=await tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId+'__meta'));
  return {campaigns:campaigns.docs.map(doc=>({id:doc.id,data:doc.data()})),grant:grant.data()||null};
 });
 const before=await snapshot(),revision=metaDraftRevision(before);
 const candidates=before.campaigns.filter(({data})=>data.agencyId===ctx.agencyId&&!data.deletedAt&&data.status!=='deleted'&&/^\d+$/.test(String(data.metaCampaignId||''))&&(!propertyId||data.propertyId===propertyId));
 const required=mode==='campaigns'?2:1;
 let ids:string[]=[];
 if(answer){
  const chosen=offered?.rows.find(row=>row.id===answer[1]);
  if(!chosen||chosen.contextPropertyId!==propertyId||chosen.snapshotRevision!==revision)throw new Error('Selecție schimbată');
  ids=[...(Array.isArray(chosen.selectedIds)?chosen.selectedIds.map(String):[]),answer[1]];
  if(new Set(ids).size!==ids.length||ids.some(id=>!candidates.some(row=>row.id===id)))throw new Error('Selecție invalidă');
 }else if(candidates.length===required)ids=candidates.map(row=>row.id);
 else if(mode==='periods'){
  const previous=last?.cards?.find(card=>['metaCampaignReview','metaStatusReview','metaPerformanceReview'].includes(card.source))?.rows;
  if(previous?.length===1&&candidates.some(row=>row.id===previous[0].id))ids=[String(previous[0].id)];
 }
 if(ids.length<required){
  const enough=candidates.length>=required;
  return {source:'metaPerformanceSelection',rows:enough?candidates.filter(row=>!ids.includes(row.id)).map(row=>({id:row.id,campaignName:String(row.data.campaignName||row.id),prompt:effective,contextPropertyId:propertyId,snapshotRevision:revision,selectedIds:ids})):[],text:enough?(ids.length?'Alege a doua campanie pentru comparație.':'Alege campania pentru raport: „Statistici Meta: ID”.'):'Nu există suficiente campanii cu identificator Meta în contextul curent.'};
 }
 const {readMetaCampaignPeriodInsights}=await import('@/lib/meta-marketing');
 const periods=metaComparisonPeriods();
 if(new Set(ids.map(id=>candidates.find(row=>row.id===id)!.data.metaCampaignId)).size!==ids.length)throw new Error('Aceeași campanie Meta este asociată mai multor înregistrări.');
 const rows=await Promise.all(ids.map(async id=>{
  const campaign=candidates.find(row=>row.id===id)!;
  const report=await readMetaCampaignPeriodInsights(ctx.agencyId,id,{periods,expectedRevision:metaDraftRevision(campaign.data),actor:{uid:ctx.uid,role:ctx.role}});
  const time=bucharestInputFromIso(report.checkedAt);
  return {id,campaignName:String(campaign.data.campaignName||id),propertyId:String(campaign.data.propertyId||''),current:report.current,...(mode==='periods'?{previous:report.previous,changes:metaMetricChanges(report.current,report.previous)}:{}),attribution:report.attribution,checkedAt:time.date+' '+time.time+', București',providerValidated:true};
 }));
 if(metaDraftRevision(await snapshot())!==revision)throw new Error('Datele sau conexiunea s-au schimbat în timpul comparației');
 const detail=rows.map(row=>row.campaignName+': '+row.current.period.since+'–'+row.current.period.until+', cheltuieli '+(row.current.spend===null?'indisponibile':row.current.spend+' '+row.current.currency)+', leaduri '+(row.current.leads??'indisponibile')+', CPL '+(row.current.costPerLead===null?'indisponibil':row.current.costPerLead.toFixed(2)+' '+row.current.currency)).join('; ');
 return {source:'metaPerformanceReview',rows,text:detail+'. '+(mode==='periods'?'Comparația cu precedentele șapte zile și diferențele sunt afișate în raport.':'Comparația folosește aceeași perioadă și regulă de atribuire; nu stabilește singură rentabilitatea campaniilor.')+' Sunt ultimele șapte zile calendaristice încheiate, în ora Bucureștiului; ziua curentă este exclusă. Leadurile folosesc doar indicatorul agregat «lead», fără însumarea categoriilor suprapuse. Valorile lipsă și procentele cu bază zero rămân indisponibile. Rezultatele sunt raportate de Meta la momentul citirii și se pot actualiza ulterior; nu sunt o prognoză sau o garanție comercială. Nu am modificat campanii.'};
}
