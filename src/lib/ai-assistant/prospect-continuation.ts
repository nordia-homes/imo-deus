import { normalized, type AssistantAction, type AssistantMessage } from './contracts';

export type ProspectContinuation = { listingId: string; request: string };
export const humanCallTaskRequest = (prompt: string) => /^(creeaza|creaza|adauga) (?:un )?task de apel uman in loc de apel ai\b/.test(normalized(prompt));
export function prospectClarification(prompt: string, history: AssistantMessage[]) {
  if (/^(creeaza|creaza|adauga) (?:un )?task de apel uman in loc de apel ai[.!?\s]*$/.test(normalized(prompt))) return pendingProspectRequest(prompt, 'clarification', history) ? 'Pentru ce zi dorești taskul de apel uman? Poți indica și ora, în fusul Bucureștiului.' : 'Selectează prospectul pentru taskul de apel uman și indică ziua dorită.';
  if (!pendingProspectRequest(prompt, 'clarification', history)) return;
  const text = normalized(prompt).replace(/[.!?]+$/, '').trim();
  if (/^(adauga|noteaza|inregistreaza)( in prospectare)? conditiile discutate cu proprietarul$/.test(text)) return 'Ce condiții ai discutat cu proprietarul? Le voi adăuga la notele prospectului selectat.';
  if (/^(actualizeaza|schimba|modifica|seteaza) (statusul|starea) prospectului(?: (selectat|acesta|curent))?$/.test(text)) return 'Ce status dorești pentru prospectul selectat: preluat, rezervat, colaborează, nu colaborează sau un rezultat de contact?';
  if (/^(adauga|noteaza|inregistreaza) rezultatul apelului(?: de (azi|astazi|ieri))?$/.test(text)) return 'Care a fost rezultatul apelului și ce detalii dorești să păstrez la prospectul selectat?';
}
export function pendingProspectRequest(prompt: string, status: string, history: AssistantMessage[]): ProspectContinuation | undefined {
  if (status !== 'clarification' || (!humanCallTaskRequest(prompt) && (!/\b(actualizeaza|schimba|modifica|seteaza|adauga|noteaza|inregistreaza|marcheaza)\b/.test(normalized(prompt)) || !/\b(prospect|prospectul|prospectului|prospectare|proprietarul|apelului)\b/.test(normalized(prompt))))) return;
  for (const message of [...history].reverse()) {
    const cards = message.cards?.filter(card => card.source === 'ownerListingFavorites');
    if (!cards?.length) continue;
    const ids = [...new Set(cards.flatMap(card => card.rows.map(row => row.id)).filter((id): id is string => typeof id === 'string'))];
    return ids.length === 1 ? { listingId: ids[0], request: prompt } : undefined;
  }
}
export function prospectPlanningPrompt(prompt: string, history: AssistantMessage[]) {
  const pending = history.at(-1)?.prospectContinuation;
  if (/^doar\s+(explica|arata|verifica|pregateste|analizeaza)\b/.test(normalized(prompt))) return prompt;
  if (history.at(-1)?.role !== 'assistant' || !pending) return prompt;
  if (/\b(anuleaza|opreste|renunta|renunt|stop|nu vreau|lasa|arata|pregateste|nu mai actualiza|nu mai modifica|nu actualiza|nu modifica|nu adauga|nu marca|nu (?:mai )?(?:crea|creea|programa))\b/.test(normalized(prompt))) return prompt;
  return `${pending.request}\n${prompt}`;
}
export function prospectExecutionPrompt(prompt: string, actions: AssistantAction[], history: AssistantMessage[]) {
  const pending = history.at(-1)?.prospectContinuation;
  if (pending && humanCallTaskRequest(pending.request)) return actions.length === 1 && actions[0].kind === 'create_task' && actions[0].ownerListingId === pending.listingId ? prospectPlanningPrompt(prompt, history) : prompt;
  if (!pending || !actions.length || actions.some(action => action.kind !== 'update_prospect' || action.listingId !== pending.listingId)) return prompt;
  return prospectPlanningPrompt(prompt, history);
}
