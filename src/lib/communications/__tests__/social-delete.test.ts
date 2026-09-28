import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { CommunicationError } from '../server';

const mocks = vi.hoisted(() => ({ connectionToken: vi.fn(), graphDelete: vi.fn() }));
vi.mock('../meta', () => ({
  connectionToken: mocks.connectionToken,
  graphDelete: mocks.graphDelete,
}));
import { removePublishedSocialPost } from '../social';

const actor = { uid: 'admin', agencyId: 'nordia', role: 'admin' };
function fakeDb(channel: string, externalId: string) {
  let value: Record<string, any> = {
    destinations: { account: { channel, status: 'published', externalId } },
    status: 'published',
  };
  const ref = { get: vi.fn(async () => ({ data: () => value })) };
  const tx = {
    get: vi.fn(async () => ({ data: () => value })),
    update: vi.fn((_: unknown, patch: Record<string, unknown>) => { value = { ...value, ...patch }; }),
  };
  const db = {
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ref }) }) }),
    runTransaction: async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as Firestore;
  return { db, data: () => value, tx };
}
beforeEach(() => vi.resetAllMocks());

describe('published social post removal', () => {
  it('deletes an app-created Facebook Page post remotely before updating history', async () => {
    const state = fakeDb('messenger', '123_456');
    mocks.connectionToken.mockResolvedValue({ connection: { channel: 'messenger', externalId: '123' }, token: 'page-token' });
    mocks.graphDelete.mockResolvedValue(undefined);

    await removePublishedSocialPost(state.db, actor, 'post', 'account', true);

    expect(mocks.graphDelete).toHaveBeenCalledWith('/123_456', 'page-token');
    expect(state.data().destinations.account.status).toBe('deleted');
    expect(state.data().status).toBe('deleted');
  });

  it('keeps the published record when Meta refuses deletion', async () => {
    const state = fakeDb('messenger', '123_456');
    mocks.connectionToken.mockResolvedValue({ connection: { channel: 'messenger', externalId: '123' }, token: 'page-token' });
    mocks.graphDelete.mockRejectedValue(new CommunicationError('Meta error', 502));

    await expect(removePublishedSocialPost(state.db, actor, 'post', 'account', true)).rejects.toThrow('Meta error');

    expect(state.data().destinations.account.status).toBe('published');
    expect(state.tx.update).not.toHaveBeenCalled();
  });

  it('marks a manually deleted Instagram post locally without claiming a Meta deletion', async () => {
    const state = fakeDb('instagram', '987');

    await removePublishedSocialPost(state.db, actor, 'post', 'account', false);

    expect(mocks.graphDelete).not.toHaveBeenCalled();
    expect(state.data().destinations.account).toMatchObject({ status: 'deleted', removal: 'confirmed_external' });
  });

  it('refuses remote deletion for an Instagram destination', async () => {
    const state = fakeDb('instagram', '987');

    await expect(removePublishedSocialPost(state.db, actor, 'post', 'account', true)).rejects.toThrow('doar pentru postările Facebook');
    expect(mocks.graphDelete).not.toHaveBeenCalled();
  });
});
