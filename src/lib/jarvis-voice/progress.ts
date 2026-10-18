// Narration follows verified stages only, never raw tool output.
export function voiceProgressText(stage?: string) {
 const messages: Record<string,string> = {
 query_records:'Consult datele din aplicație pentru cererea ta.',
 search_properties:'Caut proprietatea potrivită în portofoliu.',
 facebook_publication_preflight:'Verific proprietatea, contul Facebook și grupurile pentru publicare.',
 verify_request_coverage:'Verific să fie îndeplinite toate cerințele tale.',
 goal_coverage:'Verific să fie îndeplinite toate cerințele tale.',
 propose_actions:'Pregătesc pașii necesari pentru cererea ta.',
 planning:'Verific ce mai este necesar pentru cererea ta.',
 provider_retry:'Durează puțin mai mult. Încerc din nou să obțin informațiile necesare.',
 tool_retry:'Durează puțin mai mult. Încerc din nou să obțin informațiile necesare.'
 };
 return messages[stage || ''] || 'Cererea ta este în curs. Aștept rezultatul.';
}
export function startVoiceProgress(say:(text:string)=>Promise<void>,cancel:()=>void){
 let stage:string|undefined,stopped=false,speaking=false;
 const used=new Set<string>();let elapsed=5;
 const tick=async()=>{
  if(stopped||speaking)return;
  const current=voiceProgressText(stage);
  // Elapsed time varies without inventing a new processing stage or a deadline.
  const text=used.has(current)?'Au trecut '+elapsed+(elapsed%100>=20||elapsed%100===0?' de':'')+' secunde. Rezultatul nu a sosit încă.':current;
  if(used.has(text))return;
  used.add(text);speaking=true;
  try{await say(text);}catch{/* A narration failure must not stop the task. */}finally{speaking=false;}
 };
 let interval:ReturnType<typeof setInterval>|undefined;
 const first=setTimeout(()=>{void tick();interval=setInterval(()=>{elapsed+=10;void tick();},10000);},5000);
 return {update:(_text:string,next?:string)=>{stage=next;},stop:()=>{stopped=true;clearTimeout(first);clearInterval(interval);cancel();}};
}
