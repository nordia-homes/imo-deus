import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { reconciliationRequest, reconciliationAction } from '../outbound-reconciliation';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
it('recognizes and authorizes only explicit reconciliation with fixed message IDs', () => {
  const action: any = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { reconcileMessageIds: ['m'] } };
  expect(reconciliationRequest('Reconciliază mesajele cu rezultat necunoscut.')).toBe(true);
  expect(reconciliationAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Reconciliază mesajele cu rezultat necunoscut.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Reîncearcă doar cele safe-to-retry.')).toBe(false);
  expect(reconciliationAction({ ...action, body: { ...action.body, text: 'New send' } })).toBe(false);
  expect(reconciliationAction({ ...action, body: { reconcileMessageIds: [] } })).toBe(false);
});
it.each(['Nu reconcilia mesajele cu rezultat necunoscut', 'Explică reconcilierea', 'Retrimite mesajele cu rezultat necunoscut'])('does not authorize %s', prompt => expect(reconciliationRequest(prompt)).toBe(false));
it('reports unresolved messages without claiming delivery', () => {
  const text = executionConfirmation([{ result: { reconciliation: true, reconciled: 2, unresolved: 1 } }]);
  expect(text).toContain('2 mesaje actualizate'); expect(text).toContain('1 rămân cu rezultat necunoscut'); expect(text).toContain('Nu am retrimis'); expect(text).not.toContain('livrate');
});