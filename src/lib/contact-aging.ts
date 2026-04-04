import type { Contact } from '@/lib/types';

export type ContactFreshnessTone = 'green' | 'orange' | 'red' | 'archived';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function isArchivedContact(contact: Pick<Contact, 'archivedAt'>) {
  return Boolean(contact.archivedAt);
}

export function getContactAgeInDays(createdAt?: string | null, now = new Date()) {
  if (!createdAt) return null;
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return null;

  const diff = now.getTime() - createdDate.getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

export function getContactFreshnessTone(contact: Pick<Contact, 'createdAt' | 'archivedAt'>, now = new Date()): ContactFreshnessTone {
  if (isArchivedContact(contact)) return 'archived';

  const ageInDays = getContactAgeInDays(contact.createdAt, now);
  if (ageInDays === null) return 'green';
  if (ageInDays <= 14) return 'green';
  if (ageInDays <= 30) return 'orange';
  if (ageInDays <= 40) return 'red';
  return 'archived';
}

export function shouldAutoArchiveContact(contact: Pick<Contact, 'createdAt' | 'archivedAt'>, now = new Date()) {
  return !isArchivedContact(contact) && getContactAgeInDays(contact.createdAt, now) !== null && getContactAgeInDays(contact.createdAt, now)! > 40;
}
