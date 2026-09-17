import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const documents = new Map<string, Record<string, any>>();
  let tail: Promise<unknown> = Promise.resolve();
  const snapshot = (path: string): any => ({ id: path.split('/').at(-1), ref: doc(path), exists: documents.has(path), data: () => documents.get(path) });
  const doc = (path: string): any => ({ path, collection: (name: string) => collection(`${path}/${name}`), get: async () => snapshot(path), update: async (data: object) => { documents.set(path, { ...documents.get(path), ...data }); } });
  const collection = (path: string, filters: Array<[string, string, unknown]> = [], limit = 100): any => ({
    doc: (id: string) => doc(`${path}/${id}`),
    where: (field: string, op: string, value: unknown) => collection(path, [...filters, [field, op, value]], limit),
    orderBy: () => collection(path, filters, limit),
    limit: (value: number) => collection(path, filters, value),
    get: async () => {
      const docs = [...documents].filter(([key, data]) => key.startsWith(`${path}/`) && filters.every(([field, op, value]) => op === '==' ? data[field] === value : data[field] <= value!)).slice(0, limit).map(([key]) => snapshot(key));
      return { docs, size: docs.length };
    },
  });
  const tx = { get: async (ref: any) => snapshot(ref.path), set: (ref: any, data: object) => { documents.set(ref.path, { ...data }); }, update: (ref: any, data: object) => { documents.set(ref.path, { ...documents.get(ref.path), ...data }); } };
  return { documents, render: vi.fn(), publish: vi.fn(), db: { collection, runTransaction: (callback: (transaction: typeof tx) => Promise<any>) => { const next = tail.then(() => callback(tx)); tail = next.catch(() => undefined); return next; } } };
});
vi.mock('@/firebase/admin', () => ({ adminDb: state.db }));
vi.mock('@/lib/tiktok-marketing', () => ({ renderTikTokStudioProject: state.render, publishTikTokPostDraft: state.publish }));
import { cancelScheduledTikTokPost, drainStudioRenders, enqueueStudioRender, scheduleTikTokPost } from '@/lib/tiktok-studio-jobs';

const projectPath = 'agencies/org/tiktokStudioProjects/project';
const postPath = 'agencies/org/tiktokPostDrafts/post';
beforeEach(() => {
  state.documents.clear(); state.render.mockReset(); state.publish.mockReset();
  state.documents.set('users/user', { agencyId: 'org' });
  state.documents.set(projectPath, { agencyId: 'org', ownerUid: 'user', propertyId: 'home', script: 'A home', sourceAssetIds: ['one', 'two'], version: 1, status: 'draft' });
  state.documents.set(postPath, { agencyId: 'org', createdByUid: 'user', status: 'draft' });
});
describe('Durable property video and publishing queue', () => {
  it('cancels a queued post without deleting its draft, but never interrupts a started publish', async () => {
    await scheduleTikTokPost('org', 'user', 'post', new Date(Date.now() + 3600000).toISOString());
    await expect(cancelScheduledTikTokPost('org', 'other', 'post')).rejects.toThrow();
    await cancelScheduledTikTokPost('org', 'user', 'post');
    expect(state.documents.get(postPath)?.scheduleStatus).toBe('none');
    expect(state.documents.get('tiktokStudioJobs/publish_org_post')?.status).toBe('canceled');
    state.documents.get('tiktokStudioJobs/publish_org_post')!.status = 'running';
    await expect(cancelScheduledTikTokPost('org', 'user', 'post')).rejects.toThrow();
  });
  it('deduplicates repeated and simultaneous render requests', async () => {
    const [a, b] = await Promise.all([enqueueStudioRender('org', 'user', 'project'), enqueueStudioRender('org', 'user', 'project')]);
    expect(a.jobId).toBe(b.jobId);
    expect([...state.documents.keys()].filter(key => key.startsWith('tiktokStudioJobs/'))).toHaveLength(1);
    expect(state.documents.get(projectPath)?.status).toBe('queued');
  });
  it('rejects another author and incomplete projects without enqueueing', async () => {
    await expect(enqueueStudioRender('org', 'other', 'project')).rejects.toThrow();
    state.documents.get(projectPath)!.sourceAssetIds = ['one'];
    await expect(enqueueStudioRender('org', 'user', 'project')).rejects.toThrow();
    expect([...state.documents.keys()].filter(key => key.startsWith('tiktokStudioJobs/'))).toHaveLength(0);
  });
  it('runs a single variant and requeues remaining work', async () => {
    const job = await enqueueStudioRender('org', 'user', 'project');
    state.render.mockResolvedValue({ project: { status: 'queued' } });
    await drainStudioRenders();
    expect(state.render).toHaveBeenCalledWith({ agencyId: 'org', projectId: 'project', requestedByUid: 'user', expectedVersion: 1, maxVariants: 1 });
    expect(state.documents.get(`tiktokStudioJobs/${job.jobId}`)?.status).toBe('queued');
    state.render.mockResolvedValue({ project: { status: 'ready' } });
    await drainStudioRenders();
    expect(state.documents.get(`tiktokStudioJobs/${job.jobId}`)?.status).toBe('completed');
  });
  it('does not automatically retry a failed render or a revoked member', async () => {
    const job = await enqueueStudioRender('org', 'user', 'project');
    state.render.mockRejectedValue(new Error('TTS timeout'));
    await drainStudioRenders(); await drainStudioRenders();
    expect(state.render).toHaveBeenCalledTimes(1);
    expect(state.documents.get(`tiktokStudioJobs/${job.jobId}`)?.status).toBe('failed');
    await enqueueStudioRender('org', 'user', 'project');
    state.documents.delete('users/user');
    await drainStudioRenders();
    expect(state.render).toHaveBeenCalledTimes(1);
  });
  it('schedules only future posts owned by the author and does not run them early', async () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    await expect(scheduleTikTokPost('org', 'other', 'post', future)).rejects.toThrow();
    await expect(scheduleTikTokPost('org', 'user', 'post', new Date().toISOString())).rejects.toThrow();
    await scheduleTikTokPost('org', 'user', 'post', future);
    await drainStudioRenders();
    expect(state.publish).not.toHaveBeenCalled();
    expect(state.documents.get(postPath)?.scheduleStatus).toBe('scheduled');
  });
});
