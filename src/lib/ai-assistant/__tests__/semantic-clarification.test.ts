import { expect,it } from 'vitest';
import { retainSemanticChoices } from '../semantic-clarification';
import type { AssistantCard,AssistantMessage } from '../contracts';
const card=(id:string,state=false):AssistantCard=>({type:'data',source:state?'facebookSemanticRequest':'facebookConnections',title:'Conturi',choiceOfferId:id,...(!state?{choiceSource:'facebookSemanticAccount' as const}:{}),rows:state?[{prompt:'original',input:{propertyId:id}}]:[{id:'same',label:'Contul agenției'}]});
it('retains only unanswered offers with previous selections and collapses exact repeated offers',()=>{
 const previous={id:'m',role:'assistant',text:'Alege',createdAt:'now',cards:[card('a'),card('a',true),card('b'),card('b',true)]} as AssistantMessage;
 const result=retainSemanticChoices([],previous,{messageId:'m',source:'facebookSemanticAccount',rowId:'same',offerId:'a'},'original plus prima selecție');
 expect(result).toHaveLength(2);expect(result.every(card=>card.choiceOfferId==='b')).toBe(true);
 expect(result.find(card=>card.source==='facebookSemanticRequest')!.rows[0].prompt).toBe('original plus prima selecție');
 expect(retainSemanticChoices([...result,...result],undefined,undefined,'')).toHaveLength(2);
 expect(previous.cards![3].rows[0].prompt).toBe('original');
});
it('does not carry old offers into an unrelated request',()=>{
 const previous={cards:[card('a')]} as AssistantMessage;
 expect(retainSemanticChoices([],previous,undefined,'new request')).toEqual([]);
});
