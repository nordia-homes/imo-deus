import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { boundedUploadRequest, validateUploadBytes } from '../upload-validation';

describe('Private assistant upload ingress', () => {
  it('rejects spoofed types and accepts actual file signatures', () => {
    expect(() => validateUploadBytes(Buffer.from('<script>alert(1)</script>'), 'application/pdf')).toThrow();
    expect(() => validateUploadBytes(Buffer.from('%PDF-1.7\n'), 'application/pdf')).not.toThrow();
    expect(() => validateUploadBytes(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png')).not.toThrow();
    expect(() => validateUploadBytes(Buffer.from('PK\x03\x04unrelated zip'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toThrow();
    expect(() => validateUploadBytes(Buffer.from('name,price\nApartament,100000'), 'text/csv')).not.toThrow();
    expect(() => validateUploadBytes(Buffer.from('<!DOCTYPE html>'), 'text/csv')).toThrow();
  });
  it('enforces the byte limit even without a content-length header', async () => {
    const request = new Request('https://crm.test/upload', { method: 'POST', body: 'abcdef' });
    await expect(boundedUploadRequest(request, 5)).rejects.toThrow('Limita');
    const valid = await boundedUploadRequest(new Request('https://crm.test/upload', { method: 'POST', body: 'abc' }), 5);
    expect(await valid.text()).toBe('abc');
  });
});
