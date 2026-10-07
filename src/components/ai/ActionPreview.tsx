import type { AssistantAction } from '@/lib/ai-assistant/contracts';
import { resultDate } from './AssistantResultCard';
const fieldNames:Record<string,string>={name:'Nume',phone:'Telefon',contactId:'Client',propertyId:'Proprietate',status:'Status',viewingDate:'Data vizionării',dueDate:'Termen',duration:'Durată (minute)',description:'Descriere',notes:'Notă',soldPrice:'Preț final EUR',featured:'Promovat pe site',taskId:'Sarcină',viewingId:'Vizionare',email:'Email',contactType:'Tip client',operation:'Operațiune',agentId:'Agent',patch:'Modificări',body:'Parametri operație',params:'Identificatori',query:'Filtre',property:'Proprietate nouă',preferences:'Preferințe',automation:'Automatizare',template:'Șablon',price:'Preț',budget:'Buget',city:'Oraș',zones:'Zone',text:'Mesaj',action:'Acțiune',content:'Conținut',destination:'Destinație',cooldownMinutes:'Pauză între alerte (minute)',quietHours:'Interval de liniște',timezone:'Fus orar',start:'De la',end:'Până la'};
export function ActionPreview({action,resolveName}:{action:AssistantAction;resolveName:(id:string)=>string}){
 function render(value:unknown,key:string,depth=0):React.ReactNode {
  if(key==='matchingSelection'&&value&&typeof value==='object') {
   const selection=value as {propertyId:string;contactId:string};
   return <div className="space-y-2"><p>Proprietate: {resolveName(selection.propertyId)} ({selection.propertyId})</p><p>Client: {resolveName(selection.contactId)} ({selection.contactId})</p><p>Datele vor fi reverificate înainte de trimitere.</p></div>;
  }
  if(key==='sendApproval'&&value&&typeof value==='object') {
   const quote=value as {amountMicros:number;currency:string;renderedText:string;expiresAt:number};
   return <div className="space-y-2"><p>Cost maxim: {quote.amountMicros/1000000} {quote.currency}</p><p>Mesaj: {quote.renderedText}</p><p>Valabil până la: {resultDate(new Date(quote.expiresAt).toISOString())}</p></div>;
  }
  if(/token|secret|password|credential|authorization|api.?key/i.test(key)) return 'Valoare privată';
  if(value===null) return 'Elimină valoarea';
  if(typeof value==='object') {
   if(depth>8) return '[Valoare prea adâncă]';
   const entries=Array.isArray(value)?value.map((item,index)=>[String(index+1),item] as const):Object.entries(value as Record<string,unknown>);
   return <dl className="space-y-2">{entries.filter(([field,item])=>field!=='expectedRecipientRevision'&&field!=='expectedDraftRevision'&&item!==undefined).map(([field,item])=><div key={field} className="border-l-2 border-sky-100 pl-3"><dt className="text-xs text-muted-foreground">{field==='sendApproval'?'Condiții de trimitere':field==='matchingSelection'?'Selecție din matching':field==='draftPreview'?'Postare TikTok':field==='videoTourUrl'?'Video':field==='privacyLevel'?'Vizibilitate':fieldNames[field]||field}</dt><dd className="whitespace-pre-wrap break-words">{render(item,field,depth+1)}</dd></div>)}</dl>;
  }
  if(key.endsWith('Id')&&typeof value==='string') return value.startsWith('@step:')?`Creat în pasul anterior (${value})`:`${resolveName(value)} (${value})`;
  if(['viewingDate','dueDate','nextRunAt'].includes(key)) return resultDate(value);
  return typeof value==='boolean'?value?'Da':'Nu':String(value);
 }
 const fields=Object.entries(action).filter(([key,value])=>key!=='kind'&&value!==undefined);
 return <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{fields.map(([key,value])=><div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900"><dt className="mb-1 text-xs text-muted-foreground">{fieldNames[key]||key}</dt><dd className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-medium">{render(value,key)}</dd></div>)}</dl>;
}
