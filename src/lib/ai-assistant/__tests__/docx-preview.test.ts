import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: vi.fn(), convert: vi.fn(), download: vi.fn(), upload: {} as any }));
vi.mock('../access', () => ({ assistantContext: mocks.context, collectionFor: () => ({ doc: () => ({ get: async () => ({ data: () => mocks.upload }) }) }) }));
vi.mock('@/lib/crm/docx-import', () => ({ importContractDocx: mocks.convert }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ file: () => ({ download: mocks.download }) }) }) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { GET } from '@/app/api/ai-assistant/uploads/[uploadId]/docx-preview/route';
const uploadId = '524a76ae-caa2-4f6e-aebc-7d0c1dcaf2d0';
const call = () => GET(new Request('https://crm.test/preview'), { params: Promise.resolve({ uploadId }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ uid: 'u', agencyId: 'a', role: 'admin', adminAuth: { app: {} } });
  mocks.upload = { ownerId: 'u', storagePath: `agencies/a/privateCommunications/assistant-uploads/u/${uploadId}`, expiresAt: Date.now() + 60000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  mocks.download.mockResolvedValue([Buffer.from('private docx')]); mocks.convert.mockResolvedValue({ content: '<p>Contract</p>', warnings: [], note: 'Verifică editorul.' });
});
it('previews only the authorized private document without applying a template', async () => {
  const response = await call();
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ content: '<p>Contract</p>' });
  expect(mocks.convert).toHaveBeenCalledWith(Buffer.from('private docx'));
});
it('rejects unauthorized roles, foreign uploads, substituted paths and expiry before reading bytes', async () => {
  mocks.context.mockResolvedValueOnce({ uid: 'u', agencyId: 'a', role: 'agent' }); expect((await call()).status).toBe(403);
  mocks.upload.ownerId = 'other'; expect((await call()).status).toBe(404);
  mocks.upload.ownerId = 'u'; mocks.upload.storagePath = 'agencies/b/privateCommunications/other'; expect((await call()).status).toBe(404);
  mocks.upload.storagePath = `agencies/a/privateCommunications/assistant-uploads/u/${uploadId}`; mocks.upload.expiresAt = Date.now() - 1; expect((await call()).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.convert).not.toHaveBeenCalled();
});
