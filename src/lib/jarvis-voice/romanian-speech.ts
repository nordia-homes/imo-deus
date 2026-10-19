import { romanianAgreement } from './romanian-agreement';
const digits=['zero','unu','doi','trei','patru','cinci','șase','șapte','opt','nouă'];
const teens=['zece','unsprezece','doisprezece','treisprezece','paisprezece','cincisprezece','șaisprezece','șaptesprezece','optsprezece','nouăsprezece'];
const tens=['','','douăzeci','treizeci','patruzeci','cincizeci','șaizeci','șaptezeci','optzeci','nouăzeci'];
const de=(n:number)=>n>=20&&(n%100>=20||n%100===0)?' de ':' ';
export function romanianNumber(n:number,feminine=false):string{
 if(!Number.isSafeInteger(n)||n<0)return String(n);
 if(n<10)return n===1&&feminine?'una':n===2&&feminine?'două':digits[n];
 if(n<20)return n===12&&feminine?'douăsprezece':teens[n-10];
 if(n<100)return tens[Math.floor(n/10)]+(n%10?' și '+romanianNumber(n%10,feminine):'');
 if(n<1000)return (n<200?'o sută':romanianNumber(Math.floor(n/100),true)+' sute')+(n%100?' '+romanianNumber(n%100,feminine):'');
 for(const [size,singular,plural,female] of [[1000000000,'un miliard','miliarde',false],[1000000,'un milion','milioane',false],[1000,'o mie','mii',true]] as const){
  if(n>=size){const q=Math.floor(n/size);return (q===1?singular:romanianNumber(q,female||q!==1)+de(q)+plural)+(n%size?' '+romanianNumber(n%size,feminine):'');}
 }
 return String(n);
}
function amount(raw:string){
 const s=raw.replace(/\s/g,'');const match=s.match(/([.,])(\d{1,2})$/);
 return {whole:Number((match?s.slice(0,-match[0].length):s).replace(/[.,]/g,'')),fraction:match?Number(match[2].padEnd(2,'0')):0};
}
const feminineNouns='rezervare|vizionare|proprietate|ofertă|acțiune|sarcină|publicare|cerere|conversație|potrivire';
export function romanianSpeech(text:string){
 let s=romanianAgreement(text).replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'linkul din conversație');
 s=s.replace(/(?<![\p{L}\d])(?:(?:\+|00)?40[ .-]?|0)[1-9](?:[ .-]?\d){8}(?!\d)/gu,phone=>(phone.startsWith('+')?'plus ':'')+phone.replace(/\D/g,'').split('').map(d=>digits[Number(d)]).join(', '));
 s=s.replace(/(?<![\d\p{L}])([0-9]+(?:[., ]\d{3})*(?:[.,]\d{1,2})?)\s*(euro\b|EUR\b|€|lei\b|leu\b|RON\b)/giu,(_all,raw,currency)=>{
  const {whole,fraction}=amount(raw),eur=/euro|eur|€/i.test(currency),unit=eur?'euro':whole===1?'leu':'lei';
  return (whole===1?'un':romanianNumber(whole))+de(whole)+unit+(fraction?' și '+(fraction===1?'un':romanianNumber(fraction))+de(fraction)+(eur?(fraction===1?'eurocent':'eurocenți'):(fraction===1?'ban':'bani')):'');
 });
 s=s.replace(/\b(\d{1,2}):(\d{2})\b/g,(all,h,m)=>Number(h)<24&&Number(m)<60?romanianNumber(Number(h),true)+(Number(m)?' și '+romanianNumber(Number(m),true):' fix'):all);
 s=s.replace(new RegExp('\\b(?:1|unu|un) ('+feminineNouns+')\\b','giu'),'o $1');
 s=s.replace(/\b(?:1|una) (apartament|cumpărător|client|cont|grup|mesaj|pas|rezultat)\b/giu,'un $1');
 s=s.replace(/\b2 (rezervări|vizionări|proprietăți|oferte|acțiuni|sarcini|publicări|cereri|conversații|potriviri|apartamente|grupuri|mesaje|rezultate)\b/giu,'două $1');
 s=s.replace(/\b(\d+) (?:de )?(rezervări|vizionări|proprietăți|oferte|acțiuni|sarcini|publicări|cereri|conversații|potriviri|apartamente|grupuri|mesaje|rezultate|conturi|anunțuri|case|camere|fotografii|imagini|programări|notificări)(?![\p{L}])/gu,(_all,n,noun)=>romanianNumber(Number(n),true)+de(Number(n))+noun);
 s=s.replace(/\b\d+\b/g,n=>romanianNumber(Number(n)));
 return s;
}
