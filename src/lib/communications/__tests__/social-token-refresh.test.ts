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
import { diagnoseSocialPost, postInteraction } from '../social';

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
describe('social post access diagnosis', () => {
  it('distinguishes a listed Facebook post from a direct object access failure without exposing the token', async () => {
    vi.stubEnv('META_APP_ID', 'app-1');
    vi.stubEnv('META_APP_SECRET', 'app-secret');
    const connection = { id: 'facebook', channel: 'messenger', externalId: 'page' };
    mocks.connectionToken.mockResolvedValue({ connection, token: 'private-page-token' });
    mocks.graph.mockImplementation(async (path: string) => {
      if (path.startsWith('/debug_token')) return { data: { app_id: 'app-1', is_valid: true, type: 'PAGE', scopes: ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'] } };
      if (path === '/me?fields=id') return { id: 'page' };
      if (path.startsWith('/page/posts')) return { data: [{ id: 'page_post' }] };
      throw new CommunicationError('Unsupported get request.', 502);
    });

    const result = await diagnoseSocialPost(postDb('facebook', 'page_post'), actor, 'post', 'facebook');

    expect(result.postInAccountList).toBe(true);
    expect(result.directPostReadable).toBe(false);
    expect(result.missingScopes).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('private-page-token');
    vi.unstubAllEnvs();
  });
});
describe('Instagram post access diagnosis', () => {
  it('checks the linked media list using the Page token', async () => {
    const connection = { id: 'instagram', channel: 'instagram', externalId: 'ig-account', parentId: 'page' };
    mocks.connectionToken.mockResolvedValue({ connection, token: 'private-page-token' });
    mocks.graph.mockImplementation(async (path: string) => {
      if (path === '/me?fields=id') return { id: 'page' };
      if (path.startsWith('/ig-account/media?')) return { data: [{ id: 'ig-media' }] };
      if (path === '/ig-media?fields=id') return { id: 'ig-media' };
      return { data: { is_valid: true, type: 'PAGE', scopes: ['pages_read_engagement', 'instagram_basic', 'instagram_manage_comments'] } };
    });

    const result = await diagnoseSocialPost(postDb('instagram', 'ig-media'), actor, 'post', 'instagram');

    expect(result.channel).toBe('Instagram');
    expect(result.postInAccountList).toBe(true);
    expect(result.directPostReadable).toBe(true);
    expect(mocks.graph).toHaveBeenCalledWith('/ig-account/media?fields=id&limit=100', 'private-page-token');
  });
});
