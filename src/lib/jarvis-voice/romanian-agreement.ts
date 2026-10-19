// Display and speech share noun agreement. No numbers are inferred or changed.
const feminine=[['rezervare','rezervări'],['vizionare','vizionări'],['proprietate','proprietăți'],['ofertă','oferte'],['acțiune','acțiuni'],['sarcină','sarcini'],['publicare','publicări'],['cerere','cereri'],['conversație','conversații'],['potrivire','potriviri'],['casă','case'],['cameră','camere'],['fotografie','fotografii'],['imagine','imagini'],['programare','programări'],['notificare','notificări']];
const masculine=[['pas','pași'],['client','clienți'],['cumpărător','cumpărători'],['proprietar','proprietari'],['agent','agenți'],['apartament','apartamente'],['cont','conturi'],['grup','grupuri'],['mesaj','mesaje'],['rezultat','rezultate'],['anunț','anunțuri']];
const neutral=new Set(['apartament','cont','grup','mesaj','rezultat','anunț']);
const spelling=(s:string)=>s.replace(/ă/g,'[ăa]').replace(/â/g,'[âa]').replace(/î/g,'[îi]').replace(/ș/g,'[șşs]').replace(/ț/g,'[țţt]');
export function romanianAgreement(text:string){
 for(const [one,many] of [...feminine,...masculine]){
  const female=feminine.some(row=>row[0]===one), pluralFemale=female||neutral.has(one);
  const noun='(?:'+spelling(one)+'|'+spelling(many)+')(?![\\p{L}])';
  const prefix='(?<![\\p{L}\\d.,])';
  // Written "un (1)" is one quantity, not two spoken numbers.
  text=text.replace(new RegExp(prefix+'(?:1|unu|un|una|o)(?:\\s*\\(1\\))?\\s+'+noun,'giu'),(match,offset)=>{
   const article=female?'o':'un';
   return (offset===0&&/^[A-ZĂÂÎȘȚ]/.test(match)?article[0].toUpperCase()+article.slice(1):article)+' '+one;
  });
  text=text.replace(new RegExp(prefix+'(?:2|doi|două|doua)(?:\\s*\\(2\\))?\\s+'+noun,'giu'),match=>(match.startsWith('2')?'2':pluralFemale?'două':'doi')+' '+many);
  text=text.replace(new RegExp(prefix+'(\\d+)\\s+(?:de\\s+)?'+noun,'giu'),(all,raw)=>{
   const n=Number(raw);if(!Number.isSafeInteger(n)||n===1)return all;
   return raw+(n>=20&&(n%100>=20||n%100===0)?' de ':' ')+many;
  });
 }
 text=text.replace(/\b(sunt|există) (o|un) (?=(?:rezervare|vizionare|proprietate|ofertă|acțiune|sarcină|publicare|cerere|conversație|potrivire|casă|cameră|fotografie|imagine|programare|notificare|pas|client|cumpărător|proprietar|agent|apartament|cont|grup|mesaj|rezultat|anunț)(?![\p{L}]))/giu,(all,verb,article)=>verb.toLowerCase()==='există'?all:(verb[0]==='S'?'Este ':'este ')+article+' ');
 return text;
}
