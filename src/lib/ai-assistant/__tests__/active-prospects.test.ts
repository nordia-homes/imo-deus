import { expect, it } from 'vitest';
import { ownActiveProspects, otherReservedProspects, otherAssignedProspects } from '../active-prospects';

it('keeps taken, contacted and inactive assignments protected even with an expired reservation', () => {
  const base = { reservedByAgentId: 'other', reservedAt: '2020-01-01T00:00:00Z' };
  expect(otherAssignedProspects([
    { ...base, id: 'expired' }, { ...base, id: 'taken', takenByAgentId: 'other', takenByAgentName: 'Beta' },
    { ...base, id: 'inactive', isFavoriteActive: false, contactOutcome: 'negative', contactOutcomeByAgentId: 'other' },
    { ...base, id: 'mine', takenByAgentId: 'me' },
  ], 'me', Date.now()).map(row => [row.id, row.ownership])).toEqual([['taken', 'taken'], ['inactive', 'contact_outcome']]);
});

it('lists only other agents reservations, keeps undated locks protected and formats Bucharest dates', () => {
  const at = Date.parse('2026-10-12T10:00:00Z');
  const base = { isFavoriteActive: true, reservedByAgentId: 'other', reservedAt: '2026-10-12T07:00:00Z' };
  const result = otherReservedProspects([
    { ...base, id: 'valid', reservedByAgentName: 'Agent Beta' },
    { ...base, id: 'unknown', reservedAt: 'invalid' },
    { ...base, id: 'mine', reservedByAgentId: 'me' },
    { ...base, id: 'expired', reservedAt: '2026-10-12T06:00:00Z' },
    { ...base, id: 'taken', takenByAgentId: 'other' },
    { ...base, id: 'outcome', contactOutcome: 'follow_up', contactOutcomeByAgentId: 'other' },
    { ...base, id: 'inactive', isFavoriteActive: false },
  ], 'me', at);
  expect(result.map(row => row.id)).toEqual(['valid', 'unknown']);
  expect(result[0]).toMatchObject({ agentId: 'other', agentName: 'Agent Beta', reservedLocal: '2026-10-12 10:00 (ora București)', expiresLocal: '2026-10-12 14:00 (ora București)', expirationKnown: true });
  expect(result[1]).toMatchObject({ reservedLocal: null, expiresLocal: null, expirationKnown: false });
});

it('calculates reservation expiry across the Bucharest autumn clock change as four elapsed hours', () => {
  const rows = [{ id: 'dst', isFavoriteActive: true, reservedByAgentId: 'other', reservedAt: '2026-10-24T23:30:00Z' }];
  expect(otherReservedProspects(rows, 'me', Date.parse('2026-10-25T00:00:00Z'))[0]).toMatchObject({ reservedLocal: '2026-10-25 02:30 (ora București)', expiresLocal: '2026-10-25 05:30 (ora București)' });
});

it('uses CRM ownership precedence and excludes inactive, unassigned and expired reservations at the exact boundary', () => {
  const at = Date.parse('2026-10-12T10:00:00Z');
  const rows = [
    { id: 'fresh', reservedByAgentId: 'me', reservedAt: '2026-10-12T06:00:00.001Z' },
    { id: 'expired', reservedByAgentId: 'me', reservedAt: '2026-10-12T06:00:00Z' },
    { id: 'taken', reservedByAgentId: 'other', takenByAgentId: 'me' },
    { id: 'other-taken', reservedByAgentId: 'me', takenByAgentId: 'other' },
    { id: 'outcome', reservedByAgentId: 'other', contactOutcome: 'follow_up', contactOutcomeByAgentId: 'me' },
    { id: 'other-outcome', reservedByAgentId: 'me', contactOutcome: 'negative', contactOutcomeByAgentId: 'other' },
    { id: 'unassigned', createdBy: 'me' },
  ].map(row => ({ isFavoriteActive: true, ...row }));
  expect(ownActiveProspects([...rows, { id: 'inactive', isFavoriteActive: false, takenByAgentId: 'me' }, { id: 'unknown', takenByAgentId: 'me' }], 'me', at).map(row => row.id)).toEqual(['fresh', 'taken', 'outcome']);
});
