import { expect, it } from 'vitest';
import { ownActiveProspects } from '../active-prospects';

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
