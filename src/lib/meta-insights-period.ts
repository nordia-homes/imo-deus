import { bucharestInputFromIso } from './bucharest-time';
export type MetaPeriod = { since:string; until:string };
export function metaComparisonPeriods(now=new Date()) {
 const today=bucharestInputFromIso(now).date;
 const shift=(days:number)=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
 return {current:{since:shift(-7),until:shift(-1)},previous:{since:shift(-14),until:shift(-8)}};
}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
function number(value:unknown,integer=false):number|null {
 if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value)))return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0&&(!integer||Number.isSafeInteger(n))?n:null;
}
export function parseMetaPeriod(payload:unknown,expected:{campaignId:string;accountId:string;currency:string;period:MetaPeriod}) {
 const envelope=record(payload),data=envelope.data;
 if(!Array.isArray(data)||record(envelope.paging).next||data.length>1)throw new Error('Raport Meta incomplet sau ambiguu.');
 const missing={period:expected.period,currency:expected.currency,spend:null,impressions:null,clicks:null,leads:null,costPerLead:null,leadMetric:'lead',dataAvailable:false};
 if(!data.length)return missing;
 const row=record(data[0]);
 if(row.campaign_id!==expected.campaignId||row.account_id!==expected.accountId||row.account_currency!==expected.currency||row.date_start!==expected.period.since||row.date_stop!==expected.period.until)throw new Error('Raportul Meta nu corespunde campaniei, contului sau perioadei.');
 const spend=number(row.spend),impressions=number(row.impressions,true),clicks=number(row.clicks,true);
 const leadRows=Array.isArray(row.actions)?row.actions.map(record).filter(action=>action.action_type==='lead'):[];
 // Do not add aggregate lead and its overlapping component actions.
 const leads=leadRows.length===1?number(leadRows[0].value,true):null;
 const cpl=spend!==null&&leads!==null&&leads>0?spend/leads:null;
 return {...missing,spend,impressions,clicks,leads,costPerLead:cpl!==null&&Number.isFinite(cpl)?cpl:null,dataAvailable:true};
}
export function metaMetricChanges(current:ReturnType<typeof parseMetaPeriod>,previous:ReturnType<typeof parseMetaPeriod>){
 return Object.fromEntries((['spend','impressions','clicks','leads','costPerLead'] as const).map(key=>{
  const a=current[key],b=previous[key],delta=a!==null&&b!==null?a-b:null,percent=delta!==null&&b!==null&&b>0?delta/b*100:null;
  return [key,{difference:delta!==null&&Number.isFinite(delta)?delta:null,percent:percent!==null&&Number.isFinite(percent)?percent:null}];
 }));
}
