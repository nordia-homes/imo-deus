import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { assistantContext } from "@/lib/ai-assistant/access";
import { assistantError } from "@/lib/ai-assistant/http-error";
import {
  voiceEnabled,
  reserveAudio,
  audioTelemetry,
} from "@/lib/jarvis-voice/server";
import {
  speechStream,
  voiceOutputId,
  VOICE_MODEL,
  transcribeAudio,
  AUDIO_PRICING,
} from "@/lib/jarvis-voice/provider";
import { boundedAudio, wavSeconds } from "@/lib/jarvis-voice/transport";
import { readBoundedText } from "@/lib/romimo/transport";
export const runtime = "nodejs";
export const maxDuration = 60;
const session = z.string().uuid(),
  platform = z.enum(["web", "mobile", "electron"]);
export async function GET(req: NextRequest) {
  try {
    const ctx = await assistantContext(req);
    return NextResponse.json(
      {
        enabled: ctx.runtimeMode === "real" && voiceEnabled(ctx.agencyId),
        sttModel: "gpt-transcribe",
        ttsModel: VOICE_MODEL,
        ttsProvider: "elevenlabs",
        voice: voiceOutputId(),
        pricing: AUDIO_PRICING,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return assistantError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await assistantContext(req);
    if (req.headers.get("content-type")?.startsWith("audio/wav")) {
      await reserveAudio(ctx);
      const voiceSessionId = session.parse(
          req.headers.get("x-voice-session-id"),
        ),
        device = platform.parse(req.headers.get("x-voice-platform") || "web"),
        raw = await boundedAudio(req.body),
        seconds = wavSeconds(raw),
        result = await transcribeAudio(
          new Blob([raw], { type: "audio/wav" }),
          req.signal,
        );
      await audioTelemetry(ctx, {
        kind: "stt",
        voiceSessionId,
        platform: device,
        model: result.model,
        durationSeconds: seconds,
        latencyMs: result.latencyMs,
        costUsd: (seconds / 60) * AUDIO_PRICING.sttMinute,
        pricingVersion: AUDIO_PRICING.version,
      });
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const raw = JSON.parse(await readBoundedText(req.body, 4000));
    if (raw.kind === "metrics") {
      await reserveAudio(ctx, true);
      const input = z
        .object({
          kind: z.literal("metrics"),
          voiceSessionId: session,
          platform,
          jarvisMs: z.number().min(0).max(240000).optional(),
          firstAudioMs: z.number().min(0).max(240000).optional(),
          turnToAudioMs: z.number().min(0).max(240000).optional(),
          spokenWords: z.number().int().min(0).max(100).optional(),
          interruptions: z.number().int().min(0).max(1).optional(),
          sessionSeconds: z.number().min(0).max(86400).optional(),
        })
        .strict()
        .parse(raw);
      await audioTelemetry(ctx, input);
      return NextResponse.json({ recorded: true });
    }
    const input = z
      .object({
        text: z.string().trim().min(1).max(400),
        voiceSessionId: session,
        platform: platform.default("web"),
      })
      .strict()
      .parse(raw);
    await reserveAudio(ctx);
    const voice = voiceOutputId();
    const telemetry: Record<string, unknown>[] = [];
    after(async () => {
      for (const usage of telemetry) await audioTelemetry(ctx, usage);
    });
    const stream = speechStream(input.text, voice, req.signal, (usage) => {
      telemetry.push({
        kind: "tts",
        model: VOICE_MODEL,
        provider: "elevenlabs",
        voice,
        voiceSessionId: input.voiceSessionId,
        platform: input.platform,
        ...usage,
        pricingVersion: "elevenlabs-contract-rate-v1",
      });
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "audio/pcm",
        "X-Audio-Sample-Rate": "24000",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return assistantError(e);
  }
}
