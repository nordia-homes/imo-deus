import { normalizeCrmSearch } from '@/lib/crm/search-text';
import { canReadResource, collectionFor, type AssistantContext } from './access';
function distance(a:string,b:string){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));row=next;}return row[b.length];}
export function crmNameMatch(label:string,query:string):'exact'|'similar'|null {
 const words=normalizeCrmSearch(query).split(' ').filter(Boolean),tokens=normalizeCrmSearch(label).split(' ');
 if(!words.length||words.length>12)return null;
 if(words.every(word=>tokens.includes(word)))return 'exact';
 if(words.every(word=>tokens.some(token=>token===word||!/[0-9]/.test(word+token)&&Math.min(word.length,token.length)>=4&&distance(word,token)<=(Math.min(word.length,token.length)>=7?2:1))))return 'similar';
 return null;
}
export async function resolveCrmName(ctx:AssistantContext,input:{resource:'properties'|'contacts';query:string;cursor?:string}) {
 let query=collectionFor(ctx,input.resource).orderBy('__name__').limit(501);
 if(input.cursor)query=query.startAfter(input.cursor);
 const docs=await query.get(),page=docs.docs.slice(0,500);
 const candidates=page.flatMap(doc=>{const row=doc.data();if(row.deletedAt||!canReadResource(ctx,input.resource,row))return [];
   const name=String(row.title||row.name||''),label=[name,row.address,row.city,row.zone].filter(value=>typeof value==='string').join(' ');
   const match=crmNameMatch(label,input.query);return match?[{id:doc.id,name,match,status:row.status||null}]:[];
 });
 return {rows:candidates,complete:docs.size<=500,nextCursor:docs.size>500?page.at(-1)?.id:null,instruction:'Potriviri de identitate, nu filtrare comercială. Continuă toate paginile înainte de a declara o potrivire similară unică. Păstrează numerele și restricțiile cererii. Recitește înregistrarea aleasă. Dacă există mai multe variante plauzibile, cere alegerea după denumire. Lipsa potrivirilor într-o pagină nu dovedește inexistența.'};
}
