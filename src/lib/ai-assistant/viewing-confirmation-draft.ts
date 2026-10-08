import { z } from 'zod';
import { idSchema } from './contracts';
import { viewingDetails } from './viewing-details';
import type { AssistantContext } from './access';

export const viewingConfirmationDraftSchema = z.object({ viewingId: idSchema, recipient: z.enum(['client', 'owner']) }).strict();
export function confirmationDraft(row: Record<string, any>, recipient: 'client' | 'owner', now = new Date()) {
  if (row.status !== 'scheduled' || !Number.isFinite(Date.parse(row.viewingDate)) || Date.parse(row.viewingDate) <= now.getTime()) return { status: 'viewing_not_upcoming', complete: false, rows: [], sent: false };
  if (!row.contactId || !row.propertyId || !row.propertyTitle) return { status: 'missing_relationship', complete: false, rows: [], sent: false };
  if (!['Activ', 'Rezervat'].includes(row.propertyStatus)) return { status: 'property_unavailable', complete: false, rows: [], sent: false };
  const name = recipient === 'owner' ? row.ownerName : row.contactName;
  const phone = recipient === 'owner' ? row.ownerPhone : row.contactPhone;
  if (!name && !phone) return { status: 'missing_recipient', complete: false, rows: [], sent: false };
  const when = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(row.viewingDate));
  const text = `Bună ziua${name ? `, ${name}` : ''}! Vă confirm programarea vizionării pentru „${row.propertyTitle}”, pe ${when}, ora Bucureștiului.${row.propertyAddress ? ` Adresă/zonă: ${row.propertyAddress}.` : ''} ${recipient === 'owner' ? 'Vă rog să confirmați disponibilitatea pentru acces.' : 'Vă rog să confirmați participarea.'}`;
  return { status: 'prepared', complete: true, sent: false, rows: [{ id: row.id, title: `Mesaj pentru ${recipient === 'owner' ? 'proprietar' : 'client'}${name ? ` · ${name}` : ''}`, description: text,
    recipient, recipientName: name || null, recipientPhone: phone || null, viewingDate: row.viewingDate, viewingLocal: when, propertyId: row.propertyId,
    missingFields: [...(!phone ? ['recipientPhone'] : []), ...(!row.propertyAddress ? ['propertyAddress'] : [])] }],
    note: 'Mesaj pregătit, netrimis. Nu reprezintă confirmarea participării destinatarului. Datele trebuie reverificate înaintea trimiterii.' };
}
export async function viewingConfirmationDraft(ctx: AssistantContext, value: z.infer<typeof viewingConfirmationDraftSchema>, now = new Date()) {
  const input = viewingConfirmationDraftSchema.parse(value);
  const details = await viewingDetails(ctx, { mode: 'selected', viewingId: input.viewingId }, now);
  return confirmationDraft(details.rows[0], input.recipient, now);
}
