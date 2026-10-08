import { getResource, type AssistantContext } from './access';
import type { AssistantMessage } from './contracts';
import { currentRecordSchema, type CurrentRecord } from './current-record-contract';

export async function currentRecordMessage(ctx: AssistantContext, input: CurrentRecord | null): Promise<AssistantMessage> {
  if (input === null) return { id: 'current-page-context', role: 'assistant', text: 'Pagina curentă nu are un client sau o proprietate deschisă. Pentru o cerere despre clientul/proprietatea deschisă acum cere alegerea; nu substitui o pagină vizitată anterior.', cards: [], createdAt: new Date().toISOString() };
  const reference = currentRecordSchema.parse(input);
  const record = await getResource(ctx, reference.resource, reference.id);
  const label = reference.resource === 'contacts' ? 'Clientul deschis acum' : 'Proprietatea deschisă acum';
  // Browser input supplies only a reference. Names and values come from this tenant.
  const row = Object.fromEntries(['id', 'name', 'title', 'status'].filter(key => record[key] !== undefined).map(key => [key, record[key]]));
  return { id: 'current-page-context', role: 'assistant', text: `${label}: ${reference.id}. Referință verificată în CRM pentru comanda curentă.`, createdAt: new Date().toISOString(),
    cards: [{ type: 'data', source: reference.resource, title: label, rows: [row], complete: true }],
    ...(reference.resource === 'contacts' ? { accessRefs: [{ resource: 'contacts', id: reference.id }] } : {}),
  };
}
