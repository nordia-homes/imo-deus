import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TikTokOperationRequest, TikTokOperationResult } from '../types';

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  let transactionTail: Promise<unknown> = Promise.resolve();
  const snapshot = (path: string) => ({
    exists: documents.has(path),
    id: path.split('/').at(-1) || '',
    data: () => documents.get(path),
  });
  const document = (path: string): any => ({
    path,
    get: async () => snapshot(path),
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      documents.set(path, options?.merge ? { ...(documents.get(path) || {}), ...data } : { ...data });
    },
    delete: async () => { documents.delete(path); },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string): any => ({ doc: (id: string) => document(`${path}/${id}`) });
  const transaction = {
    get: async (ref: any) => snapshot(ref.path),
    set: (ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
      documents.set(ref.path, options?.merge ? { ...(documents.get(ref.path) || {}), ...data } : { ...data });
    },
    create: (ref: any, data: Record<string, unknown>) => {
      if (documents.has(ref.path)) throw new Error('already exists');
      documents.set(ref.path, { ...data });
    },
    update: (ref: any, data: Record<string, unknown>) => {
      if (!documents.has(ref.path)) throw new Error('missing');
      documents.set(ref.path, { ...documents.get(ref.path), ...data });
    },
    delete: (ref: any) => { documents.delete(ref.path); },
  };
  return {
    documents,
    db: {
      collection,
      runTransaction: <T>(callback: (value: typeof transaction) => Promise<T>) => {
        const task = transactionTail.then(() => callback(transaction));
        transactionTail = task.then(() => undefined, () => undefined);
        return task;
      },
    },
    reset() {
      documents.clear();
      transactionTail = Promise.resolve();
    },
  };
});

vi.mock('@/firebase/admin', () => ({ adminDb: firestore.db }));

import { acquireMutationLock, assertResourceOwnership, beginOperation, registerResource, updateOperation } from '../store';

function request(payload: Record<string, unknown> = {}): TikTokOperationRequest {
  return {
    organizationId: 'org-1',
    actor: { uid: 'user-1', role: 'admin', type: 'human' },
    capability: 'CAMPAIGN_UPDATE',
    advertiserId: 'adv-1',
    propertyId: 'property-1',
    payload,
    idempotencyKey: 'idem-1',
    correlationId: 'corr-1',
  };
}

beforeEach(() => {
  firestore.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TikTok operation ledger and mutation locks', () => {
  it('preserves property attribution when a subsequent sync has no property context', async () => {
    const resource = { organizationId: 'org-1', advertiserId: 'adv-1', resourceType: 'ad' as const, resourceId: 'ad-1', operationId: 'create' };
    await registerResource({ ...resource, propertyId: 'home-1' });
    await registerResource({ ...resource, operationId: 'sync', propertyId: null });
    const record = [...firestore.documents.values()].find(item => item.resourceId === 'ad-1');
    expect(record?.propertyId).toBe('home-1');
  });
  it('blocks an active duplicate, allows stale recovery, and rejects idempotency-key reuse', async () => {
    const first = await beginOperation(request({ campaign_id: 'campaign-1', name: 'A' }));
    await expect(beginOperation(request({ campaign_id: 'campaign-1', name: 'A' }))).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(beginOperation(request({ campaign_id: 'campaign-1', name: 'B' }))).rejects.toMatchObject({ code: 'CONFLICT' });

    await vi.advanceTimersByTimeAsync(6 * 60_000 + 1);
    const recovered = await beginOperation(request({ campaign_id: 'campaign-1', name: 'A' }));
    expect(recovered.record.operationId).toBe(first.record.operationId);
    expect(recovered.record.retryCount).toBe(1);
  });

  it('returns an already successful idempotent result without another mutation', async () => {
    const started = await beginOperation(request({ campaign_id: 'campaign-1' }));
    const result: TikTokOperationResult = {
      operationId: started.record.operationId,
      capability: 'CAMPAIGN_UPDATE',
      status: 'succeeded',
      createdResourceIds: [],
      correlationId: 'corr-1',
    };
    await updateOperation('org-1', started.record.operationId, { status: 'succeeded', result });
    await expect(beginOperation(request({ campaign_id: 'campaign-1' }))).resolves.toMatchObject({ cachedResult: result });
  });

  it('serializes different capabilities that mutate the same remote resource', async () => {
    const release = await acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'CAMPAIGN_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-1' });
    await expect(acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'BUDGET_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-2' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await release();
    const releaseNext = await acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'BUDGET_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-2' });
    await releaseNext();
  });

  it('does not let a stale owner delete a newer lock lease', async () => {
    const releaseOld = await acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'CAMPAIGN_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-old' });
    await vi.advanceTimersByTimeAsync(6 * 60_000 + 1);
    const releaseNew = await acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'CAMPAIGN_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-new' });
    await releaseOld();
    await expect(acquireMutationLock({ organizationId: 'org-1', advertiserId: 'adv-1', capability: 'BUDGET_UPDATE', resourceId: 'campaign:campaign-1', owner: 'owner-third' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await releaseNew();
  });

  it('keeps resource ownership separate for multiple advertisers in one tenant', async () => {
    const base = { organizationId: 'org-1', resourceType: 'identity' as const, resourceId: 'shared-identity', operationId: 'sync-1' };
    await registerResource({ ...base, advertiserId: 'adv-1' });
    await registerResource({ ...base, advertiserId: 'adv-2' });
    await expect(assertResourceOwnership('org-1', 'identity', 'shared-identity', 'adv-1')).resolves.toBeUndefined();
    await expect(assertResourceOwnership('org-1', 'identity', 'shared-identity', 'adv-2')).resolves.toBeUndefined();
    await expect(assertResourceOwnership('org-1', 'identity', 'shared-identity', 'adv-3')).rejects.toMatchObject({ code: 'RESOURCE_NOT_OWNED' });
  });
});
