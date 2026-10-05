import { speechStream, voiceOutputId, VOICE_MODEL } from "./provider";

// Fixed synthetic speech only. Called exclusively by the authenticated worker.
export async function probeVoiceOutput(signal?: AbortSignal) {
  let usage:
    | { outputSeconds: number; firstAudioMs: number; costUsd: number | null }
    | undefined;
  const stream = speechStream(
    "Jarvis este pregătit. Vocea funcționează.",
    voiceOutputId(),
    signal,
    (value) => {
      usage = value;
    },
  );
  const reader = stream.getReader();
  let bytes = 0,
    nonZeroSamples = 0,
    carry: number | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      for (const byte of value) {
        if (carry === undefined) carry = byte;
        else {
          if (carry !== 0 || byte !== 0) nonZeroSamples++;
          carry = undefined;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!bytes || !nonZeroSamples || carry !== undefined)
    throw new Error("Fluxul audio nu conține voce validă.");
  return {
    provider: "elevenlabs",
    model: VOICE_MODEL,
    voice: voiceOutputId(),
    bytes,
    nonZeroSamples,
    ...usage,
  };
}
