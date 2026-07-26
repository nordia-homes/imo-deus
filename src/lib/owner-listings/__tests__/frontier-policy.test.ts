import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase/admin', () => ({ adminDb: {} }));

import { OWNER_LISTING_FRONTIER_ACQUIRABLE_STATUSES } from '@/lib/owner-listings/frontier';

describe('owner-listing frontier recovery policy', () => {
  it('keeps stale running jobs eligible for lock recovery', () => {
    expect(OWNER_LISTING_FRONTIER_ACQUIRABLE_STATUSES).toContain('running');
  });
});
