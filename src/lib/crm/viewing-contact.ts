import type { AssistantAction } from '@/lib/ai-assistant/contracts';

type CreateContact = Extract<AssistantAction, { kind: 'create_contact' }>;
export type ViewingContactAttempt = {
  payload?: string;
  requestId?: string;
  identity?: string;
  contact?: { id: string; name: string };
};

// Keep the same request ID after an uncertain response, and the confirmed contact
// after a calendar failure. A retry must not create the same client again.
export async function resolveViewingContact(
  action: CreateContact,
  attempt: ViewingContactAttempt,
  execute: (action: CreateContact, requestId: string) => Promise<Record<string, unknown>>,
) {
  const identity = JSON.stringify([action.name, action.phone, action.email]);
  if (attempt.contact && attempt.identity === identity) return attempt.contact;
  const payload = JSON.stringify(action);
  if (attempt.payload !== payload) {
    attempt.payload = payload;
    attempt.requestId = crypto.randomUUID();
    attempt.contact = undefined;
  }
  attempt.identity = identity;
  const result = await execute(action, attempt.requestId!);
  if (typeof result.contactId !== 'string' || !result.contactId) {
    throw new Error('Crearea clientului nu a fost confirmată. Reîncearcă salvarea.');
  }
  attempt.contact = { id: result.contactId, name: action.name };
  return attempt.contact;
}
