import { describe, expect, it, vi } from 'vitest';
import { resolveViewingContact, type ViewingContactAttempt } from './viewing-contact';

const action = { kind: 'create_contact' as const, name: 'Client', phone: '0700000000', email: 'client@example.com', contactType: 'Cumparator' as const };

describe('contact creation while scheduling a viewing', () => {
  it('reuses the saved client after the calendar rejects a viewing', async () => {
    const attempt: ViewingContactAttempt = {};
    const execute = vi.fn().mockResolvedValue({ contactId: 'saved-client' });
    await resolveViewingContact(action, attempt, execute);
    expect(await resolveViewingContact(action, attempt, execute)).toEqual({ id: 'saved-client', name: 'Client' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('replays the same request after the server response is lost', async () => {
    const attempt: ViewingContactAttempt = {};
    const execute = vi.fn().mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ contactId: 'saved-client' });
    await expect(resolveViewingContact(action, attempt, execute)).rejects.toThrow('Network error');
    await resolveViewingContact(action, attempt, execute);
    expect(execute.mock.calls[0][1]).toBe(execute.mock.calls[1][1]);
  });

  it('keeps the saved client when the user changes the selected property', async () => {
    const attempt: ViewingContactAttempt = {};
    const execute = vi.fn().mockResolvedValue({ contactId: 'saved-client' });
    await resolveViewingContact({ ...action, sourcePropertyId: 'first', budget: 100000 }, attempt, execute);
    expect((await resolveViewingContact({ ...action, sourcePropertyId: 'second', budget: 120000 }, attempt, execute)).id).toBe('saved-client');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves the actual duplicate-contact error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('Contactul există deja. Folosește contactul existent sau dezarhivează-l.'));
    await expect(resolveViewingContact(action, {}, execute)).rejects.toThrow('Contactul există deja');
  });

  it('uses a new request when the user corrects the contact details', async () => {
    const attempt: ViewingContactAttempt = {};
    const execute = vi.fn().mockRejectedValueOnce(new Error('Contactul există deja')).mockResolvedValueOnce({ contactId: 'corrected' });
    await expect(resolveViewingContact(action, attempt, execute)).rejects.toThrow();
    await resolveViewingContact({ ...action, email: 'corrected@example.com' }, attempt, execute);
    expect(execute.mock.calls[0][1]).not.toBe(execute.mock.calls[1][1]);
  });

  it('never schedules against an undefined contact ID', async () => {
    const attempt: ViewingContactAttempt = {};
    await expect(resolveViewingContact(action, attempt, vi.fn().mockResolvedValue({}))).rejects.toThrow('nu a fost confirmată');
    expect(attempt.contact).toBeUndefined();
  });
});
