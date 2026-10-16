import { expect, it, vi, afterEach } from 'vitest';
vi.mock('../inbox-read', () => ({ inboxRequest: () => ({ mode: 'summary', query: 'andrei' }), readInboxRequest: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { readInboxRequest } from '../inbox-read';
import { getResource, type AssistantContext } from '../access';
import { planTurn } from '../planner';
import { ProviderError, type ModelProvider, type ProviderResult } from '../provider';
const ctx = { uid: 'me', agencyId: 'agency', role: 'agent' } as AssistantContext;
const usage = { inputTokens: 100, outputTokens: 50, cachedTokens: 0, cacheWriteTokens: 0, estimated: false };
const response: ProviderResult = { text: 'Clientul întreabă despre credit [m1].', calls: [], items: [], usage, latencyMs: 1, status: 'completed' };
const data = { conversations: [{ id: 'c', name: 'Andrei', channel: 'whatsapp', lastMessageAt: null }], messages: [{ id: 'm1', conversationId: 'c', direction: 'received', text: 'Se acceptă credit?', status: 'received', createdAt: '', attachmentsCount: 0 }], selectionRequired: false, analysis: true };
afterEach(() => vi.resetAllMocks());
it('sends only fresh messages, with no tools, old history or memory summary', async () => {
  vi.mocked(readInboxRequest).mockResolvedValue(data); vi.mocked(getResource).mockResolvedValue({ id: 'c' });
  const provider: ModelProvider = { id: 'test', respond: vi.fn().mockResolvedValue(response) };
  const result = await planTurn(ctx, 'Rezumă-mi conversația cu Andrei.', [{ id: 'old', role: 'assistant', createdAt: '', text: 'PRIVATE_OLD_CONTEXT' }], { provider, summary: 'PRIVATE_SUMMARY' });
  const sent = vi.mocked(provider.respond).mock.calls[0][0];
  expect(sent.tools).toEqual([]); expect(JSON.stringify(sent)).not.toMatch(/PRIVATE_OLD_CONTEXT|PRIVATE_SUMMARY/);
  expect(JSON.stringify(sent.input)).toContain('Se acceptă credit?');
  expect(result.metrics.status).toBe('success'); expect(result.actions).toEqual([]);
});
it('withholds generated text and cards if access is revoked during model analysis', async () => {
  vi.mocked(readInboxRequest).mockResolvedValue(data); vi.mocked(getResource).mockRejectedValue(new Error('revoked'));
  const result = await planTurn(ctx, 'Rezumă-mi conversația cu Andrei.', [], { provider: { id: 'test', respond: vi.fn().mockResolvedValue(response) } });
  expect(result.metrics.status).toBe('unavailable'); expect(result.cards).toEqual([]); expect(result.text).not.toContain('credit');
});
it('retries a temporary provider failure once and accounts for both attempts', async () => {
  vi.mocked(readInboxRequest).mockResolvedValue(data); vi.mocked(getResource).mockResolvedValue({ id: 'c' });
  const provider: ModelProvider = { id: 'test', respond: vi.fn().mockRejectedValueOnce(new ProviderError('temporary', true)).mockResolvedValueOnce(response) };
  const result = await planTurn(ctx, 'Rezumă-mi conversația cu Andrei.', [], { provider });
  expect(provider.respond).toHaveBeenCalledTimes(2); expect(result.metrics.models).toHaveLength(2); expect(result.metrics.status).toBe('success');
});
