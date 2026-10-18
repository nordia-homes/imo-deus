const nouns=[['rezervare','rezervări'],['vizionare','vizionări'],['proprietate','proprietăți'],['ofertă','oferte'],['acțiune','acțiuni'],['sarcină','sarcini'],['publicare','publicări'],['cerere','cereri'],['conversație','conversații'],['potrivire','potriviri']];
export function romanianAgreement(text:string){
 for(const [one,many] of nouns){
  text=text.replace(new RegExp('(?<![\\p{L}\\d])(?:1|unu|un|una) (?:'+one+'|'+many+')(?![\\p{L}])','giu'),'o '+one);
  text=text.replace(new RegExp('(?<![\\p{L}\\d])(?:2|doi) (?:'+one+'|'+many+')(?![\\p{L}])','giu'),match=>(match.startsWith('2 ')?'2 ':'două ')+many);
 }
 text=text.replace(/\bSunt o (rezervare|vizionare|proprietate|ofertă|acțiune|sarcină|publicare|cerere|conversație|potrivire)(?![\p{L}])/gu,'Este o $1');
 for(const [one,many] of [['pas','pași'],['client','clienți'],['cumpărător','cumpărători'],['apartament','apartamente'],['cont','conturi'],['grup','grupuri'],['mesaj','mesaje'],['rezultat','rezultate']]){
  text=text.replace(new RegExp('(?<![\\p{L}\\d])(?:1|unu|una) (?:'+one+'|'+many+')(?![\\p{L}])','giu'),'un '+one);
 }
 text=text.replace(/\bSunt un (pas|client|cumpărător|apartament|cont|grup|mesaj|rezultat)(?![\p{L}])/gu,'Este un $1');
 return text;
}
