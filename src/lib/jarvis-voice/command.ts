// Both modalities enter the EXISTING authenticated workspace command endpoint.
import type { CurrentRecord } from '@/lib/ai-assistant/current-record-contract';
export type JarvisApi = (path: string, body?: unknown) => Promise<any>;
export async function existingJarvisCommand(
  api: JarvisApi,
  input: { sessionId: string; requestId: string; prompt: string; currentRecord?: CurrentRecord | null },
  background: boolean,
  progress?: (text: string) => void,
) {
  if (!background)
    return api("/api/ai-assistant/workspace", { kind: "chat", ...input });
  const job = await api("/api/ai-assistant/workspace", {
    kind: "start",
    ...input,
  });
  const start = Date.now();
  while (Date.now() - start < 180000) {
    const state = await api(
      "/api/ai-assistant/workspace?jobId=" + encodeURIComponent(job.jobId),
    );
    if (state.status === "completed") return { message: state.message };
    if (state.status === "failed")
      throw new Error(state.error || "Comanda nu a fost finalizată.");
    progress?.("Mă ocup…");
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(
    "Procesarea continuă pe server. Verifică istoricul în modul text.",
  );
}
