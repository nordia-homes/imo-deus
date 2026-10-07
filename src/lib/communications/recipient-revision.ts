import { createHash } from 'node:crypto';

// Pin routing identity, not mutable inbox state such as unread/status/name.
export function recipientRevision(conversation: Record<string, unknown>): string {
  const fields = ['id', 'agencyId', 'channel', 'connectionId', 'externalParticipantId'] as const;
  if (fields.some(key => typeof conversation[key] !== 'string' || !(conversation[key] as string).trim()) || (conversation.contactId != null && typeof conversation.contactId !== 'string')) throw new Error('Identitatea destinatarului este incompletă. Recitește conversația.');
  return createHash('sha256').update(JSON.stringify(['recipient-v1', ...fields.map(key => conversation[key]), conversation.contactId ?? null])).digest('hex');
}

export function assertRecipientRevision(conversation: Record<string, unknown>, expected: unknown) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || recipientRevision(conversation) !== expected) throw new Error('Destinatarul sau conexiunea s-a schimbat. Pregătește din nou mesajul pentru aprobare.');
}
