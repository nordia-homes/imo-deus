import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
vi.mock('../message-preparation', () => ({ prepareMessage: vi.fn() }));
vi.mock('@/lib/communications/outbound', () => ({ queueMessage: vi.fn() }));
import { draftPreparationRequest, draftSendAction, latestDraftContext, messageDraftCommand } from '../message-draft';
it('recognizes preparation and keeps the supplied text literal', () => {
  expect(draftPreparationRequest('Pregătește mesajul pentru Andrei.')).toEqual({ name: 'andrei', text: '' });
  expect(draftPreparationRequest('Pregătește mesajul pentru Andrei: Bună: ne vedem mâine?')).toEqual({ name: 'andrei', text: 'Bună: ne vedem mâine?' });
  expect(draftPreparationRequest('Nu pregăti mesajul pentru Andrei')).toBeNull();
});
it.each([['Arată-mi preview-ul mesajului înainte.', 'preview'], ['Trimite mesajul aprobat.', 'send'], ['Nu trimite răspunsurile încă.', 'hold']])('recognizes %s', (prompt, mode) => { expect(messageDraftCommand(prompt)).toBe(mode); });
it('does not treat explanation, negation or combined commands as approval', () => {
  for (const text of ['Nu trimite mesajul aprobat', 'Explică: trimite mesajul aprobat', 'Trimite mesajul aprobat și șterge conversația']) expect(messageDraftCommand(text)).toBeNull();
});
it('selects only the latest unique draft', () => {
  const row: any = { role: 'assistant', cards: [{ source: 'messageDrafts', rows: [{ id: 'd' }] }] };
  expect(latestDraftContext([row], 'messageDrafts')?.id).toBe('d');
  expect(latestDraftContext([row, { ...row, cards: [] }], 'messageDrafts')).toBeNull();
  expect(latestDraftContext([{ ...row, cards: [{ source: 'messageDrafts', rows: [{ id: 'd' }, { id: 'e' }] }] }], 'messageDrafts')).toBeNull();
});
it('accepts only a server draft reference, never mixed text or invented approvals', () => {
  const action: any = { kind: 'existing_operation', operation: 'message_send', params: { conversationId: 'c' }, query: {}, body: { assistantDraftId: 'd', assistantSessionId: 's' } };
  expect(draftSendAction(action)).toBe(true);
  expect(draftSendAction({ ...action, body: { ...action.body, text: 'Different' } })).toBe(false);
  expect(draftSendAction({ ...action, body: { ...action.body, assistantDraftId: '../other' } })).toBe(false);
  expect(draftSendAction({ ...action, query: { send: 'true' } })).toBe(false);
});