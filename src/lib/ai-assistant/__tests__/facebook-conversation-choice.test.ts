import { expect,it } from 'vitest';
import { facebookConversationChoice } from '../facebook-conversation-choice';
import { facebookNameMatches } from '../facebook-name-match';
const rows=[{id:'one',label:'Ștefan Nordia'},{id:'two',label:'Stefan Nordea'}];
it('never auto-selects a close name',()=>{const result=facebookNameMatches(rows,'Stefan Nordeia');expect(result.exact).toEqual([]);expect(result.suggestions).toHaveLength(2);});
it.each(['nu Stefan Nordia','Stefan Nordia maine','doar Stefan Nordia','...',''])('does not swallow restrictions or empty names: %s',text=>expect(facebookNameMatches(rows,text).exact).toEqual([]));
it('only accepts a yes for one offered account, never an unrelated or older offer',()=>{
 const offer={id:'offer',role:'assistant',text:'Cont?',cards:[{type:'data',source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows:[rows[0]]}]} as any;
 expect(facebookConversationChoice('Da',[offer])?.choice?.rowId).toBe('one');
 expect(facebookConversationChoice('Da',[offer,{id:'other',role:'assistant',text:'Altceva'}] as any)).toBeNull();
 expect(facebookConversationChoice('Da',[{...offer,cards:[{...offer.cards[0],rows}]}])?.choice).toBeUndefined();
});
it('keeps an ambiguous pronunciation as a question with original constraints',()=>{
 const state={type:'data',source:'facebookSemanticRequest',rows:[{prompt:'Nu publica încă; doar pregătește.',input:{propertyId:'p',groupUrls:['https://facebook.com/groups/one']}}]};
 const result=facebookConversationChoice('Stefan Nordeia',[{id:'offer',role:'assistant',text:'Cont?',cards:[{type:'data',source:'facebookConnections',choiceSource:'facebookSemanticAccount',rows},state]}] as any);
 expect(result?.suggestion?.cards[1]).toEqual(state);expect(result?.choice).toBeUndefined();
});

it('proposes the reported transcription without silently selecting an account',()=>{const result=facebookNameMatches([{id:'c',label:'Cristian Avadanii'}],'Croatian Avadanii');expect(result.exact).toHaveLength(0);expect(result.suggestions.map(row=>row.id)).toEqual(['c']);});

it('selects the unique close name directly from the current offer',()=>{const result=facebookConversationChoice('Croatian Avadanii',[{id:'offer',role:'assistant',text:'Cont?',cards:[{type:'data',source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows:[{id:'c',label:'Cristian Avadanii'},{id:'other',label:'Alt Cont'}]}]}] as any);expect(result?.choice?.rowId).toBe('c');expect(result?.suggestion).toBeUndefined();});

it.each(['Vreau să publici de pe contul Diana Radu.','Publică de pe contul Diana Radu','Folosește contul Facebook Diana Radu','Contul Diana Radu'])('resolves full selection sentences: %s',prompt=>{
 const offer={id:'offer',role:'assistant',cards:[{type:'data',source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows:[{id:'diana',label:'Diana Radu'},{id:'cristian',label:'Cristian Radu'}]}]} as any;
 expect(facebookConversationChoice(prompt,[offer])?.choice?.rowId).toBe('diana');
});
it.each(['Nu publica de pe contul Diana Radu','Publică de pe contul Diana Radu mâine','Diana Radu și trimite și pe WhatsApp'])('keeps additional intent intact: %s',prompt=>{
 expect(facebookNameMatches([{id:'diana',label:'Diana Radu'}],prompt).exact).toEqual([]);
});
it('confirms the current property and resolves partial addresses without selecting ambiguous offers',()=>{
 const card={type:'data',source:'properties',choiceSource:'facebookPublicationProperty',rows:[{id:'p',title:'Casă Corbeanca',address:'Strada Florilor 12'}]};
 const offer={id:'offer',role:'assistant',cards:[card]} as any;
 expect(facebookConversationChoice('Da, aceasta',[offer])?.choice?.rowId).toBe('p');
 expect(facebookConversationChoice('Florilor 12',[offer])?.choice?.rowId).toBe('p');
 expect(facebookConversationChoice('Da',[{...offer,cards:[{...card,rows:[...card.rows,{id:'p2',title:'Altă casă'}]}]}])?.choice).toBeUndefined();
});

it.each(['Cristiana Vădăni.','Vădăni Cristiana','Cristian Avadani','Publică de pe contul Cristiana Vădăni.'])('matches a unique multi-token spoken name: %s',prompt=>{
 const rows=[{id:'c',label:'Cristian Avadanii'},{id:'m',label:'Cristian Matei'},{id:'d',label:'Diana Radu'}];
 const offer={id:'offer',role:'assistant',cards:[{source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows}]};
 expect(facebookConversationChoice(prompt,[offer] as any)?.choice?.rowId).toBe('c');
});
it('does not silently select between similar offered people or reuse one name token twice',()=>{
 const rows=[{id:'c',label:'Cristian Avadanii'},{id:'x',label:'Cristiana Avadani'}];
 const offer={id:'offer',role:'assistant',cards:[{source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows}]};
 expect(facebookConversationChoice('Cristiana Vădăni',[offer] as any)?.choice).toBeUndefined();
 expect(facebookConversationChoice('Cristiana Vădăni',[offer] as any)?.suggestion?.cards[0].rows).toHaveLength(2);
 expect(facebookNameMatches([{id:'c',label:'Cristian Avadanii'}],'Cristian Cristian').suggestions).toEqual([]);
});
it('keeps an unmatched name in the current account selection instead of restarting the property search',()=>{
 const pending={source:'facebookImmediateRequest',rows:[{prompt:'Publică apartamentul din Rosetti pe grupurile Facebook.',propertyId:'p'}]};
 const offer={id:'offer',role:'assistant',cards:[{source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows:[{id:'c',label:'Cristian Avadanii'}]},pending]};
 const answer=facebookConversationChoice('Vasile Ionescu',[offer] as any);
 expect(answer?.choice).toBeUndefined();expect(answer?.suggestion?.cards[1]).toEqual(pending);
 for(const prompt of ['Câte vizionări sunt mâine?','Arată proprietățile din Titan','Nu Cristian Avadanii','Publică de pe contul Cristian Avadanii mâine'])expect(facebookConversationChoice(prompt,[offer] as any)).toBeNull();
});

it('preserves exact choices for account labels containing numbers',()=>{expect(facebookNameMatches([{id:'n',label:'Nordia 2'}],'Nordia 2').exact.map(r=>r.id)).toEqual(['n']);});

it('does not reinterpret the validated internal choice as another spoken name',()=>{const offer={id:'offer',role:'assistant',cards:[{source:'facebookConnections',choiceSource:'facebookPublicationAccount',rows:[{id:'connection',label:'Cristian Avadanii'}]}]};expect(facebookConversationChoice('Cont Facebook: connection',[offer] as any)).toBeNull();});

it('labels ambiguous property matches as properties, not Facebook accounts',()=>{const rows=[{id:'one',title:'Rosetti apartament'},{id:'two',title:'Rosetti garsonieră'}];const offer={id:'offer',role:'assistant',cards:[{source:'properties',choiceSource:'facebookPublicationProperty',rows}]};const result=facebookConversationChoice('Rosetti',[offer] as any);expect(result?.choice).toBeUndefined();expect(result?.suggestion?.text).toContain('proprietăți');expect(result?.suggestion?.text).toContain('Rosetti garsonieră');});
