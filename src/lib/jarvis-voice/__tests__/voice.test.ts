import { describe, it, expect, vi } from "vitest";
import {
  presentVoice,
  confirmationIntent,
  characterStates,
} from "../presentation";
import { LocalVad, wavAudio } from "../vad";
import { existingJarvisCommand } from "../command";
describe("Voice shell parity and presentation", () => {
  it("passes the exact same command and session to the existing Jarvis endpoint", async () => {
    const api = vi.fn().mockResolvedValue({ message: { text: "Result" } });
    const input = {
      sessionId: "same-session",
      requestId: "turn",
      prompt: "Doar cele din Titan.",
    };
    await existingJarvisCommand(api, input, false);
    expect(api).toHaveBeenCalledWith("/api/ai-assistant/workspace", {
      kind: "chat",
      ...input,
    });
  });
  it("reuses the existing background job path", async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce({ jobId: "j" })
      .mockResolvedValueOnce({
        status: "completed",
        message: { text: "Result" },
      });
    await existingJarvisCommand(
      api,
      { sessionId: "s", requestId: "r", prompt: "Comandă" },
      true,
    );
    expect(api.mock.calls[0][1].kind).toBe("start");
    expect(api.mock.calls[1][0]).toContain(
      "/api/ai-assistant/workspace?jobId=j",
    );
  });
  it("speaks an exact count instead of reading every calendar card", () => {
    const p = presentVoice({
      id: "r",
      role: "assistant",
      text: "Long response",
      createdAt: "now",
      cards: [
        {
          type: "data",
          source: "viewings",
          title: "Agenda",
          rows: [{ viewingDate: "2026-10-05T07:30:00Z" }],
          summary: { count: 4, label: "vizionări" },
        },
      ],
    });
    expect(p.spokenText).toBe("Sunt 4 vizionări. Prima este la 10:30.");
    expect(p.visualPayload[0].rows).toHaveLength(1);
  });
  it("never claims a partial property page is the total dataset", () => {
    const p = presentVoice({
      id: "r",
      role: "assistant",
      text: "",
      createdAt: "now",
      cards: [
        {
          type: "results",
          source: "owners",
          title: "Owners",
          rows: [{ id: "p" }],
          complete: false,
        },
      ],
    });
    expect(p.spokenText).toContain("Am afișat 1");
    expect(p.spokenText).toContain("continua");
  });
  it("distinguishes pending approval from successful execution and uncertain delivery", () => {
    const message = {
      id: "r",
      role: "assistant" as const,
      text: "",
      createdAt: "now",
    };
    const plan = {
      id: "p",
      actions: [{ kind: "delete_task", taskId: "t" }],
      status: "pending",
    } as any;
    expect(presentVoice(message, plan).suggestedAction).toBe("confirm");
    expect(
      presentVoice(message, { ...plan, status: "unknown" }).spokenText,
    ).not.toContain("Gata");
    expect(
      presentVoice(message, { ...plan, status: "completed" }).spokenText,
    ).toContain("confirmată");
  });
  it("recognizes only isolated explicit approval words", () => {
    expect(confirmationIntent("Da.")).toBe("yes");
    expect(confirmationIntent("Nu, la 18.")).toBe(null);
    expect(confirmationIntent("Anulează")).toBe("no");
  });
  it("supports every requested character state", () => {
    expect(characterStates).toContain("FINALIZING_SPEECH");
    expect(characterStates).toHaveLength(10);
  });
});
describe("local audio gate", () => {
  it("filters silence and short noise, starts sustained speech and ends after silence", () => {
    const vad = new LocalVad();
    for (let i = 0; i < 100; i++) expect(vad.frame(0.002, 40)).toBe(null);
    expect(vad.frame(0.2, 40)).toBe(null);
    expect(vad.frame(0.002, 40)).toBe(null);
    for (let i = 0; i < 2; i++) expect(vad.frame(0.08, 40)).toBe(null);
    expect(vad.frame(0.08, 40)).toBe("start");
    for (let i = 0; i < 13; i++) expect(vad.frame(0.002, 40)).toBe(null);
    expect(vad.frame(0.002, 40)).toBe("end");
  });
  it("encodes bounded mono PCM without permanent storage", async () => {
    const blob = wavAudio([new Float32Array([-0.5, 0, 0.5])], 24000);
    expect(blob.size).toBe(50);
    const view = new DataView(await blob.arrayBuffer());
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(22, true)).toBe(1);
  });
});
