// Only trusted stage identifiers determine narration; raw tool output is never spoken.
const stages: Record<string,string[]> = {
 query_records:['Consult datele din aplicație pentru cererea ta.','Caut informațiile necesare în înregistrările din aplicație.','Verific datele care răspund întrebării tale.'],
 search_properties:['Caut proprietatea potrivită în portofoliu.','Verific proprietățile care corespund detaliilor indicate.','Căutarea proprietății este încă în curs.'],
 facebook_publication_preflight:['Verific proprietatea, contul Facebook și grupurile pentru publicare.','Verific datele necesare publicării în grupurile Facebook.','Pregătirea publicării pe Facebook este încă în curs.'],
 verify_request_coverage:['Verific să fie îndeplinite toate cerințele tale.','Compar rezultatele obținute cu solicitarea ta.','Verific dacă au rămas pași nefinalizați.'],
 propose_actions:['Pregătesc pașii necesari pentru cererea ta.','Stabilesc acțiunile necesare pe baza datelor disponibile.','Pregătirea acțiunilor este încă în curs.'],
 planning:['Verific ce mai este necesar pentru cererea ta.','Analizez informațiile disponibile pentru următorul pas.','Stabilesc cum să continui solicitarea ta.'],
 provider_retry:['Încerc din nou să obțin informațiile necesare.','Reîncercarea este în curs; aștept răspunsul serviciului.'],
};
const waiting=[
 'Cererea ta este în curs. Aștept rezultatul.',
 'Te rog să aștepți răspunsul înainte de a relua solicitarea.',
 'Încă nu am rezultatul final. Îți spun când îl primesc.',
 'Solicitarea este încă în procesare; nu este nevoie să o repeți.',
 'Aștept încheierea procesării ca să îți pot spune rezultatul.',
 'Poți rămâne în conversație. Îți comunic rezultatul când este disponibil.',
 'Nu am primit încă răspunsul complet. Te rog să mai aștepți.',
 'Cererea rămâne în lucru; răspunsul final nu este disponibil încă.',
 'Îți voi explica ce s-a realizat după ce primesc rezultatul.',
 'Aștept răspunsul pentru solicitarea începută; nu îl pot confirma încă.',
 'Procesarea nu s-a încheiat. Revin cu rezultatul când îl am.',
 'Te anunț aici când primesc răspunsul complet.',
 'Deocamdată aștept rezultatul cererii tale.',
 'Mai este nevoie să așteptăm răspunsul; solicitarea este în curs.',
 'Rămân în așteptarea rezultatului pentru această cerere.',
 'Îți comunic rezultatul imediat ce este disponibil în conversație.',
 'Solicitarea începută nu are încă un răspuns final.',
 'Aștept informațiile de care am nevoie pentru a încheia răspunsul.',
];
function messages(stage?:string){return stages[stage==='goal_coverage'?'verify_request_coverage':stage==='tool_retry'?'provider_retry':stage||'']||[];}
export function voiceProgressText(stage?:string){return messages(stage)[0]||waiting[0];}
export function startVoiceProgress(say:(text:string)=>Promise<void>,cancel:()=>void){
 let stage:string|undefined,stopped=false,speaking=false;
 const used=new Set<string>();
 const tick=async()=>{
  if(stopped||speaking)return;
  // Exhausted wording stays quiet rather than repeating, counting time or inventing progress.
  const text=[...messages(stage),...waiting].find(candidate=>!used.has(candidate));
  if(!text)return;
  used.add(text);speaking=true;
  try{await say(text);}catch{/* Narration failure must not stop the task. */}finally{speaking=false;}
 };
 let interval:ReturnType<typeof setInterval>|undefined;
 const first=setTimeout(()=>{void tick();interval=setInterval(()=>{void tick();},10000);},5000);
 return {update:(_text:string,next?:string)=>{stage=next;},stop:()=>{stopped=true;clearTimeout(first);clearInterval(interval);cancel();}};
}
