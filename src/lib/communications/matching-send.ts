import { z } from 'zod';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { matchingRevision } from '@/lib/ai-assistant/matching-revision';
import { referencesAllowed, type AssistantContext } from '@/lib/ai-assistant/access';
const id = z.string().min(1).max(180).regex(/^[A-Za-z0-9_.:-]+$/);
export const matchingSendSchema = z.object({ resultSetId: id, propertyId: id, contactId: id, propertyRevision: z.string().regex(/^[a-f0-9]{64}$/), contactRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export async function assertMatchingSend(db: Firestore, actor: { agencyId: string; uid: string; role?: string }, conversation: Record<string, any>, value: unknown, tx?: Transaction) {
  if (value === undefined) return;
  const binding = matchingSendSchema.parse(value), agency = db.collection('agencies').doc(actor.agencyId);
  const refs = [agency.collection('assistantResultSets').doc(binding.resultSetId), agency.collection('properties').doc(binding.propertyId), agency.collection('contacts').doc(binding.contactId)];
  const [setDoc, propertyDoc, contactDoc] = await Promise.all(refs.map(ref => tx ? tx.get(ref) : ref.get()));
  const set = setDoc.data(), property = propertyDoc.data(), contact = contactDoc.data();
  if (!set || set.ownerId !== actor.uid || set.kind !== 'existing_matches' || !Number.isFinite(set.expiresAt) || set.expiresAt <= Date.now() || set.contactId !== binding.contactId || !Array.isArray(set.rows) || !set.rows.some(row => row.id === binding.propertyId) || conversation.contactId !== binding.contactId || !property || property.status !== 'Activ' || !contact || matchingRevision(property) !== binding.propertyRevision || matchingRevision(contact) !== binding.contactRevision) throw new Error('Selecția din matching a expirat sau datele clientului/proprietății s-au schimbat. Pregătește din nou mesajul; proprietatea nu a fost înlocuită.');
  if (!(await referencesAllowed({ ...actor, adminDb: db } as AssistantContext, set.accessRefs || []))) throw new Error('Accesul la selecția din matching a fost revocat.');
}
