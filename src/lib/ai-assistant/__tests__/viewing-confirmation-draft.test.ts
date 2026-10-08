import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { confirmationDraft } from '../viewing-confirmation-draft';
const now = new Date('2030-01-01T08:00:00Z');
const row = { id: 'v', status: 'scheduled', viewingDate: '2030-01-02T15:00:00Z', contactId: 'c', contactName: 'Alin', contactPhone: '0700000001', propertyId: 'p', propertyTitle: 'Cișmigiu', propertyStatus: 'Activ', propertyAddress: 'Strada Teiului 10', ownerName: 'Ștefan', ownerPhone: '0700000002' };
it('prepares distinct client and owner drafts in Bucharest time without sending', () => {
  for (const recipient of ['client', 'owner'] as const) {
    const result = confirmationDraft(row, recipient, now);
    expect(result).toMatchObject({ status: 'prepared', complete: true, sent: false });
    expect(result.rows[0]).toMatchObject({ recipientPhone: recipient === 'client' ? row.contactPhone : row.ownerPhone, recipientName: recipient === 'client' ? row.contactName : row.ownerName });
    expect(result.rows[0].description).toContain('17:00, ora Bucureștiului');
    expect(result.rows[0].description).toContain('Cișmigiu');
    expect(result.rows[0].description).toContain('Strada Teiului 10');
    if (recipient === 'owner') expect(result.rows[0].description).not.toContain('Alin');
  }
});
it.each([{ status: 'cancelled' }, { status: 'completed' }, { viewingDate: '2020-01-01T10:00:00Z' }, { viewingDate: 'invalid' }, { propertyStatus: 'Inactiv' }, { propertyId: null }, { contactId: null }])('does not prepare misleading confirmations for %j', patch => {
  expect(confirmationDraft({ ...row, ...patch }, 'client', now)).toMatchObject({ complete: false, rows: [], sent: false });
});
it('does not borrow the buyer identity when owner data is missing', () => {
  expect(confirmationDraft({ ...row, ownerName: null, ownerPhone: null }, 'owner', now)).toMatchObject({ status: 'missing_recipient', rows: [] });
  const result = confirmationDraft({ ...row, ownerPhone: null, propertyAddress: null }, 'owner', now);
  expect(result.rows[0]).toMatchObject({ recipientPhone: null, missingFields: ['recipientPhone', 'propertyAddress'] });
  expect(result.rows[0].description).not.toContain('Adresă/zonă:');
});
