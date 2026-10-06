import { z } from 'zod';
import { getResource, type AssistantContext } from './access';
import { contextSelectionSchema } from './context-selection-contract';
const selectionSchema = z.object({ messageId: z.string().optional(), source: z.string(), resultSetId: z.string().nullable().optional(), orderedIds: z.array(z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:-]+$/)).max(100) }).passthrough();
export async function selectContext(ctx: AssistantContext, summary: unknown, input: z.infer<typeof contextSelectionSchema>) {
  const parsed = z.object({ selections: z.array(selectionSchema).max(8) }).passthrough().safeParse(summary);
  if (!parsed.success) throw new Error('Lista contextuală nu mai este disponibilă. Citește din nou rezultatele.');
  const candidates = parsed.data.selections.filter(row => (!input.messageId || row.messageId === input.messageId) && (!input.resultSetId || row.resultSetId === input.resultSetId) && (!input.source || row.source === input.source));
  if (candidates.length !== 1) throw new Error('Referință ambiguă sau absentă. Precizează lista prin messageId/resultSetId și source.');
  const selected = candidates[0], resource = selected.source === 'crm' ? 'properties' : selected.source;
  if (!['properties', 'contacts', 'tasks', 'viewings', 'sales', 'conversations'].includes(resource)) throw new Error('Această listă cere instrumentul dedicat sursei.');
  if (new Set(input.positions).size !== input.positions.length || input.positions.some(position => !selected.orderedIds[position - 1])) throw new Error('Poziția nu există în lista afișată.');
  // Resolve the saved order, then re-read current authorized records. Never re-rank.
  const rows = await Promise.all(input.positions.map(async position => {
    const id = selected.orderedIds[position - 1];
    return { ...await getResource(ctx, resource, id), id, selectedPosition: position };
  }));
  return { rows, resource, complete: true, sourceMessageId: selected.messageId || null, resultSetId: selected.resultSetId || null, orderSource: 'saved_display_order', note: 'Pozițiile sunt din lista afișată; datele au fost recitite cu permisiunile actuale. Scorurile de matching nu sunt recalculate.' };
}
