import { normalized, type AssistantAction, type AssistantMessage } from './contracts';

export type ProspectContinuation = { listingId: string; request: string };
export function prospectClarification(prompt: string, history: AssistantMessage[]) {
  if (!pendingProspectRequest(prompt, 'clarification', history)) return;
  const text = normalized(prompt).replace(/[.!?]+$/, '').trim();
  if (/^(actualizeaza|schimba|modifica|seteaza) (statusul|starea) prospectului(?: (selectat|acesta|curent))?$/.test(text)) return 'Ce status dorești pentru prospectul selectat: preluat, rezervat, colaborează, nu colaborează sau un rezultat de contact?';
  if (/^(adauga|noteaza|inregistreaza) rezultatul apelului(?: de (azi|astazi|ieri))?$/.test(text)) return 'Care a fost rezultatul apelului și ce detalii dorești să păstrez la prospectul selectat?';
}
export function pendingProspectRequest(prompt: string, status: string, history: AssistantMessage[]): ProspectContinuation | undefined {
  if (status !== 'clarification' || !/\b(actualizeaza|schimba|modifica|seteaza|adauga|noteaza|inregistreaza|marcheaza)\b/.test(normalized(prompt)) || !/\b(prospect|prospectul|prospectului|apelului)\b/.test(normalized(prompt))) return;
  for (const message of [...history].reverse()) {
    const cards = message.cards?.filter(card => card.source === 'ownerListingFavorites');
    if (!cards?.length) continue;
    const ids = [...new Set(cards.flatMap(card => card.rows.map(row => row.id)).filter((id): id is string => typeof id === 'string'))];
    return ids.length === 1 ? { listingId: ids[0], request: prompt } : undefined;
  }
}
export function prospectExecutionPrompt(prompt: string, actions: AssistantAction[], history: AssistantMessage[]) {
  const pending = history.at(-1)?.prospectContinuation;
  if (history.at(-1)?.role !== 'assistant' || !pending || !actions.length || actions.some(action => action.kind !== 'update_prospect' || action.listingId !== pending.listingId)) return prompt;
  if (/\b(anuleaza|opreste|renunta|renunt|stop|nu vreau|lasa|doar|arata|pregateste|nu mai actualiza|nu mai modifica|nu actualiza|nu modifica|nu adauga|nu marca)\b/.test(normalized(prompt))) return prompt;
  return `${pending.request}\n${prompt}`;
}
