import { describe, it, expect, vi, beforeEach } from "vitest";
const speech = vi.hoisted(() => vi.fn());
vi.mock("../provider", () => ({ speechStream: speech }));
import { probeVoiceOutput } from "../health";
describe("synthetic production speech probe", () => {
  beforeEach(() => {
    speech.mockReset();
  });
  const stream = (chunks: number[][]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(Uint8Array.from(chunk)));
        controller.close();
      },
    });
  it("verifies real non-silent PCM even across odd chunk boundaries", async () => {
    speech.mockImplementation((_text, _voice, _signal, usage) => {
      usage({ outputSeconds: 1, firstAudioMs: 100, costUsd: 0.001 });
      return stream([[0], [0, 1], [0]]);
    });
    expect(await probeVoiceOutput()).toEqual({
      bytes: 4,
      nonZeroSamples: 1,
      outputSeconds: 1,
      firstAudioMs: 100,
      costUsd: 0.001,
    });
    expect(speech.mock.calls[0][0]).toBe(
      "Jarvis este pregătit. Vocea funcționează.",
    );
  });
  it.each([{ chunks: [] }, { chunks: [[0, 0]] }, { chunks: [[1]] }])(
    "rejects empty, silent or malformed output: $chunks",
    async ({ chunks }) => {
      speech.mockReturnValue(stream(chunks));
      await expect(probeVoiceOutput()).rejects.toThrow();
    },
  );
});
