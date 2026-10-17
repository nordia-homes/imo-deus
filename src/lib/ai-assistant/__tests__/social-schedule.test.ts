import { expect, it } from 'vitest';
import { socialScheduleAction, socialScheduleRequest, socialScheduleTime } from '../social-schedule';
import { socialCrmContentMatches, socialDraftRevision } from '@/lib/communications/social-content';
import { explicitlyRequestedSafeAction } from '../autonomy';
it('recognizes scheduling separately from immediate publishing', () => {
  expect(socialScheduleRequest('Programează postarea prin canalul suportat.')).toBe(true);
  expect(socialScheduleRequest('Programează postarea organică la ora cerută.')).toBe(true);
  expect(socialScheduleRequest('Publică postarea după approval.')).toBe(false);
  const action = { kind: 'existing_operation', operation: 'social_publish', params: { postId: 'p' }, query: {}, body: { scheduledAt: '2027-01-20T05:30:00.000Z', schedulingOnly: true, expectedRevision: 'a'.repeat(64) } } as const;
  expect(socialScheduleAction(action)).toBe(true); expect(explicitlyRequestedSafeAction(action, 'Programează postarea prin canalul suportat.')).toBe(true);
  expect(socialScheduleAction({ ...action, body: { ...action.body, schedulingOnly: false } })).toBe(false);
});
it('uses Bucharest winter and summer offsets without accepting invalid or ambiguous local dates', () => {
  expect(socialScheduleTime('2027-01-20', '07:30', 0)).toBe('2027-01-20T05:30:00.000Z');
  expect(socialScheduleTime('2027-07-20', '07:30', 0)).toBe('2027-07-20T04:30:00.000Z');
  expect(socialScheduleTime('2026-03-29', '03:30', 0)).toBeNull(); expect(socialScheduleTime('2026-10-25', '03:30', 0)).toBeNull();
  expect(socialScheduleTime('2027-02-30', '07:30', 0)).toBeNull(); expect(socialScheduleTime('2027-01-20', '07:30', Date.parse('2027-01-20T05:30:00Z'))).toBeNull();
});
it('invalidates CRM drafts on description, photo order, price and title changes', () => {
  const property = { description: 'Exact', images: [{ url: 'https://example.test/a' }, { url: 'https://example.test/b' }], price: 10, title: 'Title' };
  const draft = { contentSource: 'crm', text: 'Exact', images: property.images.map(x => x.url), propertyPrice: 10, propertyTitle: 'Title' };
  expect(socialCrmContentMatches(draft, property)).toBe(true);
  for (const patch of [{ description: 'Changed' }, { images: [...property.images].reverse() }, { price: 11 }, { title: 'New' }, { deletedAt: 'now' }]) expect(socialCrmContentMatches(draft, { ...property, ...patch })).toBe(false);
  expect(socialCrmContentMatches({ contentSource: 'manual' }, undefined)).toBe(true);
  expect(socialDraftRevision({ ...draft, text: 'Other' })).not.toBe(socialDraftRevision(draft));
});