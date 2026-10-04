import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  probe: vi.fn(),
  jobs: vi.fn(),
  automations: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("@/firebase/admin", () => ({
  adminDb: { collection: mocks.collection },
}));
vi.mock("@/lib/ai-assistant/automation-worker", () => ({
  drainAssistantAutomations: mocks.automations,
}));
vi.mock("@/lib/ai-assistant/jobs", () => ({ drainAgentJobs: mocks.jobs }));
vi.mock("../health", () => ({ probeVoiceOutput: mocks.probe }));
import { POST } from "@/app/api/ai-assistant/worker/route";
describe("private voice diagnostic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AI_ASSISTANT_WORKER_SECRET", "test-worker-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("rejects unauthenticated and invalid credentials before generating paid audio", async () => {
    for (const authorization of ["", "Bearer wrong"]) {
      const response = await POST(
        new Request("https://crm.test/api/ai-assistant/worker?probe=voice", {
          method: "POST",
          headers: { authorization },
        }),
      );
      expect(response.status).toBe(403);
    }
    expect(mocks.probe).not.toHaveBeenCalled();
  });
  it("generates only the fixed diagnostic without draining CRM actions", async () => {
    mocks.probe.mockResolvedValue({ bytes: 48000, nonZeroSamples: 1000 });
    const response = await POST(
      new Request("https://crm.test/api/ai-assistant/worker?probe=voice", {
        method: "POST",
        headers: { authorization: "Bearer test-worker-key" },
        body: "Arbitrary input ignored",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bytes: 48000,
      nonZeroSamples: 1000,
    });
    expect(mocks.jobs).not.toHaveBeenCalled();
    expect(mocks.automations).not.toHaveBeenCalled();
    expect(mocks.collection).not.toHaveBeenCalled();
  });
});
