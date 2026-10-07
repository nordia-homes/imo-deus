import { expect, it } from 'vitest';
import { compressedResult, contextMessages } from '../context';
import type { AssistantMessage } from '../contracts';

const feedback = { previousAlertFeedback: 'not_useful', alertFeedbackUpdatedAt: '2026-10-07T10:00:00.000Z', feedbackNote: 'Evaluarea alertei de atunci; nu evaluează oferta actuală.' };
const large = 'ș'.repeat(20000);

it('keeps stale matching evidence with the original score and selected position', () => {
  const input = { rows: [{ id: 'p', matchScore: 91, scoreMayBeStale: true, selectedPosition: 2, description: large }], scoreMayBeStale: true, scoreRecalculated: false, scoringSource: 'existing_imodeus_matching', contactId: 'c', orderSource: 'saved_display_order', note: 'Scorul păstrează calculul anterior.', resultSetId: 'set' };
  const encoded = compressedResult(input, 2000), result = JSON.parse(encoded);
  expect(result).toMatchObject({ complete: false, scoreMayBeStale: true, scoreRecalculated: false, scoringSource: input.scoringSource, contactId: 'c', orderSource: input.orderSource, note: input.note, resultSetId: 'set', rows: [{ id: 'p', matchScore: 91, scoreMayBeStale: true, selectedPosition: 2 }] });
  expect(Buffer.byteLength(encoded)).toBeLessThanOrEqual(2000);
  expect(input.rows[0].description).toBe(large);
});

it('retains the date and historical meaning of feedback in large results', () => {
  const result = JSON.parse(compressedResult({ rows: [{ id: 'p', ...feedback, description: large }] }, 2000));
  expect(result.rows[0]).toMatchObject(feedback);
});

it('retains live pagination and currency limitations without claiming a complete preview', () => {
  const metadata = { freshness: 'live_firestore', observedAt: '2026-10-07T10:00:00.000Z', paginationConsistency: 'live_cursor', uncertainCurrency: 2, note: 'Anunțurile mutate înaintea cursorului apar la reluarea căutării.' };
  const result = JSON.parse(compressedResult({ ...metadata, rows: [{ id: 'p', description: large }], complete: true, nextCursor: 'cursor' }, 2000));
  expect(result).toMatchObject({ ...metadata, complete: false, nextCursor: 'cursor' });
});

it('omits a row rather than detaching its oversized qualification', () => {
  const encoded = compressedResult({ rows: [{ id: 'p', matchScore: 91, feedbackNote: large }] }, 500);
  expect(JSON.parse(encoded)).toMatchObject({ rows: [], complete: false, truncated: true });
  expect(Buffer.byteLength(encoded)).toBeLessThanOrEqual(500);
});

it('returns a bounded empty preview when the envelope alone exceeds the budget', () => {
  const encoded = compressedResult({ rows: [{ id: 'p', matchScore: 91 }], note: large, resultSetId: large }, 256);
  expect(JSON.parse(encoded)).toMatchObject({ rows: [], complete: false, truncated: true });
  expect(Buffer.byteLength(encoded)).toBeLessThanOrEqual(256);
  expect(JSON.parse(encoded)).not.toHaveProperty('resultSetId');
});

it('preserves complete identifiers instead of shortening them into different references', () => {
  const id = 'p'.repeat(180);
  expect(JSON.parse(compressedResult({ rows: [{ id, description: large }] }, 2000)).rows[0].id).toBe(id);
});

it('keeps small results unchanged and still removes credential fields', () => {
  expect(JSON.parse(compressedResult({ rows: [{ id: 'p', ...feedback, apiKey: 'secret-value' }], complete: true }))).toEqual({ rows: [{ id: 'p', ...feedback }], complete: true });
});

it('marks history as partial historical context with original qualifications', () => {
  const history: AssistantMessage[] = [{ id: 'm', role: 'assistant', text: 'Rezultate', createdAt: '', cards: [{ type: 'results', title: 'Matching', source: 'crm', resultSetId: 'set', complete: true, scoreMayBeStale: true, note: 'Scorurile pot fi învechite.', rows: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, ...feedback, scoreMayBeStale: true })) }] }];
  const messages = contextMessages(history);
  const card = JSON.parse(messages[0].content.split('\nRESULT_REFERENCES ')[1])[0];
  expect(card).toMatchObject({ historical: true, complete: false, sourceComplete: true, scoreMayBeStale: true, note: history[0].cards![0].note, resultSetId: 'set' });
  expect(card.entities).toHaveLength(6);
  expect(card.entities[0]).toMatchObject({ id: 'p0', ...feedback, scoreMayBeStale: true });
  expect(contextMessages(history, 500)).toEqual([]);
});

it.each([0, 255, NaN, Infinity, 1000.5])('rejects unusable byte budget %s', max => {
  expect(() => compressedResult({}, max)).toThrow('Invalid context byte budget');
});
