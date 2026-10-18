import type { NamedChoice } from '@/lib/ai-assistant/named-choice-contract';
// Both modalities enter the EXISTING authenticated workspace command endpoint.
import type { CurrentRecord } from '@/lib/ai-assistant/current-record-contract';
export type JarvisApi = (path: string, body?: unknown) => Promise<any>;
export async function existingJarvisCommand(
  api: JarvisApi,
  input: { sessionId: string; requestId: string; prompt: string; currentRecord?: CurrentRecord | null; choice?: NamedChoice },
  background: boolean,
  progress?: (text: string, stage?: string) => void,
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
    const event = state.events?.filter((event: any) => event.type === 'PROGRESS_EVENT').at(-1);
    progress?.('Mă ocup de cererea ta.', event?.stage);
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(
    "Procesarea continuă pe server. Verifică istoricul în modul text.",
  );
}
