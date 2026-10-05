import { EventEmitter } from "node:events";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const sockets = vi.hoisted(() => [] as any[]);
vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static OPEN = 1;
    sent: any[] = [];
    close = vi.fn();
    constructor(
      public url: URL,
      public options: any,
    ) {
      super();
      sockets.push(this);
    }
    send(value: string) {
      this.sent.push(JSON.parse(value));
    }
  },
}));
import { speechStream, VOICE_MODEL } from "../provider";
describe("Eleven v3 Conversational speech renderer", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubEnv("ELEVENLABS_API_KEY", "test-server-key");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("uses one server-authenticated Romanian voice and flushes short answers", async () => {
    const usage = vi.fn();
    const reader = speechStream(
      "Răspuns fix.",
      "romanian-voice",
      undefined,
      usage,
    ).getReader();
    const socket = sockets[0];
    socket.emit("open");
    expect(socket.url.searchParams.get("model_id")).toBe(VOICE_MODEL);
    expect(socket.url.searchParams.get("output_format")).toBe("pcm_24000");
    expect(socket.url.searchParams.get("language_code")).toBe("ro");
    expect(socket.options.headers["xi-api-key"]).toBe("test-server-key");
    expect(socket.sent).toEqual([
      { voices: ["romanian-voice"] },
      { inputs: [{ text: "Răspuns fix.", voice_id: "romanian-voice" }] },
      { close_socket: true },
    ]);
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({ audio: Buffer.from([1, 0]).toString("base64") }),
      ),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ is_final_audio_for_turn: true })),
    );
    expect((await reader.read()).value).toEqual(Buffer.from([1, 0]));
    expect((await reader.read()).done).toBe(true);
    expect(usage).toHaveBeenCalledWith(
      expect.objectContaining({
        costUsd: null,
        pricingKnown: false,
        interrupted: false,
        billedCharacters: 12,
      }),
    );
  });
  it("fails instead of silently switching provider when credentials are missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(speechStream("Salut").getReader().read()).rejects.toThrow(
      "ElevenLabs",
    );
    expect(sockets).toHaveLength(0);
  });
  it("rejects empty successful connections and provider errors", async () => {
    const reader = speechStream("Salut").getReader();
    sockets[0].emit("close", 1000);
    await expect(reader.read()).rejects.toThrow();
    const second = speechStream("Salut").getReader();
    sockets[1].emit("message", Buffer.from(JSON.stringify({ error: "quota" })));
    await expect(second.read()).rejects.toThrow();
  });
  it("stops immediately on cancellation and never sends text after abort", async () => {
    const signal = new AbortController();
    const reader = speechStream("Salut", undefined, signal.signal).getReader();
    signal.abort();
    sockets[0].emit("open");
    await expect(reader.read()).rejects.toThrow();
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expect(sockets[0].sent).toHaveLength(0);
  });
  it("bounds output and rejects incomplete PCM frames", async () => {
    const reader = speechStream("Salut").getReader();
    sockets[0].emit(
      "message",
      Buffer.from(
        JSON.stringify({ audio: Buffer.from([1]).toString("base64") }),
      ),
    );
    sockets[0].emit("close", 1000);
    await expect(reader.read()).rejects.toThrow();
    const second = speechStream("Salut").getReader();
    sockets[1].emit(
      "message",
      Buffer.from(
        JSON.stringify({ audio: Buffer.alloc(1200002).toString("base64") }),
      ),
    );
    await expect(second.read()).rejects.toThrow();
  });
});
