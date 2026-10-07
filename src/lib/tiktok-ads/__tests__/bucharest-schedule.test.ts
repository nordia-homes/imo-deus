import { expect, it } from 'vitest';
import { assertAdsScheduleTimezone, buildAdGroupInput, buildAdInputs, emptyAdDraft } from '../workspace-model';
import { approvalCreateIntent } from '../approval-model';
const schema = { type: 'object', properties: { schedule_start_time: {}, schedule_end_time: {} } };
it.each(['UTC', 'Europe/Chisinau', 'America/New_York', '', undefined])('refuses the incompatible account zone %s', zone => {
  expect(() => assertAdsScheduleTimezone(zone)).toThrow('Europe/Bucharest');
});
it.each(['UTC', 'Europe/Chisinau'])('blocks both ad and group preparation under %s without changing draft wall times', zone => {
  const draft = { ...emptyAdDraft, name: 'Test', propertyId: 'p', identityId: 'i', assetId: 'a', text: 'Test', url: 'https://example.com', start: '2026-10-08T12:00', end: '2026-10-09T12:00' };
  expect(() => buildAdInputs(draft, {}, zone)).toThrow('Europe/Bucharest');
  expect(() => buildAdGroupInput(draft, schema, zone)).toThrow('Europe/Bucharest');
  expect(() => approvalCreateIntent({ ...draft, adgroupId: 'existing' }, {}, zone)).toThrow('Europe/Bucharest');
  expect(draft.start).toBe('2026-10-08T12:00');
});
it.each([
  ['2026-01-15T09:00', '2026-01-15 07:00:00'],
  ['2026-07-15T09:00', '2026-07-15 06:00:00'],
])('preserves the Bucharest instant for %s', (start, expected) => {
  expect(buildAdGroupInput({ ...emptyAdDraft, start }, schema, 'Europe/Bucharest')).toMatchObject({ schedule_start_time: expected });
});
it.each(['2026-03-29T03:30', '2026-10-25T03:30'])('refuses an ambiguous or nonexistent Bucharest time %s', start => {
  expect(() => buildAdGroupInput({ ...emptyAdDraft, start }, schema, 'Europe/Bucharest')).toThrow('ambiguă sau inexistentă');
});
