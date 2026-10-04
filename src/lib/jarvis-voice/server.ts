import type { AssistantContext } from "@/lib/ai-assistant/access";
import { CommunicationError } from "@/lib/communications/server";
export function voiceEnabled(agencyId: string) {
  return (
    process.env.JARVIS_VOICE_ENABLED === "true" &&
    (!process.env.JARVIS_VOICE_AGENCIES ||
      process.env.JARVIS_VOICE_AGENCIES.split(",")
        .map((s) => s.trim())
        .includes(agencyId))
  );
}
export async function reserveAudio(ctx: AssistantContext, metrics = false) {
  if (!voiceEnabled(ctx.agencyId) || ctx.runtimeMode === "demo")
    throw new CommunicationError(
      "Jarvis Voice nu este activ pentru această agenție.",
      403,
    );
  const ref = ctx.adminDb
    .collection("agencies")
    .doc(ctx.agencyId)
    .collection("assistantVoiceUsage")
    .doc(ctx.uid);
  await ctx.adminDb.runTransaction(async (tx) => {
    const row = (await tx.get(ref)).data() || {},
      minute = Math.floor(Date.now() / 60000),
      day = new Date().toISOString().slice(0, 10),
      calls = row.minute === minute ? Number(row.calls || 0) : 0,
      daily = row.day === day ? Number(row.daily || 0) : 0;
    if (metrics) {
      const count =
        row.metricsMinute === minute ? Number(row.metricsCalls || 0) : 0;
      if (count >= 120)
        throw new CommunicationError("Prea multe evenimente audio.", 429);
      tx.set(
        ref,
        { metricsMinute: minute, metricsCalls: count + 1 },
        { merge: true },
      );
      return;
    }
    const dailyLimit = Math.min(
      5000,
      Math.max(100, Number(process.env.JARVIS_VOICE_DAILY_CALL_LIMIT) || 1200),
    );
    if (calls >= 30 || daily >= dailyLimit)
      throw new CommunicationError(
        "Limita audio a fost atinsă. Reîncearcă după resetare.",
        429,
      );
    tx.set(
      ref,
      { minute, calls: calls + 1, day, daily: daily + 1 },
      { merge: true },
    );
  });
}
export async function audioTelemetry(
  ctx: AssistantContext,
  row: Record<string, unknown>,
) {
  await ctx.adminDb
    .collection("agencies")
    .doc(ctx.agencyId)
    .collection("assistantVoiceTelemetry")
    .doc()
    .create({
      ...row,
      uid: ctx.uid,
      agencyId: ctx.agencyId,
      at: new Date().toISOString(),
    });
}
