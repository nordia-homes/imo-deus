import type { Transaction } from 'firebase-admin/firestore';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { contactIdentityKeys, normalizedContactFields } from './contact-identity';

// All reads finish before the returned write callback. The identity document
// serializes concurrent creates even when both initial query results are empty.
export async function prepareContactIdentity(ctx: AssistantContext, tx: Transaction, contactId: string, next: Record<string, any>, previous?: Record<string, any>) {
  const currentKeys = contactIdentityKeys(next), previousKeys = previous ? contactIdentityKeys(previous) : [];
  const unchanged = new Set(previousKeys.filter(previous => currentKeys.some(current => current.key === previous.key)).map(item => item.key));
  const lockKeys = [...new Set([...currentKeys, ...previousKeys].map(item => item.key))];
  const locks = new Map(await Promise.all(lockKeys.map(async key => [key, await tx.get(collectionFor(ctx, 'assistantLocks').doc(key))] as const)));
  for (const item of currentKeys) {
    if (unchanged.has(item.key)) continue;
    const owner = locks.get(item.key)?.data()?.contactId;
    if (owner && owner !== contactId) {
      const contact = await tx.get(collectionFor(ctx, 'contacts').doc(owner));
      if (contact.exists && normalizedContactFields(contact.data()!)[item.field as 'normalizedPhone' | 'normalizedEmail'] === item.value) throw new CommunicationError('Contactul există deja. Folosește contactul existent sau dezarhivează-l.', 409);
    }
    const matches = await tx.get(collectionFor(ctx, 'contacts').where(item.field, '==', item.value));
    if (matches.docs.some(doc => doc.id !== contactId && normalizedContactFields(doc.data())[item.field as 'normalizedPhone' | 'normalizedEmail'] === item.value)) throw new CommunicationError('Contactul există deja. Folosește contactul existent sau dezarhivează-l.', 409);
  }
  for (const field of ['phone', 'email'] as const) if (next[field]?.trim()) {
    if (unchanged.has(contactIdentityKeys({ [field]: next[field] })[0]?.key)) continue;
    const matches = await tx.get(collectionFor(ctx, 'contacts').where(field, '==', next[field].trim()));
    if (matches.docs.some(doc => doc.id !== contactId)) throw new CommunicationError('Contactul există deja. Folosește contactul existent sau dezarhivează-l.', 409);
  }
  return { fields: normalizedContactFields(next), write() {
    for (const item of previousKeys) if (!currentKeys.some(key => key.key === item.key) && locks.get(item.key)?.data()?.contactId === contactId) tx.delete(collectionFor(ctx, 'assistantLocks').doc(item.key));
    for (const item of currentKeys) {
      if (unchanged.has(item.key) && locks.get(item.key)?.data()?.contactId && locks.get(item.key)?.data()?.contactId !== contactId) continue;
      tx.set(collectionFor(ctx, 'assistantLocks').doc(item.key), { contactId, kind: 'contact_identity', updatedAt: new Date().toISOString() });
    }
  } };
}
