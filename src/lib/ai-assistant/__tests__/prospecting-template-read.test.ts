import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('../operations', () => ({ invokeOperation: vi.fn() }));
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { invokeOperation } from '../operations';
import { readProspectingOperation } from '../prospecting-template-read';
import { CommunicationError } from '@/lib/communications/server';
import type { AssistantContext } from '../access';
const ctx = { prospectingRequest: { prompt: 'Contactează proprietarii pe WhatsApp' } } as AssistantContext;
const input = { operation: 'whatsapp_templates', params: { connectionId: 'wrong' }, query: {}, body: {} };
afterEach(() => vi.resetAllMocks());
beforeEach(() => vi.mocked(getResource).mockRejectedValue(new CommunicationError('Missing', 404)));
it('recovers a missing reference using the unique current WhatsApp connection and reads only', async () => {
  vi.mocked(invokeOperation).mockRejectedValueOnce(new CommunicationError('Missing', 404)).mockResolvedValueOnce({ connections: [{ id: 'actual', channel: 'whatsapp', status: 'connected' }, { id: 'facebook', channel: 'messenger', status: 'connected' }] }).mockResolvedValueOnce({ templates: [{ name: 'prospectare' }] });
  expect(await readProspectingOperation(ctx, input)).toMatchObject({ templates: [{ name: 'prospectare' }], resolvedConnectionId: 'actual' });
  expect(vi.mocked(invokeOperation).mock.calls.map(call => [call[1].operation, call[2]])).toEqual([['whatsapp_templates', true], ['communications_status', true], ['whatsapp_templates', true]]);
  expect(vi.mocked(invokeOperation).mock.calls[2][1].params.connectionId).toBe('actual');
});
it.each([403, 500])('never recovers denied or uncertain reads (%s)', async status => {
  vi.mocked(invokeOperation).mockRejectedValueOnce(new CommunicationError('Denied', status));
  await expect(readProspectingOperation(ctx, input)).rejects.toThrow('Denied');
  expect(invokeOperation).toHaveBeenCalledTimes(1);
});
it('preserves a provider 404 for an existing connection without switching accounts', async () => {
  vi.mocked(getResource).mockResolvedValueOnce({ id: 'wrong' });
  vi.mocked(invokeOperation).mockRejectedValueOnce(new CommunicationError('Provider missing', 404));
  await expect(readProspectingOperation(ctx, input)).rejects.toThrow('Provider missing');
  expect(invokeOperation).toHaveBeenCalledTimes(1);
});
it.each([[], [{ id: 'one', channel: 'whatsapp', status: 'disconnected' }], [{ id: 'one', channel: 'whatsapp', status: 'connected' }, { id: 'two', channel: 'whatsapp', status: 'connected' }]].map(connections => ({ connections })))('does not choose an absent or ambiguous connection', async ({ connections }) => {
  vi.mocked(invokeOperation).mockRejectedValueOnce(new CommunicationError('Missing', 404)).mockResolvedValueOnce({ connections });
  await expect(readProspectingOperation(ctx, input)).rejects.toThrow('Missing');
  expect(invokeOperation).toHaveBeenCalledTimes(2);
});
it('does not infer recovery outside an explicit prospecting command', async () => {
  vi.mocked(invokeOperation).mockRejectedValueOnce(new CommunicationError('Missing', 404));
  await expect(readProspectingOperation({} as AssistantContext, input)).rejects.toThrow('Missing');
  expect(invokeOperation).toHaveBeenCalledTimes(1);
});
