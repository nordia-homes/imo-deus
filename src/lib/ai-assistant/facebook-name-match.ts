import { normalizeCrmSearch } from '@/lib/crm/search-text';
function distance(a:string,b:string){let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1)));prev=next;}return prev[b.length];}
// A short answer to an offered account list can remain a choice even if no name matches.
export function facebookAccountAnswer(query:string){
 const text=normalizeCrmSearch(query);
 const selection=text.replace(/^(?:(?:vreau|doresc) sa (?:publici|postezi)|(?:publica|posteaza)|(?:foloseste|utilizeaza|aleg|selectez|alege)) (?:(?:de )?pe |cu )?(?:contul (?:facebook )?)?/, '').replace(/^(?:de pe |pe |cu )?contul (?:facebook )?/, '');
 if(query.length>200||/[?]/.test(query)||!selection)return null;
 const words=selection.split(' ');
 if(words.length>8||words.some(w=>!/^[\p{L}\d]+$/u.test(w)||['nu','fara','exceptand','doar','numai','apoi','maine','poimaine','azi','daca','si','sau','dar','ora','publica','posteaza','trimite','cauta','arata','spune','vreau','cate','cati','ce','care','cum','cand','de','pe','in','cu','la','din','vizionari','proprietati','apartamente','rezervari','anuleaza','opreste','continua','renunta'].includes(w)))return null;
 return words;
}
function distinctTokens(words:string[],tokens:string[],matches:(a:string,b:string)=>boolean):boolean{
 const visit=(index:number,used:Set<number>):boolean=>index===words.length||tokens.some((token,i)=>!used.has(i)&&matches(words[index],token)&&visit(index+1,new Set([...used,i])));
 return words.length<=tokens.length&&visit(0,new Set());
}
function spokenToken(a:string,b:string,fullName:boolean){
 if(a===b)return true;
 const length=Math.min(a.length,b.length),edits=distance(a,b);
 if(length>=4&&edits<=(length>=7?2:1))return true;
 // Romanian transcription may omit a leading vowel or collapse repeated vowels.
 // Require a multi-token name, identical consonants and at most two edits.
 const consonants=(word:string)=>word.replace(/[aeiou]/g,'').replace(/(.)\1+/g,'$1');
 const key=consonants(a);
 return fullName&&length>=5&&edits<=2&&key.length>=3&&key===consonants(b);
}
export function facebookNameMatches(rows:Record<string,any>[], query:string){
 const words=facebookAccountAnswer(query);
 if(!words)return {exact:[],suggestions:[]} as {exact:Record<string,any>[];suggestions:Record<string,any>[]};
 const names=(row:Record<string,any>)=>[row.label,row.displayName].filter(v=>typeof v==='string').map(normalizeCrmSearch);
 const exact=rows.filter(row=>names(row).some(name=>distinctTokens(words,name.split(' '),(a,b)=>a===b)));
 const suggestions=exact.length?[]:rows.filter(row=>names(row).some(name=>distinctTokens(words,name.split(' '),(a,b)=>spokenToken(a,b,words.length>=2))));
 return {exact,suggestions};
}
