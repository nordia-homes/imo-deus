import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
const mocks = vi.hoisted(() => ({ conversation: vi.fn(), token: vi.fn() }));
vi.mock('../server', () => ({ getConversation: mocks.conversation, nowIso: () => '2026-09-27T12:00:00Z', agencyCollection: vi.fn(), CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../meta', () => ({ connectionToken: mocks.token, graph: vi.fn() }));
vi.mock('../media', () => ({ attachmentForSend: vi.fn() }));
import { queueMessage } from '../outbound';
const actor = { agencyId: 'agency', uid: 'agent', role: 'agent' };
const input = { requestId: '3e728e32-b48f-46da-9102-8b66cb8215cb', text: 'Oferta' };
function database(conversationId = 'conversation') {
  return { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ conversationId, input, status: 'accepted' }) }) }) }) } as unknown as Firestore;
}
describe('outbound retry safety', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.conversation.mockResolvedValue({ id: 'conversation', lastInboundAt: null }); });
  it('returns the original result even after the response window expires, without another provider call', async () => {
    await expect(queueMessage(database(), actor, 'conversation', input)).resolves.toMatchObject({ status: 'accepted' });
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('rejects reuse of a request ID for another conversation', async () => {
    await expect(queueMessage(database('other'), actor, 'conversation', input)).rejects.toThrow('alt mesaj');
  });
  it('checks current conversation access before returning a previous result', async () => {
    mocks.conversation.mockRejectedValueOnce(new Error('Acces revocat'));
    await expect(queueMessage(database(), actor, 'conversation', input)).rejects.toThrow('Acces revocat');
  });
});
