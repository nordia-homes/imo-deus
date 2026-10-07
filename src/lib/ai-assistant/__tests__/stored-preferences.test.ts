import { expect, it } from 'vitest';
import { storedPreference } from '../preferences';
const key = 'preferred_timezone', now = 1000;
const row = { ownerId: 'u', key, value: 'Europe/Bucharest', expiresAt: 2000 };
it('accepts a valid legacy preference without requiring a new schema version', () => {
  expect(storedPreference(row, key, 'u', now)).toEqual({ key, value: row.value });
});
it.each([
  { ownerId: 'other' }, { key: 'preferred_message_tone' }, { expiresAt: 1000 }, { expiresAt: '2000' },
  { expiresAt: Infinity }, { value: 'invalid/timezone' }, { value: '' }, { value: 'x'.repeat(201) }, { value: { text: 'Europe/Bucharest' } },
])('ignores a malformed, expired or misidentified stored preference: %j', patch => {
  expect(storedPreference({ ...row, ...patch }, key, 'u', now)).toBeNull();
});
it('validates typed time preferences while treating free-form style as bounded data', () => {
  expect(storedPreference({ ...row, key: 'preferred_brief_time', value: '25:12' }, 'preferred_brief_time', 'u', now)).toBeNull();
  expect(storedPreference({ ...row, key: 'preferred_response_style', value: '  concis  ' }, 'preferred_response_style', 'u', now)).toEqual({ key: 'preferred_response_style', value: 'concis' });
});
