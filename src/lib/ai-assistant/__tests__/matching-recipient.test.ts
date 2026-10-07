import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
vi.mock('../context-selection', () => ({ selectContext: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ listConversations: vi.fn() }));
import { getResource } from '../access';
import { selectContext } from '../context-selection';
import { listConversations } from '@/lib/communications/server';
import { resolveMatchingRecipient } from '../matching-recipient';
const ctx = {} as any, input = { resultSetId: 'set', position: 2 }, conversation = { id: 'conversation', contactId: 'client', name: 'Client', channel: 'whatsapp', connectionId: 'connection', externalParticipantId: 'private-phone', token: 'secret' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectContext).mockResolvedValue({ contactId: 'client', rows: [{ id: 'second', matchScore: 90, scoreMayBeStale: true }], resultSetId: 'set' } as any);
  vi.mocked(getResource).mockImplementation(async (_ctx, resource, id) => resource === 'contacts' ? { id } : { ...conversation, id });
  vi.mocked(listConversations).mockResolvedValue({ conversations: [conversation], cursor: null } as any);
});
it('resolves one exact client conversation while preserving ordinal evidence and withholding private fields', async () => {
  const result = await resolveMatchingRecipient(ctx, { selections: [] }, input);
  expect(selectContext).toHaveBeenCalledWith(ctx, { selections: [] }, { resultSetId: 'set', positions: [2] });
  expect(result).toMatchObject({ conversationId: 'conversation', recipientStatus: 'resolved', eligibilityChecked: false, rows: [{ id: 'second', matchScore: 90, scoreMayBeStale: true }] });
  expect(JSON.stringify(result)).not.toContain('private-phone'); expect(JSON.stringify(result)).not.toContain('secret');
  expect(vi.mocked(listConversations).mock.calls[0][2].get('contactId')).toBe('client');
});
it.each([{ conversations: [] }, { conversations: [conversation, { ...conversation, id: 'other' }] }])('asks for clarification instead of selecting an absent or ambiguous recipient', async ({ conversations }) => {
  vi.mocked(listConversations).mockResolvedValue({ conversations, cursor: null } as any);
  expect(await resolveMatchingRecipient(ctx, {}, input)).toMatchObject({ conversationId: null, recipientStatus: 'needs_clarification', recipientSearchComplete: true });
});
it('paginates before declaring a unique result and deduplicates stable IDs', async () => {
  vi.mocked(listConversations).mockResolvedValueOnce({ conversations: [conversation], cursor: 'page2' } as any).mockResolvedValueOnce({ conversations: [conversation], cursor: null } as any);
  expect((await resolveMatchingRecipient(ctx, {}, input)).conversationId).toBe('conversation');
  expect(vi.mocked(listConversations).mock.calls[1][2].get('cursor')).toBe('page2');
});
it('does not claim uniqueness when pagination is incomplete or repeats a cursor', async () => {
  vi.mocked(listConversations).mockResolvedValue({ conversations: [conversation], cursor: 'loop' } as any);
  expect(await resolveMatchingRecipient(ctx, {}, input)).toMatchObject({ conversationId: null, recipientSearchComplete: false, complete: false });
});
it('bounds pagination without turning a partial search into a unique recipient', async () => {
  let page = 0;
  vi.mocked(listConversations).mockImplementation(async () => ({ conversations: [conversation], cursor: `page-${++page}` }) as any);
  expect(await resolveMatchingRecipient(ctx, {}, input)).toMatchObject({ conversationId: null, recipientSearchComplete: false });
  expect(listConversations).toHaveBeenCalledTimes(5);
});
it('validates an explicit choice against the matching client and requested channel', async () => {
  expect((await resolveMatchingRecipient(ctx, {}, { ...input, conversationId: 'conversation', channel: 'whatsapp' })).conversationId).toBe('conversation');
  expect(listConversations).not.toHaveBeenCalled();
  await expect(resolveMatchingRecipient(ctx, {}, { ...input, conversationId: 'conversation', channel: 'messenger' })).rejects.toThrow('nu corespunde');
  vi.mocked(getResource).mockResolvedValue({ ...conversation, contactId: 'someone-else' });
  await expect(resolveMatchingRecipient(ctx, {}, { ...input, conversationId: 'conversation' })).rejects.toThrow('nu corespunde');
});
it('refuses selection without client provenance or after access revocation', async () => {
  vi.mocked(getResource).mockRejectedValue(new Error('Acces revocat'));
  await expect(resolveMatchingRecipient(ctx, {}, input)).rejects.toThrow('Acces revocat');
  vi.mocked(selectContext).mockResolvedValue({ contactId: null, rows: [] } as any);
  await expect(resolveMatchingRecipient(ctx, {}, input)).rejects.toThrow('nu identifică un client');
});
it('refuses a contact reassignment during conversation refresh', async () => {
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'contacts' ? {} : { ...conversation, contactId: 'changed' });
  await expect(resolveMatchingRecipient(ctx, {}, input)).rejects.toThrow('s-a schimbat');
});
