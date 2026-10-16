import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), readResource: vi.fn(), getResource: vi.fn() }));
import { prospectingReport, selectedPostCallProspect } from '../post-call-report';
const at = Date.parse('2026-10-15T22:30:00Z');
const favorites = [{ id: 'p', title: 'Own' }, { id: 'foreign', takenByAgentId: 'other' }];
const call = { id: 'call', ownerListingId: 'p', status: 'completed', startedAt: '2026-10-15T22:10:00Z', endedAt: '2026-10-15T22:20:00Z' };
it('counts the Bucharest day and excludes queues, previous day, foreign assignments and agents', () => {
  const report = prospectingReport(favorites, [call, { ...call, id: 'old', startedAt: '2026-10-15T20:00:00Z' }, { ...call, id: 'foreign', ownerListingId: 'foreign' }, { ...call, id: 'colleague', agentId: 'other' }, { id: 'queued', ownerListingId: 'p', status: 'queued', createdAt: call.startedAt }], 'me', at);
  expect(report.day).toBe('2026-10-16'); expect(report.summary.aiCallsToday).toBe(1); expect(report.summary.aiMissingResultToday).toBe(1);
});
it.each(['no_answer', 'busy', 'verbal_agreement', 'does_not_collaborate', 'needs_human_review'])('recognizes recorded outcome %s', outcome => {
  expect(prospectingReport(favorites, [{ ...call, outcome }], 'me', at).missing).toEqual([]);
});
it('does not treat old notes, malformed dates or a previous result as a new outcome', () => {
  for (const contactOutcomeAt of ['invalid', '2026-10-15T20:00:00Z']) expect(prospectingReport([{ id: 'p', contactOutcome: 'follow_up', contactOutcomeAt }], [call], 'me', at).missing).toHaveLength(1);
  expect(prospectingReport([{ id: 'p', contactOutcome: 'follow_up', contactOutcomeAt: '2026-10-15T22:25:00Z' }], [call], 'me', at).missing).toEqual([]);
});
it('keeps manual result counts separate from AI calls and ignores other agents results', () => {
  const rows = [{ id: 'p', contactOutcome: 'negative', contactOutcomeAt: call.startedAt, contactOutcomeByAgentId: 'me' }, { id: 'q', contactOutcome: 'follow_up', contactOutcomeAt: call.startedAt, contactOutcomeByAgentId: 'other' }];
  expect(prospectingReport(rows, [call], 'me', at).summary).toMatchObject({ aiCallsToday: 1, manualResultsRecordedToday: 1, manualRefusalsToday: 1, manualFollowupsToday: 0 });
});
it('requires a single prospect in the latest assistant message', () => {
  expect(selectedPostCallProspect([])).toBeNull();
  const selected: any = { role: 'assistant', cards: [{ source: 'ownerListingFavorites', rows: [{ id: 'p' }] }] };
  expect(selectedPostCallProspect([selected])).toBe('p');
  expect(selectedPostCallProspect([selected, { ...selected, cards: [] }])).toBeNull();
});
it('includes completed human call tasks but not document tasks, open tasks or colleagues tasks', () => {
  const task = { id: 'human', ownerListingId: 'p', description: 'Sună proprietarul', status: 'completed', completedAt: call.endedAt };
  const tasks = [task, { ...task, id: 'docs', description: 'Verifică actele' }, { ...task, id: 'open', status: 'open' }, { ...task, id: 'other', agentId: 'other' }];
  const report = prospectingReport(favorites, [], 'me', at, tasks);
  expect(report.missing.map(row => row.id)).toEqual(['human']);
  expect(report.summary.humanTasksMissingResult).toBe(1);
  expect(report.summary.aiMissingResultToday).toBe(0);
});
