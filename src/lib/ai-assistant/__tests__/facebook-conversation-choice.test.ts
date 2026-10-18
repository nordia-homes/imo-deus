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
it('preserves the full request and selected group constraints while proposing a pronunciation match',()=>{
 const state={type:'data',source:'facebookSemanticRequest',rows:[{prompt:'Nu publica încă; doar pregătește.',input:{propertyId:'p',groupUrls:['https://facebook.com/groups/one']}}]};
 const result=facebookConversationChoice('Stefan Nodia',[{id:'offer',role:'assistant',text:'Cont?',cards:[{type:'data',source:'facebookConnections',choiceSource:'facebookSemanticAccount',rows:[rows[0]]},state]}] as any);
 expect(result?.suggestion?.cards[1]).toEqual(state);expect(result?.choice).toBeUndefined();
});

it('proposes the reported transcription without silently selecting an account',()=>{const result=facebookNameMatches([{id:'c',label:'Cristian Avadanii'}],'Croatian Avadanii');expect(result.exact).toHaveLength(0);expect(result.suggestions.map(row=>row.id)).toEqual(['c']);});
