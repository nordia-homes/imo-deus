import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import { VoiceAudio } from "../audio";
import { wavAudio } from "../vad";
import { boundedAudio, wavSeconds } from "../transport";
import { presentVoice } from "../presentation";
describe("voice lifecycle and isolation", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("cancels all buffered playback before the next turn", () => {
    const level = vi.fn(),
      engine = new VoiceAudio(vi.fn(), vi.fn(), level, vi.fn()),
      abort = new AbortController(),
      stop = vi.fn();
    engine.playbackAbort = abort;
    engine.sources.add({ stop } as any);
    engine.nextTime = 30;
    engine.interrupt();
    expect(abort.signal.aborted).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(engine.sources.size).toBe(0);
    expect(engine.nextTime).toBe(0);
    expect(level).toHaveBeenLastCalledWith(0);
  });
  it("releases microphone tracks, worklet and captured audio on exit", () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { removeEventListener: vi.fn() },
    });
    const engine = new VoiceAudio(vi.fn(), vi.fn(), vi.fn(), vi.fn()),
      stop = vi.fn(),
      portClose = vi.fn(),
      disconnect = vi.fn();
    engine.stream = { getTracks: () => [{ stop }] } as any;
    engine.node = { disconnect, port: { close: portClose } } as any;
    engine.captured = [new Float32Array(1024)];
    engine.close();
    expect(engine.closed).toBe(true);
    expect(engine.captured).toHaveLength(0);
    expect(stop).toHaveBeenCalledOnce();
    expect(portClose).toHaveBeenCalledOnce();
  });
  it("resamples device fallback to the exact server WAV format", async () => {
    const blob = wavAudio([new Float32Array(48000)], 48000);
    expect(blob.size).toBe(48044);
    expect(wavSeconds(await blob.arrayBuffer())).toBe(1);
  });
  it("rejects forged WAV lengths and streamed oversized uploads before allocation", async () => {
    const raw = await wavAudio([new Float32Array(24000)], 24000).arrayBuffer();
    new DataView(raw).setUint32(40, 1, true);
    expect(() => wavSeconds(raw)).toThrow("Format audio invalid");
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(1440045));
        c.close();
      },
    });
    await expect(boundedAudio(stream)).rejects.toThrow("scurtă");
  });
  it("does not treat a partial aggregate fallback as the complete calendar", () => {
    const result = presentVoice({
      id: "m",
      role: "assistant",
      createdAt: "now",
      text: "",
      cards: [
        {
          type: "data",
          title: "Calendar",
          source: "viewings",
          rows: [],
          complete: false,
          summary: {
            count: 20,
            label: "vizionări",
            scope: "Rezultate parțiale",
          },
        },
      ],
    });
    expect(result.spokenText).toContain("Am afișat 20");
    expect(result.spokenText).not.toContain("Sunt 20");
  });
  it("has no separate CRM execution or matching in the voice shell", () => {
    for (const file of [
      "src/lib/jarvis-voice/provider.ts",
      "src/lib/jarvis-voice/audio.ts",
      "src/lib/jarvis-voice/command.ts",
      "src/app/api/ai-assistant/voice/route.ts",
    ]) {
      const code = fs.readFileSync(file, "utf8");
      expect(code).not.toMatch(
        /from ['"].*(planner|registry|executors|matching|handlers)/,
      );
      expect(code).not.toMatch(
        /\.collection\(['"](contacts|properties|viewings|tasks|sales|ownerListings)/,
      );
    }
    const provider = fs.readFileSync(
      "src/lib/jarvis-voice/provider.ts",
      "utf8",
    );
    expect(provider).toContain("text-to-dialogue/stream-input");
    expect(provider).not.toContain("response.create");
    expect(provider).not.toMatch(/tools:\s*\[/);
  });
});
