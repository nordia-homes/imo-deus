import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type PdfTextLimits = { maxBytes: number; maxPages: number; maxChars: number; timeoutMs: number; pageMarkers?: boolean };
export async function extractTextFromPdfBuffer(buffer: Buffer, limits?: PdfTextLimits): Promise<string> {
  if (limits && buffer.length > limits.maxBytes) throw new Error('PDF-ul depășește limita de volum.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if ('GlobalWorkerOptions' in pdfjs) {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
    ).href;
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const extract = async () => {
    const pdf = await loadingTask.promise;
    if (limits && pdf.numPages > limits.maxPages) throw new Error('PDF-ul depășește limita de pagini.');
    const chunks: string[] = [];
    let chars = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageText = content.items.map(item => 'str' in item ? item.str : '').filter(Boolean).join(' ').trim();
        if (pageText) {
          const text = limits?.pageMarkers ? `[Pagina ${pageNumber}] ${pageText}` : pageText;
          chars += text.length + 1;
          if (limits && chars > limits.maxChars) throw new Error('Textul PDF depășește limita de citire.');
          chunks.push(text);
        }
      } finally { page.cleanup(); }
    }
    return chunks.join('\n').trim();
  };
  try {
    if (!limits) return await extract();
    return await Promise.race([extract(), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Extragerea PDF a depășit timpul disponibil.')), limits.timeoutMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    await loadingTask.destroy();
  }
}
