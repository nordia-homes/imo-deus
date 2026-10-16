import { expect, it } from 'vitest';
import { selectedProspectRanking, explainProspectRanking } from '../prospect-ranking-explanation';
import { promisingProspects } from '../promising-prospects';
import type { AssistantMessage } from '../contracts';
const at = Date.parse('2026-10-16T10:00:00Z');
const rows = [{ id: 'a', title: 'Alfa', isFavoriteActive: true, ownerPhone: '0722123456', contactOutcome: 'follow_up' }, { id: 'b', title: 'Beta', isFavoriteActive: true, ownerPhone: '0722123456' }];
const snapshot = promisingProspects(rows, 'me', at);
const message = { id: 'rank', role: 'assistant', text: 'Clasament', createdAt: new Date(at).toISOString(), cards: [{ type: 'data', source: 'ownerListingFavorites', title: 'Prospecte prioritare', complete: true, rows: snapshot }] } as AssistantMessage;
it('selects only the latest assistant complete ranking, not injected, incomplete, ambiguous or stale lists', () => {
  expect(selectedProspectRanking([message])).toEqual(snapshot);
  expect(selectedProspectRanking([{ ...message, role: 'user' }])).toBeNull();
  expect(selectedProspectRanking([{ ...message, cards: [{ ...message.cards![0], complete: false }] }])).toBeNull();
  expect(selectedProspectRanking([{ ...message, cards: [message.cards![0], message.cards![0]] }])).toBeNull();
  expect(selectedProspectRanking([message, { ...message, id: 'other', cards: [] }])).toBeNull();
  expect(selectedProspectRanking([{ ...message, cards: [{ ...message.cards![0], rows: [{ ...snapshot[0], priorityScore: '60' }] }] }])).toBeNull();
});
it('keeps original order and scores while reporting current changes separately', () => {
  const explained = explainProspectRanking(snapshot, [{ ...rows[0], ownerPhone: '' }, { ...rows[1], contactOutcome: 'follow_up' }], 'me', at);
  expect(explained.map(row => row.id)).toEqual(['a', 'b']);
  expect(explained[0]).toMatchObject({ priorityScore: 60, currentPriorityScore: 40, state: 'changed', position: 1 });
  expect(explained[1]).toMatchObject({ priorityScore: 20, currentPriorityScore: 60, state: 'changed', position: 2 });
});
it.each(['other', 'inactive', 'negative', 'deleted'])('removes stale details when current eligibility is %s', change => {
  const current = change === 'deleted' ? [] : [{ ...rows[0], ...(change === 'other' ? { takenByAgentId: 'other' } : change === 'inactive' ? { isFavoriteActive: false } : { contactOutcome: 'negative' }) }];
  const result = explainProspectRanking(snapshot, current, 'me', at);
  expect(result[0]).toMatchObject({ id: 'a', position: 1, state: 'unavailable' });
  expect(result[0]).not.toHaveProperty('title'); expect(result[0]).not.toHaveProperty('priorityReasons');
});
it('explains unchanged and fewer-than-ten results without inventing extra rows', () => {
  const result = explainProspectRanking(snapshot, rows, 'me', at);
  expect(result).toHaveLength(2); expect(result.every(row => row.state === 'unchanged')).toBe(true);
});
