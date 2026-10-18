import type { AssistantMessage } from './contracts';
import { namedChoiceSchema, namedChoiceText, namedGroupChoiceText, type NamedChoice, type ChoiceSource } from './named-choice-contract';
import { CommunicationError } from '@/lib/communications/server';
const prefixes: Record<ChoiceSource,string> = {
 facebookPublicationGroups:'Grupuri Facebook',facebookPublicationProperty:'Proprietate',facebookPublicationAccount:'Cont Facebook',facebookDefaultAccount:'Cont Facebook',facebookScheduleProperty:'Proprietate',
 metaImageResumeSelection:'Reia optimizarea Meta',metaImageSelection:'Imagine optimizare Meta',metaImageApproval:'Confirm optimizarea Meta',metaPerformanceSelection:'Statistici Meta',metaPublishSelection:'Confirm publicarea Meta',metaStatusSelection:'Stare Meta',metaPauseSelection:'Confirm pauza Meta',metaMediaSelection:'Material Meta',metaMediaCampaignSelection:'Campanie material Meta',metaReviewSelection:'Campanie Meta',metaDraftSelection:'Draft Meta',
};
// History has already passed session ownership and current resource ACL checks.
// Existing domain handlers additionally compare saved revisions and live data.
export function resolveNamedChoice(choice: NamedChoice, prompt: string, history: AssistantMessage[]) {
 const parsed=namedChoiceSchema.parse(choice);
 const latest=history.filter(message=>message.role==='assistant' && message.id!=='current-page-context').at(-1);
 if (!latest || latest.id!==parsed.messageId) throw new CommunicationError('Selecția nu mai este cea curentă. Reafișează opțiunile înainte de alegere.',409);
 const cards=latest.cards?.filter(card=>(card.choiceSource || card.source)===parsed.source) || [];
 if (parsed.rowIds) {
  if (cards.length !== 1) throw new CommunicationError('Lista grupurilor nu mai este disponibilă.',409);
  const selected = parsed.rowIds.map(id => cards[0].rows.filter(row => row.id === id));
  if (selected.some(rows => rows.length !== 1)) throw new CommunicationError('Un grup nu este disponibil în răspunsul curent.',409);
  if (prompt !== namedGroupChoiceText(selected.map(rows => rows[0]))) throw new CommunicationError('Textul nu corespunde grupurilor selectate.',409);
  return 'Grupuri Facebook: '+parsed.rowIds.join(', ');
 }
 const rows=cards.flatMap(card=>card.rows.filter(row=>row.id===parsed.rowId));
 if (cards.length!==1 || rows.length!==1) throw new CommunicationError('Opțiunea nu este disponibilă în răspunsul curent.',409);
 if (prompt!==namedChoiceText(parsed.source,rows[0])) throw new CommunicationError('Textul solicitării nu corespunde opțiunii selectate.',409);
 return prefixes[parsed.source]+': '+parsed.rowId;
}
