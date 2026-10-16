import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { propertyShareRequest, propertyShareAction, preparePropertyShares, propertyShareExecutionPrompt } from '../property-share';
import { explicitlyRequestedSafeAction } from '../autonomy';
it.each([['Trimite proprietatea aceasta clientului.', 'one'], ['Trimite primele trei potriviri clientului.', 'three'], ['Nu retrimite proprietăți deja trimise.', 'duplicates']])('recognizes %s', (text, mode) => expect(propertyShareRequest(text)).toBe(mode));
it.each(['Nu trimite proprietatea aceasta clientului', 'Explică trimiterea proprietăților', 'Arată primele trei potriviri'])('does not infer sending from %s', text => expect(propertyShareRequest(text)).toBeNull());
it('allows only the bound selection shape and explicit send commands', () => {
  const action: any = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { matchingShare: { resultSetId: 's', contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) } } };
  expect(propertyShareAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Trimite primele trei potriviri clientului.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Nu retrimite proprietăți deja trimise.')).toBe(false);
  expect(propertyShareAction({ ...action, body: { ...action.body, text: 'Substituted' } })).toBe(false);
});
it('does not guess a selection when there is no matching context', async () => {
  await expect(preparePropertyShares({} as any, 'Trimite proprietatea aceasta clientului.', [])).rejects.toThrow('Selectează');
});
it('continues the original send only after an explicit conversation choice', () => {
  const history: any[] = [{ role: 'assistant', cards: [{ source: 'propertyShareInput', rows: [{ mode: 'three' }] }] }];
  expect(propertyShareExecutionPrompt('Conversație: own', history)).toBe('Trimite primele trei potriviri clientului.');
  expect(propertyShareExecutionPrompt('Anulează', history)).toBe('Anulează');
  expect(propertyShareExecutionPrompt('Conversație: own', [])).toBe('Conversație: own');
});