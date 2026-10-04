import { describe, expect, it } from 'vitest';
import { actionSchema, searchSchema, safeData, overlaps, automationSchema } from '../contracts';
import { ownerSearchFields, parseOwnerPrice } from '@/lib/owner-listings/search-index';

describe('assistant command boundary', () => {
  it('defaults property search to owners', () => { expect(searchSchema.parse({}).source).toBe('owners'); });
  it('rejects model-granted consent and arbitrary role edits', () => {
    expect(actionSchema.safeParse({ kind: 'grant_consent', confirmed: true }).success).toBe(false);
    expect(actionSchema.safeParse({ kind: 'update_contact', contactId: 'x', patch: { role: 'admin' } }).success).toBe(false);
  });
  it('requires explicit timezone and real ids', () => {
    expect(actionSchema.safeParse({ kind: 'schedule_viewing', contactId: '../contacts', propertyId: 'p', viewingDate: '2027-02-02T12:00:00' }).success).toBe(false);
    expect(actionSchema.parse({ kind: 'schedule_viewing', contactId: 'c', propertyId: 'p', viewingDate: '2027-02-02T12:00:00+02:00' }).kind).toBe('schedule_viewing');
    expect(actionSchema.parse({ kind: 'create_task', description: 'Follow-up', dueDate: '2027-02-02T12:00:00+02:00' })).toMatchObject({ dueDate: '2027-02-02T10:00:00.000Z' });
  });
  it('uses the existing CRM budget and priority types', () => {
    expect(actionSchema.parse({ kind: 'update_contact', contactId: 'c', patch: { budget: 130000, priority: 'Ridicată' } })).toMatchObject({ patch: { budget: 130000 } });
    expect(actionSchema.safeParse({ kind: 'update_contact', contactId: 'c', patch: { budget: '130000' } }).success).toBe(false);
  });
  it('strips nested credentials without stripping ordinary CRM fields', () => {
    expect(safeData({ name: 'Ana', nested: [{ accessToken: 'secret', phone: '123', tokenExpiresAt: 'x', privateKey: 'secret' }] })).toEqual({ name: 'Ana', nested: [{ phone: '123' }] });
  });
  it('allows adjacent bookings and rejects overlapping intervals', () => {
    expect(overlaps('2027-01-01T12:00:00Z', 60, '2027-01-01T13:00:00Z')).toBe(false);
    expect(overlaps('2027-01-01T12:00:00Z', 60, '2027-01-01T12:59:00Z')).toBe(true);
  });
  it('limits scheduled repetition and defaults stop-on-reply', () => {
    const row = automationSchema.parse({ type: 'whatsapp_template', nextRunAt: '2027-01-01T12:00:00Z', conversationId: 'c', template: { name: 'colaborare', language: 'ro' } });
    expect(row).toMatchObject({ stopOnReply: true, maxRuns: 1 });
    expect(automationSchema.safeParse({ ...row, intervalMinutes: 1 }).success).toBe(false);
  });
});
describe('owner prices and atomic index fields', () => {
  it.each([['130.000 €', 130000], ['130,000 EUR', 130000], ['120000.00 euro', 120000], ['120 000,50 €', 120000.5], ['1.200.000 EUR', 1200000], ['Negociabil', null], ['200 EUR/mp', null]])('parses %s correctly', (value, expected) => { expect(parseOwnerPrice(value)).toBe(expected); });
  it('does not assume unknown currency is EUR', () => {
    expect(ownerSearchFields({ price: '130000' })).toMatchObject({ searchCurrency: 'unknown', searchPrice: 130000, searchVersion: 1 });
    expect(ownerSearchFields({ price: '130000 lei' }).searchCurrency).toBe('RON');
  });
  it('recomputes the projection from changed source, not stale numeric fields', () => {
    expect(ownerSearchFields({ price: '125.000 €', priceValue: 999999, location: 'Piața Victoriei' })).toMatchObject({ searchPrice: 125000, searchLocation: 'piata victoriei' });
  });
});
