import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Actor } from './model';
import { recipientRevision } from './recipient-revision';
import { normalizedContactFields } from '@/lib/crm/contact-identity';

export const personalRecipientSchema = z.object({ role: z.enum(['agent', 'admin']), phoneHash: z.string().regex(/^[a-f0-9]{64}$/), recipientRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function personalRecipientProof(actor: Actor, conversation: Record<string, any>, profile: Record<string, any> | undefined) {
  const own = normalizedContactFields({ phone: profile?.phone }).normalizedPhone;
  const destination = normalizedContactFields({ phone: conversation.externalParticipantId }).normalizedPhone;
  if (profile?.agencyId !== actor.agencyId || profile?.role !== actor.role || !['agent', 'admin'].includes(String(actor.role)) || conversation.channel !== 'whatsapp' || !own || own !== destination) {
    throw Object.assign(new Error('Brief-ul poate fi trimis numai la numărul tău configurat în profil. Destinatarul sau accesul s-a schimbat.'), { status: 403 });
  }
  return personalRecipientSchema.parse({ role: actor.role, phoneHash: createHash('sha256').update(`personal-recipient:${actor.agencyId}:${actor.uid}:${own}`).digest('hex'), recipientRevision: recipientRevision(conversation) });
}
export async function assertPersonalRecipient(db: Firestore, actor: Actor, conversation: Record<string, any>, proof: unknown, tx?: Transaction) {
  if (proof === undefined) return;
  const approved = personalRecipientSchema.parse(proof);
  const ref = db.collection('users').doc(actor.uid);
  const member = await (tx ? tx.get(ref) : ref.get());
  const current = personalRecipientProof(actor, conversation, member.data());
  if (current.role !== approved.role || current.phoneHash !== approved.phoneHash || current.recipientRevision !== approved.recipientRevision) throw Object.assign(new Error('Destinatarul personal al brief-ului s-a modificat. Trimiterea a fost oprită.'), { status: 409 });
}
