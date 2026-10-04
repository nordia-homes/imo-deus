export class LocalVad {
  noise = 0.004;
  talking = false;
  voicedMs = 0;
  silenceMs = 0;
  durationMs = 0;
  frame(rms: number, ms: number) {
    const threshold = Math.max(0.015, this.noise * 3.5);
    const voiced = rms > threshold;
    if (!this.talking && !voiced)
      this.noise = this.noise * 0.98 + Math.min(rms, 0.025) * 0.02;
    if (voiced) {
      this.voicedMs += ms;
      this.silenceMs = 0;
    } else {
      this.silenceMs += ms;
      if (!this.talking) this.voicedMs = 0;
    }
    if (!this.talking && this.voicedMs >= 120) {
      this.talking = true;
      this.durationMs = this.voicedMs;
      return "start";
    }
    if (this.talking) {
      this.durationMs += ms;
      if (this.silenceMs >= 550 || this.durationMs >= 25000) {
        this.reset();
        return "end";
      }
    }
    return null;
  }
  reset() {
    this.talking = false;
    this.voicedMs = 0;
    this.silenceMs = 0;
    this.durationMs = 0;
  }
}
export function wavAudio(chunks: Float32Array[], rate: number) {
  if (rate !== 24000) {
    const original = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      original.set(chunk, offset);
      offset += chunk.length;
    }
    const converted = new Float32Array(
      Math.floor((original.length * 24000) / rate),
    );
    for (let i = 0; i < converted.length; i++) {
      const start = Math.floor((i * rate) / 24000),
        end = Math.min(
          original.length,
          Math.max(start + 1, Math.floor(((i + 1) * rate) / 24000)),
        );
      let sum = 0;
      for (let j = start; j < end; j++) sum += original[j];
      converted[i] = sum / (end - start);
    }
    chunks = [converted];
    rate = 24000;
  }
  const count = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new ArrayBuffer(44 + count * 2),
    v = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + count * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, count * 2, true);
  let i = 44;
  for (const c of chunks)
    for (const s of c) {
      v.setInt16(i, Math.max(-1, Math.min(1, s)) * 32767, true);
      i += 2;
    }
  return new Blob([buffer], { type: "audio/wav" });
}
