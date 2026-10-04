import type { AssistantAction } from '@/lib/ai-assistant/contracts';
import { resultDate } from './AssistantResultCard';
const fieldNames:Record<string,string>={name:'Nume',phone:'Telefon',contactId:'Client',propertyId:'Proprietate',status:'Status',viewingDate:'Data vizionării',dueDate:'Termen',duration:'Durată (minute)',description:'Sarcină',notes:'Notă',soldPrice:'Preț final EUR',featured:'Promovat pe site',taskId:'Sarcină',viewingId:'Vizionare',email:'Email',contactType:'Tip client',operation:'Operațiune',agentId:'Agent'};
export function ActionPreview({action,resolveName}:{action:AssistantAction;resolveName:(id:string)=>string}){
 const fields=Object.entries(action).filter(([key,value])=>fieldNames[key]&&value!==undefined&&value!=='');
 return <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{fields.map(([key,value])=><div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900"><dt className="text-xs text-muted-foreground">{fieldNames[key]}</dt><dd className="mt-0.5 break-words font-medium">{key.endsWith('Id')?(String(value).startsWith('@step:')?'Creat în pasul anterior':resolveName(String(value))):['viewingDate','dueDate'].includes(key)?resultDate(value):typeof value==='boolean'?value?'Da':'Nu':String(value)}</dd></div>)}</dl>;
}
