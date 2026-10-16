import type { AssistantMessage } from './contracts';
import { promisingProspects } from './promising-prospects';

export function selectedProspectRanking(history: AssistantMessage[]): Record<string, unknown>[] | null {
  const message = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const cards = message?.cards?.filter(card => card.source === 'ownerListingFavorites' && ['Prospecte prioritare', 'Explicația prioritizării'].includes(card.title) && card.complete === true) || [];
  if (cards.length !== 1) return null;
  const rows = cards[0].rows;
  if (!rows.length || rows.length > 10 || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => typeof row.id !== 'string' || (typeof row.priorityScore !== 'number' || ![0, 20, 40, 60].includes(row.priorityScore)) || !Array.isArray(row.priorityReasons) || row.priorityReasons.some(reason => typeof reason !== 'string'))) return null;
  return rows;
}

// Preserve the displayed ranking; fresh state is evidence about changes, not
// permission to silently replace the ranking the agent asked us to explain.
export function explainProspectRanking(snapshot: Record<string, unknown>[], current: Record<string, unknown>[], uid: string, at: number) {
  const byId = new Map(current.map(row => [row.id, row]));
  return snapshot.map((row, index) => {
    const fresh = byId.get(row.id);
    const eligible = fresh ? promisingProspects([fresh], uid, at)[0] : undefined;
    if (!eligible) return { id: row.id, position: index + 1, state: 'unavailable', explanation: 'Prospectul nu mai este eligibil sau accesibil în lista proprie/neatribuită. Nu reluăm detaliile vechi.' };
    return { id: row.id, title: row.title || row.id, position: index + 1,
      priorityScore: row.priorityScore, priorityReasons: row.priorityReasons,
      currentPriorityScore: eligible.priorityScore,
      state: eligible.priorityScore === row.priorityScore ? 'unchanged' : 'changed',
      explanation: 'Punctajul și poziția explicate sunt cele afișate anterior; punctajul curent este raportat separat.' };
  });
}
