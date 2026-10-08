import { z } from 'zod';
import { getResource, type AssistantContext } from './access';
import { attendanceState } from '@/lib/crm/viewing-attendance';
import { zonedParts } from './zoned-time';

export const viewingRiskSchema = z.object({}).strict();
const definition = 'Priorități de verificare exclusiv pentru lista afișată anterior, recitită din CRM. Nu sunt probabilități de no-show. Lipsa confirmării nu înseamnă refuz; confirmarea nu garantează prezența. Refuzul proprietarului privește accesul, nu comportamentul cumpărătorului.';

export async function viewingRisk(ctx: AssistantContext, ids: string[], now = new Date()) {
  if (!ids.length || ids.length > 100 || ids.some(id => !/^[A-Za-z0-9_.:-]{1,180}$/.test(id))) return {
    rows: [], excluded: [], complete: false, status: 'needs_clarification', definition,
    note: 'Cere lista de vizionări de comparat; nu presupune o selecție dintr-o căutare nouă.',
  };
  const cache = new Map<string, Promise<Record<string, any> | null>>();
  const read = (source: string, id: unknown) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(id)) return Promise.resolve(null);
    const key = `${source}/${id}`;
    if (!cache.has(key)) cache.set(key, getResource(ctx, source, id).catch(error => {
      if ([403, 404].includes(Number(error.status))) return null;
      throw error;
    }));
    return cache.get(key)!;
  };
  const rows: Record<string, any>[] = [], excluded: { id: string; reason: string }[] = [];
  for (const id of [...new Set(ids)]) {
    const row = await read('viewings', id);
    if (!row) { excluded.push({ id, reason: 'Indisponibilă sau inaccesibilă.' }); continue; }
    if (row.status !== 'scheduled') { excluded.push({ id, reason: 'Nu mai este programată.' }); continue; }
    if (!Number.isFinite(Date.parse(row.viewingDate)) || Date.parse(row.viewingDate) <= now.getTime()) {
      excluded.push({ id, reason: 'Data este invalidă sau a trecut.' }); continue;
    }
    const [contact, property] = await Promise.all([read('contacts', row.contactId), read('properties', row.propertyId)]);
    const client = attendanceState(row, 'client', contact, property, now), owner = attendanceState(row, 'owner', contact, property, now);
    const reasons: string[] = [];
    if (client.status === 'declined') reasons.push('Cumpărătorul a refuzat explicit participarea prin WhatsApp.');
    if (client.status === 'reschedule_requested') reasons.push('Cumpărătorul solicită reprogramare prin WhatsApp.');
    if (owner.status === 'declined') reasons.push('Proprietarul a refuzat prin WhatsApp: accesul trebuie rezolvat.');
    if (owner.status === 'reschedule_requested') reasons.push('Proprietarul solicită reprogramare prin WhatsApp: accesul la ora actuală trebuie verificat.');
    const explicit = reasons.length > 0;
    if (!contact) reasons.push('Fișa cumpărătorului este indisponibilă.');
    if (!property) reasons.push('Fișa proprietății este indisponibilă.');
    else if (property.status !== 'Activ') reasons.push('Proprietatea nu este activă: verifică disponibilitatea.');
    if (client.status === 'unknown') reasons.push('Cumpărătorul nu are confirmare WhatsApp valabilă pentru programarea actuală; nu este un refuz.');
    if (owner.status === 'unknown') reasons.push('Proprietarul nu are confirmare WhatsApp valabilă pentru programarea actuală; nu este un refuz.');
    const priority = explicit ? 'urgent' : reasons.length ? 'verification_needed' : 'no_known_warning';
    if (!reasons.length) reasons.push('Ambii participanți au confirmat prin WhatsApp; prezența nu este garantată.');
    const local = zonedParts(new Date(row.viewingDate), 'Europe/Bucharest');
    rows.push({ id, title: `${contact?.name || 'Client indisponibil'} — ${property?.title || 'Proprietate indisponibilă'}`,
      description: reasons.join(' '), reasons, priority, clientConfirmation: client, ownerConfirmation: owner,
      viewingDate: row.viewingDate, viewingLocal: `${local.date} ${local.time} (ora București)` });
  }
  const order: Record<string, number> = { urgent: 0, verification_needed: 1, no_known_warning: 2 };
  rows.sort((a, b) => order[a.priority] - order[b.priority] || Date.parse(a.viewingDate) - Date.parse(b.viewingDate) || a.id.localeCompare(b.id));
  return { rows, excluded, complete: excluded.length === 0, status: excluded.length ? 'partial' : 'resolved', definition,
    note: excluded.length ? `Nu au fost evaluate: ${excluded.map(row => `${row.id}: ${row.reason}`).join(' ')}` : definition };
}
