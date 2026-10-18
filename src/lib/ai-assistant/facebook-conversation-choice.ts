import type { AssistantMessage } from './contracts';
import { namedChoiceText, type NamedChoice } from './named-choice-contract';
import { facebookNameMatches } from './facebook-name-match';
import { normalizeCrmSearch } from '@/lib/crm/search-text';
export function facebookConversationChoice(prompt:string, history:AssistantMessage[]){
 const latest=history.filter(m=>m.role==='assistant'&&m.id!=='current-page-context').at(-1);
 const cards=latest?.cards?.filter(c=>['facebookSemanticAccount','facebookPublicationAccount'].includes(c.choiceSource||''))||[];
 if(!latest||cards.length!==1)return null;
 const card=cards[0],source=card.choiceSource! as NamedChoice['source'];
 const text=normalizeCrmSearch(prompt);
 const yes=['da','confirm','confirma','da confirm','da acesta','acesta','exact','corect','da corect'].includes(text);
 const matching=facebookNameMatches(card.rows,prompt);
 const chosen=yes&&card.rows.length===1?card.rows[0]:matching.exact.length===1?matching.exact[0]:matching.suggestions.length===1?matching.suggestions[0]:null;
 if(chosen){const choice:NamedChoice={messageId:latest.id,source,rowId:String(chosen.id),...(card.choiceOfferId?{offerId:card.choiceOfferId}:{})};return {choice,prompt:namedChoiceText(source,chosen)};}
 if(yes&&card.rows.length>1){const text='Sunt mai multe conturi disponibile. Spune numele contului dorit, ca să continui cu cel corect.';return {suggestion:{text,cards:latest.cards!.map(c=>c===card?{...c,note:text}:c)}};}
 if(matching.suggestions.length){
  const names=matching.suggestions.map(row=>row.label||row.displayName).join(' sau ');
  const question=matching.suggestions.length===1?'Te referi la contul Facebook „'+names+'”? Spune da pentru a continua cererea începută sau indică alt cont.':'Am găsit conturi cu nume apropiate: '+names+'. Pe care îl alegi?';
  return {suggestion:{text:question,cards:latest.cards!.map(c=>c===card?{...c,rows:matching.suggestions,note:question}:c)}};
 }
 return null;
}
