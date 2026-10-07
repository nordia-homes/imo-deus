import { expect, it } from 'vitest';
import { metaDraftOutcome } from '../meta-draft-outcome';

const ctx = { agencyId: 'a', uid: 'u' };
const body = { propertyId: 'p', objective: 'leads', budgetType: 'daily', budgetAmount: 50, durationDays: 7 };
const draft = { ...body, id: 'c', agencyId: 'a', createdByUid: 'u', currency: 'RON', status: 'draft' };

it.each(['draft', 'ready', 'ready_to_publish'])('confirms the saved draft in %s without claiming publication', status => {
  const result = metaDraftOutcome(ctx, 'c', body, { ...draft, status }, { campaign: draft });
  expect(result).toMatchObject({ completionSatisfied: true, executionState: 'draft', watchable: false });
  expect(result.note).toContain('nu publicarea');
});

it.each([
  { id: 'other' }, { agencyId: 'other' }, { createdByUid: 'other' }, { createdByUid: undefined },
  { propertyId: 'other' }, { objective: 'traffic' }, { budgetType: 'lifetime' },
  { budgetAmount: 500 }, { durationDays: 30 }, { currency: 'EUR' },
  { status: 'published' }, { status: 'publishing' }, { status: 'error' },
])('rejects a changed identity, requested parameter or non-draft state: %j', patch => {
  expect(metaDraftOutcome(ctx, 'c', body, { ...draft, ...patch }, { campaign: draft })).toMatchObject({ completionSatisfied: false, executionState: 'unknown', watchable: false });
});

it('checks the actual request even if both stored copies agree on the wrong budget', () => {
  const wrong = { ...draft, budgetAmount: 500 };
  expect(metaDraftOutcome(ctx, 'c', body, wrong, { campaign: wrong }).completionSatisfied).toBe(false);
});

it('uses the handler receipt for omitted options and accepts route-normalized numbers', () => {
  expect(metaDraftOutcome(ctx, 'c', { propertyId: 'p' }, draft, { campaign: draft }).completionSatisfied).toBe(true);
  expect(metaDraftOutcome(ctx, 'c', { ...body, budgetAmount: '50', durationDays: '7' }, draft, { campaign: draft }).completionSatisfied).toBe(true);
});

it.each([{ budgetAmount: NaN }, { budgetAmount: -1 }, { durationDays: 0 }, { durationDays: 1.5 }, { currency: 'invalid' }, { objective: 'invalid' }, { budgetType: 'invalid' }])('rejects malformed values even when the receipt matches: %j', patch => {
  const invalid = { ...draft, ...patch };
  expect(metaDraftOutcome(ctx, 'c', { propertyId: 'p' }, invalid, { campaign: invalid }).completionSatisfied).toBe(false);
});

it('does not certify legacy evidence missing the snapshot, ID, or current draft', () => {
  expect(metaDraftOutcome(ctx, 'c', body, draft, {}).completionSatisfied).toBe(false);
  expect(metaDraftOutcome(ctx, undefined, body, draft, { campaign: draft }).completionSatisfied).toBe(false);
  expect(metaDraftOutcome(ctx, 'c', body, undefined, { campaign: draft }).completionSatisfied).toBe(false);
  expect(metaDraftOutcome(ctx, 'c', body, draft, { campaign: { ...draft, createdByUid: 'other' } }).completionSatisfied).toBe(false);
});

it('ignores unrelated timestamps while returning no campaign payload or provider IDs', () => {
  const result = metaDraftOutcome(ctx, 'c', body, { ...draft, updatedAt: 'new', headline: 'Edited creative', metaCampaignId: 'private-provider-id' }, { campaign: draft });
  expect(result.completionSatisfied).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-provider-id|Edited creative/);
});
