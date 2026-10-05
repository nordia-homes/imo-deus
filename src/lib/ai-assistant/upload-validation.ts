import { CommunicationError } from '@/lib/communications/server';

export function validateUploadBytes(bytes: Buffer, mimeType: string) {
  const signature = (value: number[]) => value.every((byte, index) => bytes[index] === byte);
  const valid = mimeType === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-'
    : mimeType === 'image/png' ? signature([137, 80, 78, 71, 13, 10, 26, 10])
    : mimeType === 'image/jpeg' ? signature([255, 216, 255])
    : mimeType === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? signature([80, 75, 3, 4]) && bytes.includes(Buffer.from('word/')) && bytes.includes(Buffer.from('[Content_Types].xml'))
    : mimeType === 'text/csv' ? !bytes.includes(0) && !bytes.subarray(0, 512).toString().trimStart().match(/^<(?:!doctype|html|script|svg)/i)
    : false;
  if (!valid) throw new CommunicationError('Conținutul fișierului nu corespunde formatului declarat.', 415);
}

export async function boundedUploadRequest(request: Request, limit = 16 * 1024 * 1024) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new CommunicationError('Limita este 15 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CommunicationError('Fișier lipsă.', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new CommunicationError('Limita este 15 MB.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Request(request.url, { method: 'POST', headers: request.headers, body: Buffer.concat(chunks) });
}
