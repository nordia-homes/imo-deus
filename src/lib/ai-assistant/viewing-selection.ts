import type { AssistantMessage } from './contracts';

/** Preserve the latest displayed list, including an empty list overriding older context. */
export function selectedViewingList(history: AssistantMessage[], summary?: unknown): string[] {
  const cards = history.filter(message => message.role === 'assistant').flatMap(message => message.cards || []).filter(card => card.source === 'viewings');
  const selections = (summary as { selections?: any[] } | undefined)?.selections;
  const ids: unknown = cards.length ? cards.at(-1)!.rows.map(row => row.id)
    : Array.isArray(selections) ? selections.filter(row => row?.source === 'viewings').at(-1)?.orderedIds : [];
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(id))) return [];
  return [...new Set(ids)] as string[];
}

/** Only conversation context supplied before this turn can select a viewing. */
export function selectedViewing(history: AssistantMessage[], summary?: unknown): string | undefined {
  const sources = ['viewings', 'viewing_confirmation'];
  const cards = history.flatMap(message => message.cards || []).filter(card => sources.includes(card.source));
  if (cards.length) {
    const rows = cards.at(-1)!.rows;
    return rows.length === 1 && typeof rows[0].id === 'string' ? rows[0].id : undefined;
  }
  const selections = (summary as { selections?: unknown } | undefined)?.selections;
  if (!Array.isArray(selections)) return undefined;
  const latest = selections.filter(row => row && sources.includes(row.source)).at(-1);
  return Array.isArray(latest?.orderedIds) && latest.orderedIds.length === 1 && typeof latest.orderedIds[0] === 'string' ? latest.orderedIds[0] : undefined;
}

export function hasViewingSelection(id: string, prompt: string, selectedId?: string): boolean {
  const explicit = Array.from(prompt.matchAll(/\bID\s*:\s*([A-Za-z0-9_.:-]+)/gi), match => match[1]);
  return explicit.length ? explicit.length === 1 && explicit[0] === id : selectedId === id;
}
