import { CommunicationError } from "@/lib/communications/server";
export async function boundedAudio(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new CommunicationError("Audio lipsă.", 400);
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 1440044) {
        await reader.cancel();
        throw new CommunicationError(
          "Înregistrarea trebuie să fie scurtă.",
          413,
        );
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result.buffer;
}
export function wavSeconds(raw: ArrayBuffer) {
  const view = new DataView(raw),
    text = (at: number, len: number) =>
      new TextDecoder().decode(new Uint8Array(raw, at, len));
  if (
    raw.byteLength < 1000 ||
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    text(12, 4) !== "fmt " ||
    text(36, 4) !== "data" ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint16(34, true) !== 16 ||
    view.getUint32(24, true) !== 24000 ||
    view.getUint32(28, true) !== 48000 ||
    view.getUint16(32, true) !== 2 ||
    view.getUint32(40, true) !== raw.byteLength - 44 ||
    view.getUint32(4, true) !== raw.byteLength - 8 ||
    (raw.byteLength - 44) % 2
  )
    throw new CommunicationError("Format audio invalid.", 400);
  return (raw.byteLength - 44) / 48000;
}
