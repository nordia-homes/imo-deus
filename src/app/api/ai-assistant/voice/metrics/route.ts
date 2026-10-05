import { NextRequest, NextResponse } from "next/server";
import { assistantContext, collectionFor } from "@/lib/ai-assistant/access";
import { assistantError } from "@/lib/ai-assistant/http-error";
export const runtime = "nodejs";
const percentile = (values: number[], p: number) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
};
export async function GET(req: NextRequest) {
  try {
    const ctx = await assistantContext(req);
    let query = collectionFor(ctx, "assistantVoiceTelemetry").orderBy(
      "at",
      "desc",
    );
    if (ctx.role !== "admin") query = query.where("uid", "==", ctx.uid);
    const snapshot = await query.limit(1001).get(),
      rows = snapshot.docs.slice(0, 1000).map((d) => d.data()),
      values = (key: string) =>
        rows
          .filter((r) => typeof r[key] === "number")
          .map((r) => Number(r[key])),
      sum = (key: string) => values(key).reduce((a, b) => a + b, 0),
      mean = (key: string) =>
        values(key).length ? sum(key) / values(key).length : null;
    return NextResponse.json(
      {
        scope: ctx.role === "admin" ? "agency" : "user",
        samples: rows.length,
        complete: snapshot.size <= 1000,
        window: "Cele mai recente 1000 evenimente audio",
        audioCostUsd: rows.some((r) => r.kind === "tts" && r.costUsd === null)
          ? null
          : sum("costUsd"),
        knownAudioCostUsd: sum("costUsd"),
        unpricedTtsEvents: rows.filter(
          (r) => r.kind === "tts" && r.costUsd === null,
        ).length,
        ttsCharacters: sum("billedCharacters"),
        sttMinutes: sum("durationSeconds") / 60,
        ttsMinutes: sum("outputSeconds") / 60,
        closedSessionMinutes: sum("sessionSeconds") / 60,
        estimatedAudioCostPer1000ClosedMinutes:
          sum("sessionSeconds") &&
          !rows.some((r) => r.kind === "tts" && r.costUsd === null)
            ? (sum("costUsd") / (sum("sessionSeconds") / 60)) * 1000
            : null,
        interruptions: sum("interruptions"),
        averageSpokenWords: mean("spokenWords"),
        averageSpokenSeconds: mean("outputSeconds"),
        latency: {
          turnToAudio: {
            p50: percentile(values("turnToAudioMs"), 0.5),
            p95: percentile(values("turnToAudioMs"), 0.95),
          },
          stt: {
            p50: percentile(values("latencyMs"), 0.5),
            p95: percentile(values("latencyMs"), 0.95),
          },
          jarvis: {
            p50: percentile(values("jarvisMs"), 0.5),
            p95: percentile(values("jarvisMs"), 0.95),
          },
          ttsFirstAudio: {
            p50: percentile(
              rows
                .filter((r) => r.kind === "metrics")
                .map((r) => r.firstAudioMs),
              0.5,
            ),
            p95: percentile(
              rows
                .filter((r) => r.kind === "metrics")
                .map((r) => r.firstAudioMs),
              0.95,
            ),
          },
        },
        limitations: [
          "Metadatele clientului sunt orientative; costurile sunt estimate din utilizarea providerului.",
          "Sesiunile încă deschise și evenimentele din afara ferestrei nu sunt incluse.",
          "Costul core Jarvis se raportează separat la /api/ai-assistant/metrics.",
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return assistantError(e);
  }
}
