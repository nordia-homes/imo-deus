import { romanianAgreement } from '@/lib/jarvis-voice/romanian-agreement';
// Presentation only: identifiers in actions, links and execution ledgers stay intact.
export function humanReply(text:string, data:unknown[]=[]):string {
 const labels=new Map<string,string>();
 const visit=(value:unknown)=>{
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(!value||typeof value!=='object')return;
  const row=value as Record<string,unknown>;
  const name=[row.displayName,row.label,row.title,row.name,row.campaignName].find(v=>typeof v==='string'&&v.trim()) as string|undefined;
  for(const [key,v] of Object.entries(row)){
   if(typeof v==='string'&&/^(id|.*Id)$/.test(key)&&v){
    const specific=key==='propertyId'?row.propertyTitle:key==='contactId'?row.contactName:key==='connectionId'?row.connectionLabel:key==='pageId'?row.pageName:undefined;
    const label=typeof specific==='string'?specific:key==='id'?name:undefined;
    if(label&&label!==v)labels.set(v,label);else if(!labels.has(v))labels.set(v,'înregistrarea selectată');
   }
   if(v&&typeof v==='object')visit(v);
  }
 };
 data.forEach(visit);
 const escape=(s:string)=>s.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
 return romanianAgreement(text).split(/(https?:\/\/[^\s)]+)/g).map(part=>{
  if(/^https?:\/\//.test(part))return part;
  part=part.replace(/\bID(?:-ul|\s+(?:publicare|răspuns|proprietate|client|cont|grup))?\s*:\s*([^\s,;.]+)/giu,(_all,id)=>labels.get(id)||'înregistrarea selectată');
  for(const [id,label] of [...labels].sort((a,b)=>b[0].length-a[0].length)){
   if(id.length<4)continue;
   part=part.replace(new RegExp('(?<![\\p{L}\\p{N}_-])'+escape(id)+'(?![\\p{L}\\p{N}_-])','gu'),()=>label);
  }
  return part
   .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'înregistrarea selectată');
 }).join('');
}
