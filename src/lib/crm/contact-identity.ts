import { createHash } from 'node:crypto';

export function normalizedContactFields(row: { phone?: string | null; email?: string | null }) {
  let phone = (row.phone || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (/^0\d{9}$/.test(phone)) phone = '40' + phone.slice(1);
  return { normalizedPhone: phone, normalizedEmail: (row.email || '').trim().toLowerCase() };
}

export function contactIdentityKeys(row: { phone?: string | null; email?: string | null }) {
  const normalized = normalizedContactFields(row);
  return Object.entries(normalized).filter(([, value]) => value).map(([field, value]) => ({ field, value, key: 'contact-identity-' + createHash('sha256').update(field + ':' + value).digest('hex') }));
}
