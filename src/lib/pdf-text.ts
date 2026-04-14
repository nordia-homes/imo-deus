import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if ('GlobalWorkerOptions' in pdfjs) {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
    ).href;
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');

    if (pageText.trim()) {
      chunks.push(pageText.trim());
    }
  }

  return chunks.join('\n').trim();
}
