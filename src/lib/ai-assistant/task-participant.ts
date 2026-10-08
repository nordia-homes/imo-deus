import { CommunicationError } from '@/lib/communications/server';

// Resolve participant snapshots from records read inside the saving transaction.
export function taskParticipant(source: 'property_owner' | 'contact' | undefined, contact: Record<string, any> | null, property: Record<string, any> | null) {
  if (!source) return {};
  if (source === 'property_owner' && (!property || contact)) throw new CommunicationError('Taskul pentru proprietar necesită proprietatea, fără asociere cu un cumpărător.');
  if (source === 'contact' && !contact) throw new CommunicationError('Taskul pentru client necesită clientul CRM.');
  const name = source === 'property_owner' ? property?.ownerName : contact?.name;
  const phone = source === 'property_owner' ? property?.ownerPhone : contact?.phone;
  const participantName = typeof name === 'string' ? name.trim() : '';
  const participantPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!participantName && !participantPhone) throw new CommunicationError('Participantul nu are nume sau telefon în CRM. Completează datele înainte de crearea taskului.');
  return { participantName: participantName || null, participantPhone: participantPhone || null };
}
