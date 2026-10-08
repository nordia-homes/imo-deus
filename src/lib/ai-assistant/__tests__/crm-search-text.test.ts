import { expect, it } from 'vitest';
import { matchesCrmSearch } from '@/lib/crm/search-text';

it.each(['Cismigiu', 'CIȘMIGIU', 'Cişmigiu', 'Cișmigiu — apartament', 'apartament cismigiu', 'Ci\u200bșmigiu'])('finds a CRM title for %s', query => {
  expect(matchesCrmSearch({ title: 'Apartament – Cișmigiu', address: 'București' }, query)).toBe(true);
});
it.each(['Matei Alin', 'Alin Matei', 'MATEI-ALIN', 'Matei Alin'])('finds a buyer for %s', query => {
  expect(matchesCrmSearch({ name: 'Matei-Alin' }, query)).toBe(true);
});
it.each(['0123123123', '0123 123 123', '(0123)-123-123'])('finds the same formatted phone for %s', query => {
  expect(matchesCrmSearch({ phone: '0123 123 123' }, query)).toBe(true);
});
it('does not match JSON keys, punctuation-only queries, or digits assembled across records', () => {
  expect(matchesCrmSearch({ name: 'Alin' }, 'name')).toBe(false);
  expect(matchesCrmSearch({ title: 'Cișmigiu' }, '—')).toBe(false);
  expect(matchesCrmSearch({ phone: '0123', alternate: '123123' }, '0123123123')).toBe(false);
  expect(matchesCrmSearch({ name: 'Matei Andrei' }, 'Matei Alin')).toBe(false);
});
it.each(['0123123123', '+40 123 123 123', '0040 123 123 123'])('recognizes the same Romanian contact number in national/international form: %s', query => {
  expect(matchesCrmSearch({ phone: '+40 123 123 123' }, query)).toBe(true);
  expect(matchesCrmSearch({ phone: '0123123123' }, query)).toBe(true);
});
