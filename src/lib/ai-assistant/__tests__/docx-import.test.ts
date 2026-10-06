import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { importContractDocx } from '@/lib/crm/docx-import';

async function document(body: string, extras: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`);
  for (const [path, content] of Object.entries(extras)) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('shared Word contract conversion', () => {
  it('preserves real DOCX emphasis and table structure instead of flattening to text', async () => {
    const bytes = await document('<w:p><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Contract {{buyer.name}}</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Preț</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>130000 EUR</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
    const result = await importContractDocx(bytes);
    expect(result.content).toContain('<strong>'); expect(result.content).toContain('<em>');
    expect(result.content).toContain('<table>'); expect(result.content).toContain('<td>');
    expect(result.content).toContain('{{buyer.name}}'); expect(result.content).toContain('130000 EUR');
  });
  it('removes executable hyperlinks while retaining their visible document text', async () => {
    const bytes = await document('<w:p><w:hyperlink r:id="link"><w:r><w:t>Detalii contract</w:t></w:r></w:hyperlink></w:p>', { 'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>' });
    const result = await importContractDocx(bytes);
    expect(result.content).toBe('<p>Detalii contract</p>');
    expect(result.content).not.toMatch(/href|javascript|<a[ >]/);
  });
  it('rejects empty documents and bounds decompression before Mammoth conversion', async () => {
    await expect(importContractDocx(await document('<w:p/>'))).rejects.toMatchObject({ status: 415 });
    const bytes = await document('<w:p><w:r><w:t>Contract</w:t></w:r></w:p>', { 'word/media/bomb.bin': 'a'.repeat(33 * 1024 * 1024) });
    expect(bytes.length).toBeLessThan(15 * 1024 * 1024);
    await expect(importContractDocx(bytes)).rejects.toMatchObject({ status: 413 });
  });
});
