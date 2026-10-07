import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/outbound', () => ({ queueMessage: vi.fn() }));
import { queueMessage } from '@/lib/communications/outbound';
import { prepareMessage } from '../message-preparation';
import { assertSendApproval } from '@/lib/communications/send-approval';
import { approvalEnvelope, validateApproval } from '../approval';
import type { AssistantAction } from '../contracts';
const ctx = { adminDb: {}, uid: 'u', agencyId: 'a' } as any;
beforeEach(() => { vi.mocked(queueMessage).mockReset(); });
it('derives a bounded quote from domain preview, overriding model-supplied approval', async () => {
  vi.mocked(queueMessage).mockResolvedValue({ estimate: { amountMicros: 12000, currency: 'EUR', category: 'service' }, renderedText: 'Oferta concretă', withinWindow: true });
  const body = await prepareMessage(ctx, 'c', { text: 'Oferta concretă', expectedRecipientRevision: 'a'.repeat(64), sendApproval: { amountMicros: 999999 } });
  expect(body.sendApproval).toMatchObject({ amountMicros: 12000, currency: 'EUR', renderedText: 'Oferta concretă' });
  expect(body.sendApproval.expiresAt).toBeGreaterThan(Date.now());
  expect(body.sendApproval.expiresAt).toBeLessThanOrEqual(Date.now() + 3600000);
  expect(queueMessage).toHaveBeenCalledWith(ctx.adminDb, ctx, 'c', expect.objectContaining({ text: 'Oferta concretă', requestId: expect.any(String) }), true);
  expect(vi.mocked(queueMessage).mock.calls[0][3]).not.toHaveProperty('sendApproval');
});
it('propagates ineligibility without producing a prepared message', async () => {
  vi.mocked(queueMessage).mockRejectedValue(new Error('Acord retras'));
  await expect(prepareMessage(ctx, 'c', { text: 'Oferta' })).rejects.toThrow('Acord retras');
});
const quote = { amountMicros: 12000, currency: 'EUR', renderedText: 'Oferta', expiresAt: 2000 };
it.each([{ amount: 13000, currency: 'EUR', renderedText: 'Oferta' }, { amount: 12000, currency: 'USD', renderedText: 'Oferta' }, { amount: 12000, currency: 'EUR', renderedText: 'Șablon modificat' }, { amount: NaN, currency: 'EUR', renderedText: 'Oferta' }])('refuses material changes %j', estimate => {
  expect(() => assertSendApproval(quote, estimate, 1000)).toThrow('s-a schimbat');
});
it('accepts a lower price for identical content and rejects expiry', () => {
  const estimate = { amount: 10000, currency: 'EUR', renderedText: 'Oferta' };
  expect(() => assertSendApproval(quote, estimate, 1000)).not.toThrow();
  expect(() => assertSendApproval(quote, estimate, 2000)).toThrow();
});
it('does not approve legacy messages without a quote or a changed quoted ceiling', () => {
  const action: AssistantAction = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { text: 'Oferta', expectedRecipientRevision: 'a'.repeat(64) } };
  const expiry = Date.now() + 60000;
  expect(() => validateApproval(approvalEnvelope('u', 'a', 'p', [action], expiry), 'u', 'a', 'p', [action])).toThrow('Previzualizarea');
  const prepared = { ...action, body: { ...action.body, sendApproval: { ...quote, expiresAt: expiry } } };
  const approval = approvalEnvelope('u', 'a', 'p', [prepared], expiry);
  expect(() => validateApproval(approval, 'u', 'a', 'p', [prepared])).not.toThrow();
  expect(() => validateApproval(approval, 'u', 'a', 'p', [{ ...prepared, body: { ...prepared.body, sendApproval: { ...quote, expiresAt: expiry, amountMicros: 99000 } } }])).toThrow('nu corespunde');
});
