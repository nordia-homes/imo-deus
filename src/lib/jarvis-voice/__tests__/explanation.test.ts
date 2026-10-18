import { expect, it } from 'vitest';
import { presentVoice, concise } from '../presentation';
import { MAX_SPOKEN_CHARACTERS } from '../speech-limits';
import { executionConfirmation } from '@/lib/ai-assistant/execution-confirmation';
const receipt={operation:'facebook_job_create',jobId:'internal-job',propertyTitle:'Apartament Cișmigiu',connectionLabel:'Ștefan Nordia',groupCount:3,scheduledAt:null,executionState:'queued'};
it.each(['properties','crm','viewings','tasks','contacts'])('preserves the explanation when the first card is %s',source=>{
 const text=executionConfirmation([{result:receipt}]);
 const p=presentVoice({id:'m',role:'assistant',createdAt:'',text,cards:[{type:'data',source,title:'Rezultat',rows:[{id:'p'}]},{type:'data',source:'autonomy',title:'Execuție',rows:[{result:receipt}]}]});
 expect(p.spokenText).toBe(text);expect(p.spokenText).toContain('Ștefan Nordia');expect(p.spokenText).toContain('3 grupuri');expect(p.spokenText).toContain('nu este încă confirmată');expect(p.spokenText).not.toContain('internal-job');
});
it('keeps a clarification and later qualification beyond the former two sentences / 320 characters',()=>{
 const text='Am găsit proprietatea. Am verificat conturile. '+ 'Detalii utile despre selecție. '.repeat(20)+'De pe ce cont Facebook vrei să public?';
 const p=presentVoice({id:'m',role:'assistant',createdAt:'',text,cards:[{type:'data',source:'properties',title:'Proprietate',rows:[]}]});
 expect(p.spokenText).toBe(text);
});
it('does not replace a failed execution explanation with a successful search count',()=>{
 const text='Nu am pornit publicarea: contul trebuie reconectat. Reconectează-l, apoi pot relua cererea.';
 expect(presentVoice({id:'m',role:'assistant',createdAt:'',text,cards:[{type:'data',source:'properties',title:'Proprietate',rows:[{id:'p'}]}]}).spokenText).toBe(text);
});
it('uses committed results for completed plans instead of counting actions',()=>{
 const result=presentVoice({id:'m',role:'assistant',text:'Plan pregătit',createdAt:''},{status:'completed',actions:[],results:[{result:receipt}]} as any);
 expect(result.spokenText).toContain('Apartament Cișmigiu');expect(result.spokenText).toContain('nu este încă confirmată');
});
it('explicitly announces the remainder of exceptionally long responses',()=>{
 const text=concise('Propoziție completă. '.repeat(1000));
 expect(text.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARACTERS);expect(text).toContain('Răspunsul complet continuă în conversație.');
});
