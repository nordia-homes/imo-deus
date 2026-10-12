import { expect, it } from 'vitest';
import { selectedMessageStatus, selectedMessageReference } from '../message-status';
it.each(['queued', 'accepted', 'delivered', 'read', 'failed', 'unknown'])('returns the selected message current status %s without using adjacent messages', status => {
  const result = selectedMessageStatus({ conversation: { id: 'c' }, messages: [{ id: 'other', status: 'read' }, { id: 'target', status }] }, 'target');
  expect(result.messages).toEqual([{ id: 'target', status }]); expect(result.complete).toBe(true);
});
it('rejects a missing target even when the API returns other messages', () => {
  expect(() => selectedMessageStatus({ messages: [{ id: 'other', status: 'read' }] }, 'missing')).toThrow('nu mai este disponibil');
});
it('recovers a unique sent message from server execution receipts, but does not guess among several messages', () => {
  const card = { type: 'data' as const, title: 'Execuție', source: 'autonomy', rows: [{ result: { operation: 'message_send', messageId: 'm', conversationId: 'c' } }] };
  expect(selectedMessageReference([card])).toEqual({ id: 'm', conversationId: 'c' });
  expect(selectedMessageReference([card, card])).toEqual({ id: 'm', conversationId: 'c' });
  expect(selectedMessageReference([card, { ...card, rows: [{ result: { operation: 'message_send', messageId: 'other', conversationId: 'c' } }] }])).toBeUndefined();
});
