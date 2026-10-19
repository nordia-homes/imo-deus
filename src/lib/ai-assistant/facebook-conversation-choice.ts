import { matchesFacebookProperty } from './facebook-natural';
import type { AssistantMessage } from './contracts';
import { namedChoiceText, type NamedChoice } from './named-choice-contract';
import { facebookNameMatches, facebookAccountAnswer } from './facebook-name-match';
import { normalizeCrmSearch } from '@/lib/crm/search-text';
export function facebookConversationChoice(prompt:string, history:AssistantMessage[]){
 // A validated named choice has already been translated to the domain handler's input.
 if(/^(?:cont facebook|proprietate):\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt))return null;
 const latest=history.filter(m=>m.role==='assistant'&&m.id!=='current-page-context').at(-1);
 const cards=latest?.cards?.filter(c=>['facebookSemanticAccount','facebookPublicationAccount','facebookSemanticProperty','facebookPublicationProperty'].includes(c.choiceSource||''))||[];
 if(!latest||cards.length!==1)return null;
 const card=cards[0],source=card.choiceSource! as NamedChoice['source'];
 const property=source==='facebookSemanticProperty'||source==='facebookPublicationProperty';
 const text=normalizeCrmSearch(prompt);
 const yes=['da','confirm','confirma','da confirm','da acesta','acesta','exact','corect','da corect','da aceasta','aceasta','da publica','da continua','confirm proprietatea'].includes(text);
 const propertyQuery=text.replace(/^(?:aleg|selectez|confirm) (?:proprietatea |apartamentul |casa )?/, '');
 const matching=property ? {exact: /\b(?:nu|fara|doar|apoi|maine|daca|trimite)\b/.test(text)?[]:card.rows.filter(row=>matchesFacebookProperty(row,propertyQuery)),suggestions:[]} : facebookNameMatches(card.rows,prompt);
 const chosen=yes?(card.rows.length===1?card.rows[0]:null):matching.exact.length===1?matching.exact[0]:matching.suggestions.length===1?matching.suggestions[0]:null;
 if(chosen){const choice:NamedChoice={messageId:latest.id,source,rowId:String(chosen.id),...(card.choiceOfferId?{offerId:card.choiceOfferId}:{})};return {choice,prompt:namedChoiceText(source,chosen)};}
 if(yes&&card.rows.length>1){const text=property?'Sunt mai multe proprietăți disponibile. Spune titlul sau adresa proprietății dorite.':'Sunt mai multe conturi disponibile. Spune numele contului dorit, ca să continui cu cel corect.';return {suggestion:{text,cards:latest.cards!.map(c=>c===card?{...c,note:text}:c)}};}
 const candidates=matching.exact.length?matching.exact:matching.suggestions;
 if(candidates.length){
  const names=candidates.map(row=>row.label||row.displayName||row.title).join(' sau ');
  const question=property?'Mai multe proprietăți corespund: '+names+'. Pe care vrei să o public?':candidates.length===1?'Te referi la contul Facebook „'+names+'”? Spune da pentru a continua cererea începută sau indică alt cont.':'Am găsit conturi cu nume apropiate: '+names+'. Pe care îl alegi?';
  return {suggestion:{text:question,cards:latest.cards!.map(c=>c===card?{...c,rows:candidates,note:question}:c)}};
 }
 if(!property&&facebookAccountAnswer(prompt)&&facebookAccountAnswer(prompt)!.length<=4){
  const text='Nu pot identifica sigur contul din numele auzit. Proprietatea și cererea de publicare rămân selectate. Spune numele complet al contului sau alege-l din lista afișată.';
  return {suggestion:{text,cards:latest.cards!.map(c=>c===card?{...c,note:text}:c)}};
 }
 return null;
}
