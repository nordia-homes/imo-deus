import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { startAuthorization } from '../meta';

afterEach(() => vi.unstubAllEnvs());

describe('Facebook comment authorization', () => {
  it('requests both reading visitor comments and managing replies', async () => {
    vi.stubEnv('META_APP_ID', 'test-app');
    vi.stubEnv('META_APP_SECRET', 'test-secret');
    const db = { collection: () => ({ doc: () => ({ create: async () => undefined }) }) } as unknown as Firestore;
    const result = await startAuthorization(db, { uid: 'admin', agencyId: 'nordia' }, { features: ['comments'] });
    const scopes = new URL(result.authorizationUrl).searchParams.get('scope')?.split(',') || [];
    expect(scopes).toContain('pages_read_user_content');
    expect(scopes).toContain('pages_manage_engagement');
    expect(scopes).toContain('instagram_manage_comments');
  });
});
