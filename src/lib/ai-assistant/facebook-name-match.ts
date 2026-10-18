import { normalizeCrmSearch } from '@/lib/crm/search-text';
function distance(a:string,b:string){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1)));prev=next;}return prev[b.length];}
export function facebookNameMatches(rows:Record<string,any>[], query:string){
 const words=normalizeCrmSearch(query).split(' ').filter(Boolean);
 if(query.length>200||!words.length||words.length>8||words.some(w=>['nu','fara','exceptand','doar','apoi','maine','daca'].includes(w)))return {exact:[],suggestions:[]} as {exact:Record<string,any>[];suggestions:Record<string,any>[]};
 const names=(row:Record<string,any>)=>[row.label,row.displayName].filter(v=>typeof v==='string').map(normalizeCrmSearch);
 const exact=rows.filter(row=>names(row).some(name=>words.every(w=>name.split(' ').includes(w))));
 const suggestions=exact.length?[]:rows.filter(row=>names(row).some(name=>words.every(w=>name.split(' ').some(n=>n===w||(Math.min(w.length,n.length)>=4&&distance(w,n)<=(Math.min(w.length,n.length)>=7?2:1))))));
 return {exact,suggestions};
}
