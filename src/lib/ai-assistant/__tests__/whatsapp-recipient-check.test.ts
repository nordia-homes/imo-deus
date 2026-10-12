import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
import { getResource } from '../access';
import { stableId } from '@/lib/communications/crypto';
import { checkWhatsAppRecipient } from '../whatsapp-recipient-check';
const records = new Map<string, unknown>();
const get = vi.fn(async (id: string) => ({ data: () => records.get(id) }));
const collection = vi.fn((): any => ({ doc: (id: string) => ({ collection, get: () => get(id) }) }));
const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: { collection } } as any;
beforeEach(() => {
  records.clear(); vi.clearAllMocks();
  vi.mocked(getResource).mockResolvedValue({ id: 'selected', channel: 'whatsapp', connectionId: 'c', externalParticipantId: '40722123456', lastInboundAt: new Date().toISOString() });
});
it('reports a global opt-out without exposing a phone or granting send permission', async () => {
  records.set(stableId('c', '40722123456', 'all'), { status: 'revoked' });
  const result = await checkWhatsAppRecipient(ctx, 'selected');
  expect(result).toMatchObject({ blocked: true, sendAuthorized: false, rows: [{ id: 'selected', status: 'blocked' }] });
  expect(JSON.stringify(result)).not.toContain('40722123456');
  expect(getResource).toHaveBeenCalledWith(ctx, 'conversations', 'selected');
});
it('does not treat unknown or malformed consent as permission', async () => {
  records.set(stableId('c', '40722123456', 'marketing'), { status: 'yes' });
  expect(await checkWhatsAppRecipient(ctx, 'selected')).toMatchObject({ blocked: false, sendAuthorized: false, rows: [{ status: 'needs_message_preview', consent: { all: 'unknown', marketing: 'unknown', service: 'unknown' } }] });
});
it('links the human recording flow and distinguishes agent and administrator roles', async () => {
  expect((await checkWhatsAppRecipient(ctx, 'selected')).rows[0].humanConsent).toMatchObject({ canRecord: false, requiredRole: 'admin', evidenceRequired: true, recordedByJarvis: false, url: '/inbox?conversationId=selected' });
  expect((await checkWhatsAppRecipient({ ...ctx, role: 'admin' }, 'selected')).rows[0].humanConsent.canRecord).toBe(true);
});
it('preserves category-specific withdrawal without claiming all message types eligible', async () => {
  records.set(stableId('c', '40722123456', 'marketing'), { status: 'revoked' });
  records.set(stableId('c', '40722123456', 'service'), { status: 'granted' });
  expect(await checkWhatsAppRecipient(ctx, 'selected')).toMatchObject({ sendAuthorized: false, rows: [{ status: 'needs_message_preview', consent: { marketing: 'revoked', service: 'granted' } }] });
});
it('checks conversation access before reading any consent', async () => {
  vi.mocked(getResource).mockRejectedValueOnce(new Error('Acces revocat'));
  await expect(checkWhatsAppRecipient(ctx, 'private')).rejects.toThrow('Acces revocat');
  expect(collection).not.toHaveBeenCalled();
});
