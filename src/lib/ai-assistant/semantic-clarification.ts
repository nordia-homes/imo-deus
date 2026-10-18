import type { AssistantCard, AssistantMessage } from './contracts';
import type { NamedChoice } from './named-choice-contract';

export function retainSemanticChoices(cards: AssistantCard[], previous: AssistantMessage | undefined, choice: NamedChoice | undefined, continuedPrompt: string) {
 const semantic = choice?.source === 'facebookSemanticProperty' || choice?.source === 'facebookSemanticAccount';
 const carry = semantic && choice.offerId ? (previous?.cards || []).filter(card => card.choiceOfferId && card.choiceOfferId !== choice.offerId && (card.source === 'facebookSemanticRequest' || card.choiceSource === 'facebookSemanticProperty' || card.choiceSource === 'facebookSemanticAccount')).map(card => card.source === 'facebookSemanticRequest' ? {...card,rows:card.rows.map(row=>({...row,prompt:continuedPrompt}))} : card) : [];
 const seen=new Set<string>();
 return [...cards,...carry].filter(card=>{
  if (!card.choiceOfferId) return true;
  const key=card.choiceOfferId+':'+card.source;
  if(seen.has(key)) return false;
  seen.add(key);return true;
 });
}
