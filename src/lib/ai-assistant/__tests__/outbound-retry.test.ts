import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { outboundRetryRequest, outboundRetryAction } from '../outbound-retry';
import { safeToRetryOutbound } from '@/lib/communications/outbound';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
const safe = { status: 'failed', failureStage: 'before_provider', failureId: 'c5664c3d-581d-49a5-b828-14c429192c50' };
it('authorizes only explicit retry with a fixed failure identity', () => {
  const action: any = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { retryMessageId: 'm', failureId: safe.failureId } };
  expect(outboundRetryRequest('Reîncearcă doar cele safe-to-retry.')).toBe(true);
  expect(outboundRetryAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Reîncearcă doar cele safe-to-retry.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Reconciliază mesajele cu rezultat necunoscut.')).toBe(false);
  expect(outboundRetryAction({ ...action, body: { ...action.body, text: 'Changed' } })).toBe(false);
});
it.each([{ status: 'unknown' }, { status: 'accepted' }, { status: 'delivered' }, { failureStage: 'after_provider' }, { failureStage: null }, { failureId: null }, { externalId: 'meta-id' }, { providerAcceptedAt: '2026-10-16T10:00:00Z' }])('excludes unsafe evidence %j', patch => {
  expect(safeToRetryOutbound(safe)).toBe(true); expect(safeToRetryOutbound({ ...safe, ...patch })).toBe(false);
});
it.each(['Nu reîncerca mesajele', 'Retrimite toate mesajele necunoscute', 'Explică safe-to-retry'])('does not authorize %s', text => expect(outboundRetryRequest(text)).toBe(false));
it('confirms queueing, not delivery, and reports blocked retries', () => {
  expect(executionConfirmation([{ result: { retry: true, requeued: true, messageId: 'm' } }])).toContain('Livrarea este încă în așteptare');
  expect(executionConfirmation([{ result: { retry: true, retryBlocked: true, messageId: 'm' } }])).toContain('nu a fost repus');
});