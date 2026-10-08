import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { resolveDatetime } from './datetime';
import { zonedParts } from './zoned-time';
import { attendanceState } from '@/lib/crm/viewing-attendance';

export const viewingAttendanceSchema = z.object({ dayOffset: z.number().int().min(0).max(365).default(1), cursor: z.string().min(1).max(180).optional() }).strict();
export async function viewingAttendance(ctx: AssistantContext, value: z.infer<typeof viewingAttendanceSchema>, now = new Date()) {
  const input = viewingAttendanceSchema.parse(value);
  const day = resolveDatetime({ dayOffset: input.dayOffset, time: '12:00' }, now).local.slice(0, 10);
  const matches: Record<string, any>[] = []; let cursor: string | undefined, exhausted = false;
  const started = Date.now();
  for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
    let query = collectionFor(ctx, 'viewings').where('agentId', '==', ctx.uid).orderBy('__name__').limit(250);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      const row = { ...doc.data(), id: doc.id } as Record<string, any>;
      if (row.status !== 'scheduled') continue;
      if (!Number.isFinite(Date.parse(row.viewingDate))) return { rows: [], complete: false, status: 'invalid_date', count: null, nextCursor: null };
      if (zonedParts(new Date(row.viewingDate), 'Europe/Bucharest').date === day) matches.push(row);
    }
    if (snapshot.size < 250) { exhausted = true; break; }
    cursor = snapshot.docs.at(-1)!.id;
  }
  if (!exhausted) return { rows: [], complete: false, status: 'partial', count: null, nextCursor: null };
  const related = new Map<string, Promise<Record<string, any> | null>>();
  const read = (source: string, id: unknown) => {
    if (typeof id !== 'string' || !id) return Promise.resolve(null);
    const key = `${source}/${id}`;
    if (!related.has(key)) related.set(key, getResource(ctx, source, id).catch(error => {
      if ([403, 404].includes(Number(error.status))) return null;
      throw error;
    }));
    return related.get(key)!;
  };
  const rows: Record<string, any>[] = [];
  for (const row of matches) {
    if (Date.now() - started >= 12000) return { rows: [], complete: false, status: 'partial', count: null, nextCursor: null };
    const [contact, property] = await Promise.all([read('contacts', row.contactId), read('properties', row.propertyId)]);
    const client = attendanceState(row, 'client', contact, property, now), owner = attendanceState(row, 'owner', contact, property, now);
    if (client.status === 'confirmed' && owner.status === 'confirmed') continue;
    const local = zonedParts(new Date(row.viewingDate), 'Europe/Bucharest');
    const label = (status: string) => status === 'confirmed' ? 'confirmat' : status === 'declined' ? 'a refuzat' : status === 'reschedule_requested' ? 'solicită reprogramare' : 'fără confirmare valabilă în CRM';
    rows.push({ id: row.id, title: `${contact?.name || 'Client lipsă'} — ${property?.title || 'Proprietate lipsă'}`,
      description: `Client: ${label(client.status)}. Proprietar: ${label(owner.status)}.`,
      viewingDate: row.viewingDate, viewingLocal: `${local.date} ${local.time} (ora București)`,
      contactId: contact?.id || null, contactName: contact?.name || null, propertyId: property?.id || null, propertyTitle: property?.title || null,
      clientConfirmation: client, ownerConfirmation: owner, missingRelations: [!contact ? 'client' : '', !property ? 'property' : ''].filter(Boolean) });
  }
  rows.sort((a, b) => Date.parse(a.viewingDate) - Date.parse(b.viewingDate) || a.id.localeCompare(b.id));
  const offset = input.cursor ? rows.findIndex(row => row.id === input.cursor) + 1 : 0;
  if (input.cursor && !offset) throw new Error('Lista s-a modificat; reia citirea fără cursor.');
  const selected = rows.slice(offset, offset + 100), more = offset + selected.length < rows.length;
  return { rows: selected, count: rows.length, complete: !more, status: 'resolved', nextCursor: more ? selected.at(-1)!.id : null,
    definition: 'Vizionările scheduled ale agentului în ziua cerută, fără confirmare valabilă a ambilor participanți. Lipsa dovezii în CRM nu înseamnă refuz sau neprezentare. Confirmările provin din răspunsuri WhatsApp la șablonul programării actuale; mesajele pregătite, trimise, livrate sau citite nu confirmă participarea.' };
}
