import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn() }));
import { conversationStateRequest, simpleConversationUpdate, requestedConversationUpdate } from '../conversation-state';
import { withinResponseWindow } from '@/lib/communications/model';
import { executionConfirmation } from '../execution-confirmation';
const action: any = { kind: 'existing_operation', operation: 'conversation_update', params: { conversationId: 'c' }, query: {}, body: { version: 1, read: true } };
it.each([['Marchează conversația citită.', 'read'], ['Marchează conversația închisă.', 'resolved'], ['Redeschide conversația.', 'open']])('recognizes only the requested conversation state: %s', (prompt, state) => expect(conversationStateRequest(prompt)).toBe(state));
it('rejects explanations, negation, assignments and extra mutations', () => {
  for (const prompt of ['Nu marca conversația citită.', 'Explică cum redeschide conversația.', 'Atribuie conversația unui agent.']) expect(conversationStateRequest(prompt)).toBeNull();
  expect(simpleConversationUpdate(action)).toBe(true);
  for (const body of [{ version: 1, read: true, assigneeId: 'other' }, { version: 1, status: 'spam' }, { version: 1, read: false }, { version: 1.5, read: true }, { version: 1, read: true, status: 'open' }]) expect(simpleConversationUpdate({ ...action, body })).toBe(false);
  expect(requestedConversationUpdate(action, 'Marchează conversația citită.')).toBe(true);
  expect(requestedConversationUpdate(action, 'Marchează conversația închisă.')).toBe(false);
});
it('confirms only a committed receipt', () => {
  expect(executionConfirmation([{ kind: 'existing_operation', result: { operation: 'conversation_update', executionState: 'succeeded', conversationId: 'c', state: 'resolved' } }])).toContain('închisă');
  expect(executionConfirmation([{ kind: 'existing_operation', result: { operation: 'conversation_update', executionState: 'unknown', conversationId: 'c', state: 'resolved' } }])).toBe('');
});
it('closes the response window exactly at 24 hours and rejects missing/future timestamps', () => {
  const now = Date.parse('2026-10-16T08:00:00Z');
  expect(withinResponseWindow(new Date(now - 86400000 + 1).toISOString(), now)).toBe(true);
  for (const value of [null, 'invalid', new Date(now - 86400000).toISOString(), new Date(now + 1).toISOString()]) expect(withinResponseWindow(value, now)).toBe(false);
});
