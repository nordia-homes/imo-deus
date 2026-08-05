import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/pdf-text', () => ({
  extractTextFromPdfBuffer: vi.fn(async () => 'CERTIFICAT DE PERFORMANTA ENERGETICA. Valabilitate expiră la 14.09.2031. Clasa energetica A.'),
}));
vi.mock('@/lib/google-vision', () => ({
  extractDocumentTextWithGoogleVision: vi.fn(async () => ({ fullText: 'CARTE DE IDENTITATE COD NUMERIC PERSONAL' })),
}));

let processor: typeof import('@/lib/sales-document-processing');

beforeAll(async () => {
  processor = await import('@/lib/sales-document-processing');
});

beforeEach(() => {
  delete process.env.SALES_DOCUMENT_SCAN_URL;
  delete process.env.SALES_DOCUMENT_SCAN_TOKEN;
  delete process.env.SALES_DOCUMENT_OCR_ENABLED;
});

describe('sales document processing', () => {
  it('rejects executable attachments before storage', async () => {
    const result = await processor.processSalesDocument({ bytes: Buffer.from('MZ malicious'), fileName: 'document.exe' });
    expect(result).toMatchObject({ allowed: false, scanStatus: 'unsupported', qualityScore: 0 });
  });

  it('does not claim antivirus protection when no external scanner exists', async () => {
    const result = await processor.processSalesDocument({ bytes: Buffer.from('%PDF-1.7 test'), fileName: 'certificat.pdf', contentType: 'application/pdf' });
    expect(result).toMatchObject({ allowed: true, scanStatus: 'safe_by_policy', scanProvider: 'local-policy' });
  });

  it('blocks acceptance when agency policy requires an unavailable scanner', async () => {
    const result = await processor.processSalesDocument({ bytes: Buffer.from('%PDF-1.7 test'), fileName: 'certificat.pdf', contentType: 'application/pdf', requireMalwareScanner: true });
    expect(result).toMatchObject({ allowed: false, scanStatus: 'error' });
  });

  it('classifies OCR content and extracts a probable expiry date', async () => {
    const result = await processor.processSalesDocument({ bytes: Buffer.from('%PDF-1.7 test'), fileName: 'scan.pdf', contentType: 'application/pdf', forceOcr: true });
    expect(result).toMatchObject({ allowed: true, ocrStatus: 'completed', classification: 'Certificat energetic', expiresAt: '2031-09-14T23:59:59.000Z' });
    expect(result.qualityScore).toBeGreaterThanOrEqual(50);
    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
