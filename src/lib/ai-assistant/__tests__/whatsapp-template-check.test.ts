import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ getResource: vi.fn() }));
vi.mock('../whatsapp-recipient-check', () => ({ checkWhatsAppRecipient: vi.fn() }));
vi.mock('../operations', () => ({ invokeOperation: vi.fn() }));
import { getResource } from '../access';
import { checkWhatsAppRecipient } from '../whatsapp-recipient-check';
import { invokeOperation } from '../operations';
import { checkWhatsAppTemplates } from '../whatsapp-template-check';
const ctx = { uid: 'u', agencyId: 'a', role: 'agent' } as any;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkWhatsAppRecipient).mockResolvedValue({ blocked: false, rows: [{ consent: { all: 'unknown', marketing: 'granted', service: 'unknown' } }] } as any);
  vi.mocked(getResource).mockResolvedValue({ connectionId: 'actual-connection' });
  vi.mocked(invokeOperation).mockResolvedValue({ data: [] });
});
it('binds the connection to the accessible conversation and distinguishes approval from component support', async () => {
  vi.mocked(invokeOperation).mockResolvedValue({ data: [
    { name: 'approved', language: 'ro', category: 'MARKETING', status: 'APPROVED', bodyParameterCount: 1, sendable: true },
    { name: 'pending', language: 'ro', category: 'MARKETING', status: 'PENDING', bodyParameterCount: 0, sendable: true },
    { name: 'media', language: 'ro', category: 'UTILITY', status: 'APPROVED', bodyParameterCount: null, sendable: false },
  ] });
  const result = await checkWhatsAppTemplates(ctx, 'selected');
  expect(result).toMatchObject({ status: 'checked', availableCount: 1, sendAuthorized: false });
  expect(result.rows.map((row: { approvedAndSupported: boolean }) => row.approvedAndSupported)).toEqual([true, false, false]);
  expect(invokeOperation).toHaveBeenCalledWith(ctx, { operation: 'whatsapp_templates', params: { connectionId: 'actual-connection' }, query: {}, body: {} });
});
it.each(['unknown', 'revoked'])('does not fetch templates from a claimed but unrecorded/withdrawn agreement: %s', state => {
  vi.mocked(checkWhatsAppRecipient).mockResolvedValue({ blocked: state === 'revoked', rows: [{ consent: { all: state, marketing: 'unknown', service: 'unknown' } }] } as any);
  return checkWhatsAppTemplates(ctx, 'selected').then(result => {
    expect(result).toMatchObject({ rows: [], sendAuthorized: false, status: state === 'revoked' ? 'blocked' : 'consent_missing' });
    expect(invokeOperation).not.toHaveBeenCalled();
  });
});
it('preserves missing response and provider failures instead of reporting an empty catalog', async () => {
  vi.mocked(invokeOperation).mockResolvedValueOnce({});
  await expect(checkWhatsAppTemplates(ctx, 'selected')).rejects.toThrow('nu a fost confirmată');
  vi.mocked(invokeOperation).mockRejectedValueOnce(new Error('Conexiunea nu mai este activă'));
  await expect(checkWhatsAppTemplates(ctx, 'selected')).rejects.toThrow('Conexiunea');
});
it('checks recipient access before calling the provider', async () => {
  vi.mocked(checkWhatsAppRecipient).mockRejectedValueOnce(new Error('Acces revocat'));
  await expect(checkWhatsAppTemplates(ctx, 'private')).rejects.toThrow('Acces revocat');
  expect(invokeOperation).not.toHaveBeenCalled();
});
