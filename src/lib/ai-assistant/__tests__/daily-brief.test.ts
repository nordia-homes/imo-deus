import { expect, it } from 'vitest';
import { briefSettingsSchema, nextBriefRun, quietAt, validateBriefSettings } from '../daily-brief-contract';
import { resolveDatetime } from '../datetime';
const settings = briefSettingsSchema.parse({ timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5] });
it('respects local weekdays and DST rather than adding 24 hours', () => {
  expect(nextBriefRun(settings, new Date('2026-10-23T06:00:00Z'))).toBe('2026-10-26T06:30:00.000Z');
  expect(nextBriefRun(settings, new Date('2026-10-26T06:30:00Z'))).toBe('2026-10-27T06:30:00.000Z');
});
it('rejects quiet-hour delivery and incomplete WhatsApp settings', () => {
  expect(quietAt('23:00', '22:00', '08:00')).toBe(true);
  expect(quietAt('07:59', '22:00', '08:00')).toBe(true);
  expect(quietAt('08:00', '22:00', '08:00')).toBe(false);
  expect(() => validateBriefSettings({ ...settings, deliveryTime: '07:00' })).toThrow();
  expect(() => validateBriefSettings({ ...settings, deliveryChannel: 'whatsapp' })).toThrow();
});
it('uses only Bucharest and requires an offset for ambiguous local times', () => {
  expect(() => resolveDatetime({ date: '2026-10-06', time: '09:00', timezone: 'America/New_York' })).toThrow('Europe/Bucharest');
  expect(() => resolveDatetime({ date: '2026-10-25', time: '03:30' })).toThrow('ambiguă');
  expect(() => resolveDatetime({ date: '2026-03-29', time: '03:30' })).toThrow('nu există');
  expect(resolveDatetime({ date: '2026-10-25', time: '03:30', utcOffsetMinutes: 120 }).iso).toBe('2026-10-25T01:30:00.000Z');
});
