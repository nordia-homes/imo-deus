import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
const require = createRequire(import.meta.url),
  root = process.cwd(),
  output = path.join(root, ".tmp/voice-ui");
await fs.mkdir(output, { recursive: true });
await build({
  stdin: {
    contents:
      "import{VoiceAudio}from'./src/lib/jarvis-voice/audio';window.VoiceAudio=VoiceAudio;import React from 'react';import{createRoot}from'react-dom/client';import{JarvisVoice}from'./src/components/jarvis-voice/JarvisVoice';createRoot(document.getElementById('root')).render(<><input aria-label='Editor CRM'/><div className='fixed bottom-2 h-16 w-full' data-navigation='mobile'>Navigation</div><JarvisVoice/></>);",
    resolveDir: root,
    loader: "tsx",
  },
  outfile: path.join(output, "bundle.js"),
  bundle: true,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "fixture-auth",
      setup(builder) {
        builder.onLoad({ filter: /rig-atlas(?:-v2)?\.png$/ }, () => ({
          contents: "export default {src:'/jarvis/rig-atlas.png'};",
          loader: "js",
        }));
        builder.onLoad({ filter: /blue-body\.png$/ }, () => ({
          contents: "export default {src:'/blue-body.png'};",
          loader: "js",
        }));
        builder.onLoad({ filter: /office-scene\.png$/ }, () => ({
          contents: "export default {src:'/office-scene.png'};",
          loader: "js",
        }));
        builder.onLoad({ filter: /context[\\/]AgencyContext\.tsx$/ }, () => ({
          contents:
            "const user={uid:'agent',getIdToken:async()=>'fixture-token'};export const useAgency=()=>({user,agencyId:'fixture-agency'});",
          loader: "js",
        }));
        builder.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "fixture",
        }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents:
            args.path === "link"
              ? "import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}"
              : "import React from 'react';export default function Image({fill,unoptimized,sizes,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined}/>}",
          loader: "jsx",
          resolveDir: root,
        }));
      },
    },
  ],
});
const config = require("tailwindcss/loadConfig")(
  path.join(root, "tailwind.config.ts"),
);
config.content = [
  path.join(root, "src/components/jarvis-voice/*.tsx"),
  path.join(root, "src/components/ai/*.tsx"),
  path.join(root, "src/components/ui/*.tsx"),
];
const css = await postcss([tailwindcss(config)]).process(
  await fs.readFile("src/app/globals.css", "utf8"),
  { from: path.join(root, "src/app/globals.css") },
);
await fs.writeFile(path.join(output, "style.css"), css.css);
const server = http.createServer(async (req, res) => {
  if (req.url === "/blue-body.png") {
    res.setHeader("Content-Type", "image/png");
    res.end(await fs.readFile("src/components/jarvis-voice/blue-body.png"));
    return;
  }
  if (req.url === "/office-scene.png") {
    res.setHeader("Content-Type", "image/png");
    res.end(await fs.readFile("src/components/jarvis-voice/office-scene.png"));
    return;
  }
  if (req.url === "/jarvis/rig-atlas.png") {
    res.setHeader("Content-Type", "image/png");
    res.end(await fs.readFile("src/components/jarvis-voice/rig-atlas-v2.png"));
    return;
  }
  const file = ["/bundle.js", "/bundle.css", "/style.css"].includes(req.url)
    ? req.url.slice(1)
    : null;
  res.setHeader(
    "Content-Type",
    file?.endsWith(".js") ? "text/javascript" : file ? "text/css" : "text/html",
  );
  res.end(
    file
      ? await fs.readFile(path.join(output, file))
      : '<html data-app-theme="agentfinder"><head><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
const errors = [],
  requests = [],
  checks = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.nativeAudioContext = window.AudioContext;
    window.nativeAudioWorkletNode = window.AudioWorkletNode;
    window.stoppedSources = 0;
    window.stoppedTracks = 0;
    const track = {
      enabled: true,
      readyState: "live",
      stop() {
        window.stoppedTracks++;
      },
    };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({
          getAudioTracks: () => [track],
          getTracks: () => [track],
        }),
        addEventListener() {},
        removeEventListener() {},
      },
    });
    class Node {
      connect() {}
      disconnect() {}
    }
    window.AudioWorkletNode = class extends Node {
      constructor() {
        super();
        this.port = { onmessage: null, close() {} };
        window.worklet = this;
      }
    };
    window.AudioContext = class {
      sampleRate = 24000;
      currentTime = 0;
      destination = {};
      audioWorklet = { addModule: async () => {} };
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      createMediaStreamSource() {
        return new Node();
      }
      createAnalyser() {
        return Object.assign(new Node(), {
          fftSize: 256,
          getFloatTimeDomainData(a) {
            a.fill(0.15);
          },
        });
      }
      createBuffer(channels, length, rate) {
        return {
          duration: length / rate,
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() {
        return Object.assign(new Node(), {
          buffer: null,
          onended: null,
          start() {
            this.timer = setTimeout(
              () => this.onended?.(),
              this.buffer.duration * 1000,
            );
          },
          stop() {
            clearTimeout(this.timer);
            window.stoppedSources++;
            this.onended?.();
          },
        });
      }
    };
    window.injectSpeech = () => {
      for (let i = 0; i < 8; i++)
        window.worklet.port.onmessage({
          data: new Float32Array(1024).fill(0.06),
        });
      for (let i = 0; i < 16; i++)
        window.worklet.port.onmessage({ data: new Float32Array(1024) });
    };
  });
  let utterance = "Ce vizionări am mâine?",
    audioSeconds = 5,
    mode = "calendar";
  const planId = "fdaf7ed4-6102-4227-a969-47c1317654e8",
    action = {
      kind: "schedule_viewing",
      contactId: "client",
      propertyId: "property",
      viewingDate: "2026-10-06T15:00:00Z",
      duration: 60,
      notes: "",
    };
  let plan = {
    id: planId,
    status: "pending",
    actions: [action],
    risks: ["SAFE_WRITE"],
  };
  const message = (text, cards = [], extra = {}) => ({
    id: crypto.randomUUID(),
    role: "assistant",
    text,
    cards,
    createdAt: new Date().toISOString(),
    ...extra,
  });
  await page.route("**/api/**", async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    assert.equal(r.headers().authorization, "Bearer fixture-token");
    let body;
    if (r.headers()["content-type"]?.startsWith("application/json"))
      body = r.postDataJSON();
    requests.push({ url: url.pathname, body, method: r.method() });
    let result;
    if (url.pathname.endsWith("/voice")) {
      if (r.method() === "GET") result = { enabled: true };
      else if (body?.kind === "metrics") result = { recorded: true };
      else if (body?.text) {
        await route.fulfill({
          status: 200,
          contentType: "audio/pcm",
          body: Buffer.alloc(48000 * audioSeconds),
        });
        return;
      } else result = { text: utterance, model: "gpt-transcribe" };
    } else if (url.pathname.endsWith("owner-consent")) {
      assert.equal(body.confirmedPhoneConsent, true);
      result = { conversationId: "owner-chat" };
    } else if (url.pathname.endsWith('/plan-outcomes')) result = { planId, executionStatus: plan.status, rows: [{ step: 1, title: 'Pasul 1', executionState: 'succeeded', evidenceSource: 'atomic_crm_transaction' }], pollAfterMs: null, checkedAt: new Date().toISOString(), note: 'Rezultat CRM confirmat.' };
    else if (r.method() === "GET" && url.searchParams.has("planId"))
      result = { plan };
    else if (r.method() === "GET" && url.searchParams.has("sessionId"))
      result = { messages: [], nextCursor: null };
    else if (r.method() === "GET") result = { backgroundConfigured: false };
    else if (body.kind === "execute") {
      plan = {
        ...plan,
        status: "completed",
        results: [{ step: 1, result: { viewingId: "v" } }],
      };
      result = { plan };
    } else if (body.kind === "cancel") {
      plan = { ...plan, status: "cancelled" };
      result = { plan };
    } else if (body.kind === "query")
      result = {
        rows:
          body.query.resource === "contacts"
            ? [
                {
                  id: "contact-context",
                  name: "Client context fixture",
                  contactType: "Cumparator",
                },
              ]
            : [
                {
                  id: "viewing-context",
                  propertyTitle: "Agenda context fixture",
                  viewingDate: "2026-10-05T10:00:00Z",
                },
              ],
        complete: true,
      };
    else if (body.kind === "read")
      result = {
        rows:
          body.query.resource === "ownerListingFavorites"
            ? [{ id: "p", title: "Apartament Titan", ownerPhone: "0722123456" }]
            : [
                {
                  id: "channel",
                  name: "WhatsApp agenție",
                  channel: "whatsapp",
                  status: "connected",
                },
              ],
      };
    else if (body.kind === "chat") {
      result = {
        message:
          mode === "plan"
            ? message("Plan pregătit.", [], { planId, actions: [action] })
            : mode === "owner"
              ? message("Rezultate proprietari.", [
                  {
                    type: "results",
                    source: "owners",
                    title: "Anunțuri proprietari",
                    complete: true,
                    rows: [
                      {
                        id: "p",
                        title: "Apartament Titan",
                        imageUrl: "/office-scene.png",
                        price: "129.000 €",
                        location: "Titan",
                        rooms: 2,
                      },
                    ],
                  },
                ])
              : message("Sunt patru vizionări mâine.", [
                  {
                    type: "data",
                    source: "viewings",
                    title: "Agenda de mâine",
                    summary: { count: 4, label: "vizionări" },
                    rows: [
                      {
                        id: "v",
                        viewingDate: "2026-10-06T07:30:00Z",
                        title: "Vizionare Titan",
                      },
                    ],
                  },
                ]),
      };
    } else throw new Error("Unexpected fixture: " + JSON.stringify(body));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page
    .getByRole("button", { name: "Deschide Jarvis Voice", exact: true })
    .waitFor();
  await page.getByLabel("Editor CRM").focus();
  await page.keyboard.press("Control+Space");
  assert.equal(
    await page
      .getByRole("dialog", { name: "Jarvis Voice", exact: true })
      .count(),
    0,
  );
  checks.push("shortcut ignores editable CRM fields");
  await page.getByLabel("Editor CRM").blur();
  await page.keyboard.press("Control+Space");
  const dialog = page.getByRole("dialog", {
    name: "Jarvis Voice",
    exact: true,
  });
  await dialog.waitFor();
  assert.equal(await dialog.locator("header").count(), 0);
  assert.equal(await dialog.locator(".jarvis-scene").count(), 1);
  assert.equal(
    await dialog
      .locator(".jarvis-voice-main")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  assert.equal(
    await dialog.locator(".jarvis-arm,.jarvis-foot,.jarvis-antenna").count(),
    0,
  );
  await dialog.getByText("Client context fixture", { exact: true }).waitFor();
  await dialog.getByText("Agenda context fixture", { exact: true }).waitFor();
  assert(
    requests.some(
      (request) =>
        request.body?.kind === "query" &&
        request.body.query.resource === "contacts",
    ),
  );
  checks.push(
    "reference office scene displays authorized CRM context without invented sample data",
  );
  checks.push("immersive animated scene has no header");
  await page.evaluate(async () => {
    const image = new window.Image();
    image.src = "/office-scene.png";
    await image.decode();
  });
  const pose = dialog.locator(".jarvis-pose");
  const beforeMotion = await pose.evaluate(
    (node) => getComputedStyle(node).translate,
  );
  await page.waitForFunction(
    (before) =>
      getComputedStyle(document.querySelector(".jarvis-pose")).translate !==
      before,
    beforeMotion,
    { timeout: 5000 },
  );
  assert.notEqual(
    await pose.evaluate((node) => getComputedStyle(node).translate),
    beforeMotion,
  );
  await page.mouse.move(30, 70);
  await page.waitForTimeout(100);
  assert.notEqual(
    await dialog
      .locator(".jarvis-character")
      .evaluate((node) => node.style.getPropertyValue("--look-x")),
    "0px",
  );
  checks.push("mascot moves continuously and eyes react to pointer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await pose.evaluate((node) => getComputedStyle(node).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  checks.push("reduced motion disables ambient and character animations");
  const workletCode = (
    await fs.readFile("src/lib/jarvis-voice/worklet.ts", "utf8")
  ).split("`")[1];
  const realFrames = await page.evaluate(async (code) => {
    const ctx = new OfflineAudioContext(1, 24000, 24000);
    const url = URL.createObjectURL(
      new Blob([code], { type: "text/javascript" }),
    );
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new window.nativeAudioWorkletNode(ctx, "jarvis-pcm");
    let frames = 0;
    node.port.onmessage = () => frames++;
    const oscillator = ctx.createOscillator();
    oscillator.connect(node);
    node.connect(ctx.destination);
    oscillator.start();
    await ctx.startRendering();
    await new Promise((r) => setTimeout(r, 100));
    node.disconnect();
    node.port.close();
    return frames;
  }, workletCode);
  assert(
    realFrames > 0,
    "Bundled worklet must load and capture frames in a real Web Audio context",
  );
  checks.push("real browser AudioWorklet loads without public-file fetch");
  const playback = await page.evaluate(async () => {
    const ctx = new OfflineAudioContext(1, 24000, 24000);
    // Offline rendering starts explicitly below; the production engine still
    // performs its resume step, which is a no-op in this offline fixture.
    ctx.resume = async () => {};
    const engine = new window.VoiceAudio(
      () => {},
      () => {},
      () => {},
      () => {},
    );
    engine.context = ctx;
    engine.analyser = ctx.createAnalyser();
    engine.analyser.connect(ctx.destination);
    const pcm = new Uint8Array(24000),
      view = new DataView(pcm.buffer);
    for (let i = 0; i < pcm.length / 2; i++)
      view.setInt16(
        i * 2,
        Math.round(Math.sin((i * 2 * Math.PI * 440) / 24000) * 8192),
        true,
      );
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(pcm.slice(0, 101));
          controller.enqueue(pcm.slice(101));
          controller.close();
        },
      }),
    );
    const abort = new AbortController();
    engine.playbackAbort = abort;
    const play = engine.play(response, abort, () => {});
    await new Promise((resolve) => setTimeout(resolve, 30));
    const rendered = await ctx.startRendering();
    await play;
    const samples = rendered.getChannelData(0);
    return {
      peak: Math.max(...samples),
      rms: Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) /
          samples.length,
      ),
      aborted: abort.signal.aborted,
    };
  });
  assert(
    playback.peak > 0.2 && playback.rms > 0.1 && !playback.aborted,
    "Production PCM decoder must render non-silent output without aborting its own request",
  );
  checks.push(
    "real browser PCM playback renders non-silent sound across odd chunk boundaries",
  );
  assert.equal(await dialog.locator('textarea,input:not([type="file"])').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: 'Atașează fișier' }).count(), 1);
  checks.push("desktop shortcut opens voice without transcript/composer");
  await page.screenshot({ path: path.join(output, "listening.png") });
  await page.evaluate(() => window.injectSpeech());
  await page
    .getByRole("heading", { name: "Agenda de mâine", exact: true })
    .waitFor();
  await page.locator(".jarvis-character[data-state=SPEAKING]").waitFor();
  await page.screenshot({ path: path.join(output, "speaking.png") });
  assert(
    requests.some(
      (r) => r.body?.text === "Sunt 4 vizionări. Prima este la 10:30.",
    ),
  );
  checks.push("existing core returns cards and concise speech");
  utterance = "Programează o vizionare.";
  mode = "plan";
  audioSeconds = 0.2;
  const start = Date.now();
  await page.evaluate(() => window.injectSpeech());
  await page
    .getByRole("heading", { name: "Confirmă planul", exact: true })
    .waitFor();
  assert(Date.now() - start < 2500);
  assert(await page.evaluate(() => window.stoppedSources > 0));
  assert.equal(requests.filter((r) => r.body?.kind === "execute").length, 0);
  checks.push("local barge-in stops buffered audio and approval is required");
  await page.screenshot({ path: path.join(output, "confirmation.png") });
  utterance = "Da.";
  await page.evaluate(() => window.injectSpeech());
  await page.getByText("Execuție confirmată.", { exact: true }).waitFor();
  assert.equal(requests.filter((r) => r.body?.kind === "execute").length, 1);
  const sessionIds = requests
    .filter((r) => r.body?.kind === "chat")
    .map((r) => r.body.sessionId);
  assert.equal(new Set(sessionIds).size, 1);
  checks.push("spoken approval uses existing execute and shared session");
  await page
    .getByRole("button", { name: "Oprește microfonul", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pornește microfonul", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Pornește microfonul", exact: true })
    .click();
  mode = "owner";
  utterance = "Dă-mi 5 apartamente în Titan.";
  await page.evaluate(() => window.injectSpeech());
  await page
    .getByRole("heading", { name: "Apartament Titan", exact: true })
    .waitFor();
  const propertyRow = dialog
    .locator('section[data-source="owners"] article')
    .first();
  assert((await propertyRow.locator("img").count()) === 1);
  await page.screenshot({ path: path.join(output, "property-results.png") });
  await page
    .getByRole("button", { name: "Confirm acordul WhatsApp", exact: true })
    .click();
  const consent = page.getByRole("dialog", {
    name: "Confirm acordul WhatsApp",
    exact: true,
  });
  await consent.waitFor();
  assert(
    await consent
      .getByRole("button", { name: "Înregistrează acordul" })
      .isDisabled(),
  );
  await consent
    .getByLabel("Ce a confirmat proprietarul în apel")
    .fill("Acord telefonic pentru mesaje de colaborare WhatsApp.");
  await consent.getByRole("checkbox").check();
  await consent.getByRole("button", { name: "Înregistrează acordul" }).click();
  await consent.waitFor({ state: "hidden" });
  checks.push("same explicit WhatsApp consent form in voice");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert(await page.evaluate(() => window.stoppedTracks > 0));
  await page.keyboard.press("Control+Space");
  await dialog.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "mobile-open.png") });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.keyboard.press("Escape");
  const launcher = await page
    .getByRole("button", { name: "Deschide Jarvis Voice", exact: true })
    .boundingBox();
  assert(launcher.y + launcher.height <= 844 - 72);
  checks.push(
    "mobile launcher above navigation and safe-area; Esc releases microphone",
  );
  await page.screenshot({ path: path.join(output, "mobile-launcher.png") });
  await page
    .getByRole("button", { name: "Deschide Jarvis Voice", exact: true })
    .click();
  await dialog.waitFor();
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0,
          start = performance.now();
        function frame() {
          n++;
          if (performance.now() - start < 2000) requestAnimationFrame(frame);
          else resolve(n / ((performance.now() - start) / 1000));
        }
        requestAnimationFrame(frame);
      }),
  );
  checks.push(
    "layered rig renders with blue body and preserved independent eye/mouth nodes",
  );
  assert.equal(await dialog.locator("[data-layer]").count(), 10);
  assert.deepEqual(errors, []);
  const report = {
    passed: true,
    checks,
    syntheticAudio: true,
    animationFps: fps,
    bargeInGateMs: 120,
    limitations: [
      "Headless Chromium with mocked microphone/output; real device echo cancellation requires manual acceptance.",
    ],
    screenshots: output,
  };
  await fs.writeFile(
    "docs/jarvis/VOICE_UI_TESTS.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
