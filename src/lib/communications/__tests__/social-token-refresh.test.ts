import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { CommunicationError } from '../server';

const mocks = vi.hoisted(() => ({
  graph: vi.fn(),
  refreshPageToken: vi.fn(),
  connectionToken: vi.fn(),
}));
vi.mock('../meta', () => ({
  graph: mocks.graph,
  refreshPageToken: mocks.refreshPageToken,
  connectionToken: mocks.connectionToken,
}));
import { postInteraction } from '../social';

const actor = { uid: 'admin', agencyId: 'nordia', role: 'admin' };
function postDb(connectionId: string, externalId: string) {
  const get = vi.fn(async () => ({ data: () => ({
    destinations: { [connectionId]: { status: 'published', externalId } },
  }) }));
  return { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get }) }) }) }) } as unknown as Firestore;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('social comments token recovery', () => {
  it('retries Facebook comment reads with a fresh Page token', async () => {
    const connection = { id: 'facebook', channel: 'messenger', externalId: 'page' };
    mocks.connectionToken.mockResolvedValue({ connection, token: 'old-page-token' });
    mocks.refreshPageToken.mockResolvedValue('new-page-token');
    mocks.graph.mockRejectedValueOnce(new CommunicationError('Unsupported get request. Object does not exist.', 502));
    mocks.graph.mockResolvedValueOnce({ data: [{ id: 'comment-1' }] });

    const result = await postInteraction(postDb('facebook', 'page_post'), actor, 'post', 'facebook', 'comments');

    expect(result).toEqual({ data: [{ id: 'comment-1' }] });
    expect(mocks.refreshPageToken).toHaveBeenCalledWith(expect.anything(), actor, connection);
    expect(mocks.graph.mock.calls.map(call => call[1])).toEqual(['old-page-token', 'new-page-token']);
  });

  it('reports an Instagram object failure without blaming Facebook permissions', async () => {
    const connection = { id: 'instagram', channel: 'instagram', externalId: 'ig', parentId: 'page' };
    mocks.connectionToken.mockResolvedValue({ connection, token: 'old-page-token' });
    mocks.refreshPageToken.mockResolvedValue('new-page-token');
    mocks.graph.mockRejectedValueOnce(new CommunicationError('Unsupported get request. Object does not exist.', 502));
    mocks.graph.mockRejectedValueOnce(new CommunicationError('Unsupported get request. Object does not exist.', 502));

    await expect(postInteraction(postDb('instagram', 'ig-media'), actor, 'post', 'instagram', 'comments'))
      .rejects.toThrow('Meta nu poate citi postarea Instagram nici după reîmprospătarea tokenului paginii.');
  });
});
