import fs from "node:fs/promises";
import { build } from "esbuild";
import dotenv from "dotenv";
import WebSocket from "ws";
dotenv.config({ path: ".env.local", quiet: true });
await build({
  entryPoints: ["src/lib/jarvis-voice/provider.ts"],
  outfile: ".tmp/voice-benchmark-provider.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
const { speechStream, transcribeAudio, AUDIO_PRICING } = await import(
  "../.tmp/voice-benchmark-provider.mjs"
);
const commands = [
  "Ce vizionări am mâine?",
  "Ce proprietăți se potrivesc lui Andrei?",
  "Doar cele din Titan.",
  "Trimite-i primele trei.",
  "Programează mâine la șaptesprezece.",
  "Nu, la optsprezece.",
  "Ce lead-uri trebuie să sun azi?",
  "Pregătește campania pentru proprietatea asta.",
  "Cristian Avădănii, strada Grădina Icoanei, Pipera și Popești-Leordeni.",
  "Apartament decomandat, două camere, sub o sută treizeci de mii de euro.",
];
const words = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/);
function wer(a, b) {
  const x = words(a),
    y = words(b),
    d = Array.from({ length: x.length + 1 }, () => Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) d[i][0] = i;
  for (let j = 0; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + Number(x[i - 1] !== y[j - 1]),
      );
  return d[x.length][y.length] / x.length;
}
function wav(pcm) {
  const b = Buffer.alloc(44 + pcm.length);
  b.write("RIFF", 0);
  b.writeUInt32LE(pcm.length + 36, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length, 40);
  pcm.copy(b, 44);
  return new Blob([b], { type: "audio/wav" });
}
function live(pcm) {
  return new Promise((resolve, reject) => {
    const started = Date.now(),
      ws = new WebSocket(
        "wss://api.openai.com/v1/realtime?intent=transcription",
        { headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY } },
      );
    let sent = false;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Live STT timeout"));
    }, 30000);
    const finish = (e, data) => {
      clearTimeout(timer);
      ws.close();
      e ? reject(e) : resolve(data);
    };
    ws.on("error", () => finish(new Error("Live STT connection failed")));
    ws.on("open", () =>
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "transcription",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: {
                  model: "gpt-live-transcribe",
                  languages: ["ro"],
                },
                turn_detection: null,
              },
            },
          },
        }),
      ),
    );
    ws.on("message", (raw) => {
      const e = JSON.parse(raw.toString());
      if (e.type === "session.updated" && !sent) {
        sent = true;
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcm.toString("base64"),
          }),
        );
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
      if (e.type === "conversation.item.input_audio_transcription.completed")
        finish(null, { text: e.transcript, latencyMs: Date.now() - started });
      if (e.type === "error") finish(new Error("Live STT rejected"));
    });
  });
}
const report = {
  environment: "synthetic_romanian_audio_loopback",
  limitations: [
    "No human microphone/speaker echo evaluation",
    "WER measures the complete TTS-to-STT loop, not isolated human transcription",
    "Live comparison uses committed sample, not streaming human input",
  ],
  pricing: AUDIO_PRICING,
  rows: [],
  totalCostUsd: 0,
  startedAt: new Date().toISOString(),
};
for (const voice of ["marin", "cedar", "coral"])
  for (const text of commands) {
    if (report.totalCostUsd > 0.5)
      throw new Error("Benchmark spend guard reached");
    let usage;
    const started = Date.now();
    try {
      const pcm = Buffer.from(
        await new Response(
          speechStream(text, voice, undefined, (u) => (usage = u)),
        ).arrayBuffer(),
      );
      const result = await transcribeAudio(wav(pcm));
      report.totalCostUsd +=
        usage.costUsd + (pcm.length / 48000 / 60) * AUDIO_PRICING.sttMinute;
      const row = {
        voice,
        text,
        transcript: result.text,
        wer: wer(text, result.text),
        firstAudioMs: usage.firstAudioMs,
        ttsMs: Date.now() - started - result.latencyMs,
        sttMs: result.latencyMs,
        outputSeconds: usage.outputSeconds,
        costUsd: usage.costUsd,
      };
      if (voice === "marin") {
        const l = await live(pcm);
        row.liveWer = wer(text, l.text);
        row.liveSttMs = l.latencyMs;
        report.totalCostUsd +=
          (pcm.length / 48000 / 60) * AUDIO_PRICING.liveSttMinute;
      }
      report.rows.push(row);
      console.log(
        JSON.stringify({
          voice,
          wer: row.wer,
          sttMs: row.sttMs,
          firstAudioMs: row.firstAudioMs,
          ...(row.liveWer !== undefined ? { liveWer: row.liveWer } : {}),
        }),
      );
    } catch (e) {
      report.rows.push({ voice, text, error: e.message });
      console.log(JSON.stringify({ voice, error: e.message }));
    }
    await fs.writeFile(
      ".tmp/voice-benchmark.json",
      JSON.stringify(report, null, 2),
    );
  }
const percentile = (values, p) =>
  values.slice().sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ] ?? null;
report.voices = Object.fromEntries(
  ["marin", "cedar", "coral"].map((voice) => {
    const rows = report.rows.filter((r) => r.voice === voice && !r.error);
    return [
      voice,
      {
        samples: rows.length,
        meanWer: rows.reduce((s, r) => s + r.wer, 0) / rows.length,
        firstAudioP50: percentile(
          rows.map((r) => r.firstAudioMs),
          0.5,
        ),
        firstAudioP95: percentile(
          rows.map((r) => r.firstAudioMs),
          0.95,
        ),
        sttP50: percentile(
          rows.map((r) => r.sttMs),
          0.5,
        ),
        sttP95: percentile(
          rows.map((r) => r.sttMs),
          0.95,
        ),
        spokenP50: percentile(
          rows.map((r) => r.outputSeconds),
          0.5,
        ),
        spokenP95: percentile(
          rows.map((r) => r.outputSeconds),
          0.95,
        ),
      },
    ];
  }),
);
report.live = {
  samples: report.rows.filter((r) => r.liveWer !== undefined).length,
  meanWer:
    report.rows
      .filter((r) => r.liveWer !== undefined)
      .reduce((s, r) => s + r.liveWer, 0) / 10,
  p50: percentile(
    report.rows.filter((r) => r.liveSttMs).map((r) => r.liveSttMs),
    0.5,
  ),
  p95: percentile(
    report.rows.filter((r) => r.liveSttMs).map((r) => r.liveSttMs),
    0.95,
  ),
};
report.completedAt = new Date().toISOString();
await fs.writeFile(
  "docs/jarvis/VOICE_BENCHMARK.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    voices: report.voices,
    live: report.live,
    totalCostUsd: report.totalCostUsd,
  }),
);
process.exitCode = report.rows.some((r) => r.error) ? 1 : 0;
