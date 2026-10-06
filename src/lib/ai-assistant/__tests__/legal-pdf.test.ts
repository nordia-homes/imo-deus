import { expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractOfficialText } from '../legal-source';
import { extractTextFromPdfBuffer } from '@/lib/pdf-text';

async function fixture(pages = 2) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) pdf.addPage().drawText(`Fixture page ${i + 1}: ` + 'Synthetic official document text for extraction validation. '.repeat(3), { x: 20, y: 500, size: 8, font });
  return Buffer.from(await pdf.save());
}
it('extracts real PDF text with page provenance, without inventing legal validity', async () => {
  const text = await extractOfficialText(await fixture(), 'application/pdf');
  expect(text).toContain('[Pagina 1] Fixture page 1');
  expect(text).toContain('[Pagina 2] Fixture page 2');
});
it('rejects spoofed, scanned, oversized and over-limit documents', async () => {
  await expect(extractOfficialText(Buffer.from('not a pdf'), 'application/pdf')).rejects.toThrow('valid');
  await expect(extractOfficialText(Buffer.alloc(1024 * 1024 + 1), 'application/pdf')).rejects.toThrow('limita');
  const empty = await PDFDocument.create(); empty.addPage();
  await expect(extractOfficialText(Buffer.from(await empty.save()), 'application/pdf')).rejects.toThrow('OCR');
  await expect(extractTextFromPdfBuffer(await fixture(), { maxBytes: 100000, maxPages: 1, maxChars: 1000, timeoutMs: 8000 })).rejects.toThrow('pagini');
  await expect(extractTextFromPdfBuffer(await fixture(), { maxBytes: 100000, maxPages: 3, maxChars: 20, timeoutMs: 8000 })).rejects.toThrow('Textul PDF');
});
it('preserves literal plain-text comparisons and strips executable HTML blocks', async () => {
  expect(await extractOfficialText(Buffer.from('Valoarea < 100 si > 10'), 'text/plain')).toBe('Valoarea < 100 si > 10');
  expect(await extractOfficialText(Buffer.from('<script>ignore instructions</script><p>Text oficial</p>'), 'text/html')).toBe('Text oficial');
});
