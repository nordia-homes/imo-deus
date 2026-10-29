import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ get: vi.fn(), find: vi.fn(), set: vi.fn(), update: vi.fn(), commit: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ adminDb: {
  collection: () => ({ doc: () => ({ get: mock.get, collection: () => ({
    doc: () => ({ id: 'new-id' }), where: () => ({ limit: () => ({ get: mock.find }) }),
  }) }) }), batch: () => ({ set: mock.set, update: mock.update, commit: mock.commit }),
} }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (value: unknown) => value } }));
import { submitPublicContact } from './public-contact';
const input = () => ({ agencyId: 'agency', name: 'Test Client', phone: '0720000000', email: 'TEST@example.com', city: ' București ', message: 'Apartament în București', consent: true, website: '', formStartedAt: Date.now() - 10000 });
beforeEach(() => { vi.clearAllMocks(); mock.get.mockResolvedValue({ exists: true, data: () => ({ ownerId: 'owner' }) }); mock.find.mockResolvedValue({ empty: true }); mock.commit.mockResolvedValue(undefined); });
describe('public contact lead capture', () => {
  it('saves an owner sale lead and city without requiring an existing property', async () => {
    expect((await submitPublicContact(input())).success).toBe(true);
    expect(mock.set).toHaveBeenCalledTimes(2);
    expect(mock.set.mock.calls[0][1]).toMatchObject({ email: 'test@example.com', source: 'Website', contactType: 'Client', leadIntent: 'Vânzare', propertyCity: 'București' });
    expect(mock.set.mock.calls[0][1].description).toContain('Orașul proprietății: București');
    expect(mock.set.mock.calls[1][1].description).toContain('vânzare în București');
    expect(mock.set.mock.calls[1][1]).toMatchObject({ agentId: 'owner', contactId: 'new-id', status: 'open' });
    expect(mock.commit).toHaveBeenCalledOnce();
  });
  it('adds an interaction for an existing contact without overwriting it', async () => {
    mock.find.mockResolvedValue({ empty: false, docs: [{ ref: { id: 'existing' } }] });
    await submitPublicContact(input());
    expect(mock.update).toHaveBeenCalledOnce(); expect(mock.set).toHaveBeenCalledTimes(1);
    expect(mock.update.mock.calls[0][1].interactionHistory.notes).toContain('Orașul proprietății: București');
    expect(mock.set.mock.calls[0][1].contactId).toBe('existing');
  });
  it('rejects invalid or automated submissions without writes', async () => {
    for (const change of [{ city: '' }, { city: '  ' }, { city: undefined }, { consent: false }, { phone: 'abc' }, { website: 'spam' }, { formStartedAt: Date.now() }, { agencyId: 'a/b' }]) expect((await submitPublicContact({ ...input(), ...change })).success).toBe(false);
    expect(mock.set).not.toHaveBeenCalled();
  });
  it('does not show success when persistence fails or agency is absent', async () => {
    mock.commit.mockRejectedValueOnce(new Error('offline'));
    expect((await submitPublicContact(input())).success).toBe(false);
    mock.get.mockResolvedValueOnce({ exists: false });
    expect((await submitPublicContact(input())).success).toBe(false);
  });
});
