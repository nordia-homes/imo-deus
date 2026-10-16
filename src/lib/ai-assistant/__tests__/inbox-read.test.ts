import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { inboxPhraseMatches, inboxRequest, inboxConversationMatches, orderedInboxMessages, selectedInboxConversation } from '../inbox-read';
it('recognizes the nine original requests without treating a send command as reading', () => {
  const prompts = ['Arată-mi conversațiile necitite.', 'Arată-mi conversațiile WhatsApp de azi.', 'Găsește conversația cu Andrei.', 'Arată-mi ultimele zece mesaje din conversație.', 'Rezumă-mi conversația cu Andrei.', 'Ce întrebare a clientului a rămas fără răspuns?', 'Ce i-am promis clientului?', 'Caută în conversații după cuvântul „credit”.', 'Caută mesajele despre proprietatea din Titan.'];
  expect(prompts.map(prompt => inboxRequest(prompt)?.mode)).toEqual(['unread', 'today', 'find', 'latest', 'summary', 'unanswered', 'promises', 'search', 'property']);
  expect(inboxRequest(prompts[7])?.query).toBe('credit'); expect(inboxRequest('Trimite mesajul lui Andrei')).toBeNull();
});
it('compares read timestamps rather than needsReply and handles absent read markers', () => {
  const row = { lastMessageAt: '2026-10-16T08:00:00Z', needsReply: false };
  expect(inboxConversationMatches(row, { mode: 'unread' }, 'me', 0)).toBe(true);
  expect(inboxConversationMatches({ ...row, readBy: { me: row.lastMessageAt }, needsReply: true }, { mode: 'unread' }, 'me', 0)).toBe(false);
});
it('uses the Bucharest calendar and exact normalized name tokens', () => {
  const at = Date.parse('2026-10-15T22:00:00Z');
  expect(inboxConversationMatches({ channel: 'whatsapp', lastMessageAt: '2026-10-15T21:30:00Z' }, { mode: 'today' }, 'me', at)).toBe(true);
  expect(inboxConversationMatches({ channel: 'messenger', lastMessageAt: '2026-10-15T21:30:00Z' }, { mode: 'today' }, 'me', at)).toBe(false);
  expect(inboxConversationMatches({ name: 'Andrei Șerban' }, { mode: 'find', query: 'serban' }, 'me', at)).toBe(true);
  expect(inboxConversationMatches({ name: 'Andreia' }, { mode: 'find', query: 'andrei' }, 'me', at)).toBe(false);
});
it('orders chronologically with deterministic ties and preserves delivery status', () => {
  const rows = orderedInboxMessages([{ id: 'b', createdAt: '2026-01-01', status: 'queued' }, { id: 'a', createdAt: '2026-01-01', status: 'failed' }]);
  expect(rows.map(row => row.id)).toEqual(['a', 'b']); expect(rows[1].status).toBe('queued');
});
it('does not select stale history or multiple conversations', () => {
  const message: any = { role: 'assistant', cards: [{ source: 'conversations', rows: [{ id: 'a' }] }] };
  expect(selectedInboxConversation([message])).toBe('a');
  expect(selectedInboxConversation([message, { ...message, cards: [] }])).toBeNull();
  expect(selectedInboxConversation([{ ...message, cards: [{ source: 'conversations', rows: [{ id: 'a' }, { id: 'b' }] }] }])).toBeNull();
});
it('matches neighborhoods as normalized words rather than unrelated name prefixes', () => {
  expect(inboxPhraseMatches('Proprietatea din Titan, București', 'titan')).toBe(true);
  expect(inboxPhraseMatches('Am văzut filmul Titanic', 'titan')).toBe(false);
  expect(inboxPhraseMatches('Apartament în Cișmigiu', 'cismigiu')).toBe(true);
});
