import JSZip from 'jszip';
import mammoth from 'mammoth';
import { CommunicationError } from '@/lib/communications/server';
import { validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

// Only structural markup emitted by Mammoth reaches the contract editor.
// Links, images, styles and executable attributes are deliberately discarded.
export function contractImportHtml(html: string) {
  const tags = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote']);
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, token => {
    const match = token.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (!match || !tags.has(match[2].toLowerCase())) return '';
    const tag = match[2].toLowerCase();
    return `<${match[1]}${tag}>`;
  }).trim();
}

export async function importContractDocx(bytes: Buffer) {
  validateUploadBytes(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const source = await JSZip.loadAsync(bytes), clean = new JSZip();
  const entries = Object.values(source.files).filter(entry => !entry.dir);
  if (entries.length > 1000 || !source.file('word/document.xml')) throw new CommunicationError('Documentul Word nu are o structură acceptată.', 415);
  let total = 0;
  for (const entry of entries) {
    if (entry.name !== entry.unsafeOriginalName && entry.unsafeOriginalName) throw new CommunicationError('Documentul conține căi de fișiere invalide.', 415);
    const chunks: Buffer[] = [], stream = entry.nodeStream('nodebuffer');
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.on('data', (chunk: Buffer) => {
        if (stopped) return;
        total += chunk.length;
        if (total > 32 * 1024 * 1024) {
          stopped = true; stream.pause();
          (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
          reject(new CommunicationError('Conținutul decomprimat Word depășește limita de 32 MB.', 413));
          return;
        }
        chunks.push(chunk);
      });
    });
    clean.file(entry.name, Buffer.concat(chunks));
  }
  const normalized = await clean.generateAsync({ type: 'nodebuffer' });
  let imageCount = 0;
  const document = await mammoth.convertToHtml({ buffer: normalized }, {
    externalFileAccess: false, includeEmbeddedStyleMap: false,
    convertImage: mammoth.images.imgElement(async () => { imageCount++; return { src: '' }; }),
  });
  const content = contractImportHtml(document.value);
  if (!content.replace(/<[^>]+>/g, '').trim()) throw new CommunicationError('Documentul trebuie să conțină text.', 415);
  if (content.length > 120000) throw new CommunicationError('Conținutul depășește limita șablonului.', 413);
  return { content, warnings: [...(imageCount ? ['Imaginile Word nu sunt importate în corpul contractului.'] : []), ...(document.messages.length ? ['Unele elemente Word nu au un echivalent în editor.'] : [])], note: 'Paragrafele, titlurile, listele, tabelele și evidențierile sunt importate. Verifică în editor fonturile, paginarea și câmpurile înainte de activare.' };
}
