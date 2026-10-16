import { expect, it } from 'vitest';
import { promisingProspects } from '../promising-prospects';
const at = Date.parse('2026-10-16T10:00:00Z');
const base = { isFavoriteActive: true, ownerPhone: '+40 722 123 456' };
it('ranks recorded follow-up and valid phone, retaining concrete reasons and deterministic ties', () => {
  const rows = promisingProspects([{ ...base, id: 'b' }, { ...base, id: 'a' }, { ...base, id: 'c', contactOutcome: 'follow_up', ownerPhone: '' }, { ...base, id: 'd', contactOutcome: 'follow_up' }], 'me', at);
  expect(rows.map(row => [row.id, row.priorityScore])).toEqual([['d', 60], ['c', 40], ['a', 20], ['b', 20]]);
  expect(rows[1].priorityReasons).toContain('Telefon lipsă sau invalid: necesită completare înainte de apel');
});
it('excludes inactive, refused and other-agent prospects while allowing own, free and expired reservations', () => {
  const rows = [{ id: 'own', takenByAgentId: 'me' }, { id: 'free' }, { id: 'expired', reservedByAgentId: 'other', reservedAt: '2020-01-01' }, { id: 'other', takenByAgentId: 'other' }, { id: 'reserved', reservedByAgentId: 'other' }, { id: 'refused', contactOutcome: 'negative' }, { id: 'stopped', aiDoNotCall: true }, { id: 'inactive', isFavoriteActive: false }];
  expect(promisingProspects(rows.map(row => ({ ...base, ...row })), 'me', at).map(row => row.id)).toEqual(['expired', 'free', 'own']);
});
it('keeps the global top ten when the highest score arrives after a full page', () => {
  const first = Array.from({ length: 50 }, (_, index) => ({ ...base, id: `a-${String(index).padStart(2, '0')}` }));
  const final = promisingProspects([...promisingProspects(first, 'me', at), { ...base, id: 'z', contactOutcome: 'follow_up' }], 'me', at);
  expect(final).toHaveLength(10); expect(final[0].id).toBe('z'); expect(final[9].id).toBe('a-08');
  expect(promisingProspects([], 'me', at)).toEqual([]);
});
