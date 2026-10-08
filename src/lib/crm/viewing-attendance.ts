import { z } from 'zod';

export const viewingConfirmationLinkSchema = z.object({ viewingId: z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:-]+$/), participant: z.enum(['client', 'owner']) }).strict();
export type AttendanceStatus = 'confirmed' | 'declined' | 'reschedule_requested' | 'unknown';
export type AttendanceRecord = { participant: 'client' | 'owner'; status: AttendanceStatus; source: 'whatsapp_reply'; recordedAt: string; replyAt: string; replyId: string; templateMessageId: string; appointment: string; recipient: string; text: string };
type Row = Record<string, any>;
export function appointmentSignature(row: Row) {
  return JSON.stringify([Date.parse(row.viewingDate), row.duration || 60, row.contactId, row.propertyId, row.agentId, row.confirmationRevision || row.createdAt || null]);
}
export function participantSignature(participant: 'client' | 'owner', contact: Row | null, property: Row | null) {
  return participant === 'client' ? JSON.stringify([contact?.name || null, contact?.phone || null]) : JSON.stringify([property?.ownerName || null, property?.ownerPhone || null]);
}
export function attendanceState(row: Row, participant: 'client' | 'owner', contact: Row | null, property: Row | null, now = new Date()) {
  const record = row.confirmations?.[participant] as AttendanceRecord | undefined;
  if (!record) return { status: 'unknown' as const, reason: 'missing' };
  if (!contact || !property || record.source !== 'whatsapp_reply' || !record.replyId || !record.templateMessageId || record.participant !== participant
    || !['confirmed', 'declined', 'reschedule_requested', 'unknown'].includes(record.status)
    || !Number.isFinite(Date.parse(record.recordedAt)) || Date.parse(record.recordedAt) > now.getTime()
    || !Number.isFinite(Date.parse(record.replyAt)) || Date.parse(record.replyAt) > now.getTime()
    || !Number.isFinite(Date.parse(row.viewingDate)) || record.appointment !== appointmentSignature(row) || record.recipient !== participantSignature(participant, contact, property)) return { status: 'unknown' as const, reason: 'stale_or_invalid' };
  return { status: record.status, reason: 'whatsapp_reply', replyId: record.replyId, recordedAt: record.recordedAt };
}

// Whole-message rules: a positive fragment must never override a qualification.
export function interpretViewingReply(text: string): AttendanceStatus {
  const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.!…]+$/g, '').replace(/\s+/g, ' ');
  if (/^(?:reprogrameaza(?: vizionarea)?|solicit reprogramare|doresc reprogramarea)$/.test(value)) return 'reschedule_requested';
  if (/^(?:(?:buna ziua|buna|salut)[,! ]+)?(?:da|confirm|confirm participarea|confirm vizionarea|confirm prezenta|voi veni|vin|ajung|sigur|da[, ]+(?:confirm|vin|ajung|sigur|voi veni)|ne vedem|este in regula)(?:[, ]+(?:multumesc|va multumesc))?$/.test(value)) return 'confirmed';
  if (/^(?:(?:buna ziua|buna|salut)[,! ]+)?(?:(?:imi pare rau|din pacate)[,! ]+)?(?:nu|nu confirm|nu vin|nu mai vin|nu pot|nu pot veni|nu pot ajunge|nu voi veni|nu voi ajunge|nu particip|anulez|anulez vizionarea)(?:[, ]+(?:multumesc|va multumesc))?$/.test(value)) return 'declined';
  return 'unknown';
}
