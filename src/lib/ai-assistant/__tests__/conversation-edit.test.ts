import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { conversationEditPrompt, conversationEditRequest, requestedConversationEdit, simpleConversationEdit } from '../conversation-edit';
import { executionConfirmation } from '../execution-confirmation';
const action = (operation: string, body: Record<string, unknown>): any => ({ kind: 'existing_operation', operation, params: { conversationId: 'a' }, query: {}, body: { version: 1, ...body } });
it.each(['Adaugă o notă internă conversației.', 'Atribuie conversația unui agent dacă am permisiune.', 'Leagă conversația de proprietatea corectă.'])('recognizes the original request %s', prompt => { expect(conversationEditRequest(prompt)?.value).toBe(''); });
it('keeps note text literal and rejects unrequested operations', () => {
  expect(conversationEditRequest('Adaugă o notă internă conversației: Clientul spune: nu suna.')).toEqual({ mode: 'note', value: 'Clientul spune: nu suna.' });
  expect(conversationEditRequest('Nu adăuga o notă internă conversației')).toBeNull();
  expect(conversationEditRequest('Explică atribuirea conversației')).toBeNull();
});
it('resumes only the immediately pending edit and respects cancellation', () => {
  const pending: any = { role: 'assistant', cards: [{ source: 'conversationEditRequest', rows: [{ mode: 'note' }] }] };
  expect(conversationEditPrompt('Textul meu', [pending])).toBe('Adaugă o notă internă conversației: Textul meu');
  expect(conversationEditPrompt('Anulează', [pending])).toBe('Anulează');
  expect(conversationEditPrompt('Textul meu', [pending, { role: 'assistant', cards: [] } as any])).toBe('Textul meu');
});
it('requires a complete strict mutation shape and the exact note requested', () => {
  const note = action('conversation_note', { text: 'Exact' });
  expect(simpleConversationEdit(note)).toBe(true);
  expect(requestedConversationEdit(note, 'Adaugă o notă internă conversației: Exact')).toBe(true);
  expect(requestedConversationEdit(note, 'Adaugă o notă internă conversației: Diferit')).toBe(false);
  expect(simpleConversationEdit(action('conversation_note', { text: 'Exact', status: 'open' }))).toBe(false);
  expect(simpleConversationEdit(action('conversation_update', { assigneeId: 'a/b' }))).toBe(false);
  expect(simpleConversationEdit(action('conversation_update', { propertyId: 'p', assigneeId: 'a' }))).toBe(false);
  expect(simpleConversationEdit(action('conversation_note', { text: ' ' }))).toBe(false);
});
it('confirms only persisted edit receipts', () => {
  expect(executionConfirmation([{ kind: 'existing_operation', result: { operation: 'conversation_note', executionState: 'succeeded', conversationId: 'a', state: 'note', noteId: 'n' } }])).toContain('Nota internă a fost salvată');
  expect(executionConfirmation([{ kind: 'existing_operation', result: { operation: 'conversation_note', executionState: 'failed', conversationId: 'a', state: 'note', noteId: 'n' } }])).not.toContain('Nota internă a fost salvată');
});