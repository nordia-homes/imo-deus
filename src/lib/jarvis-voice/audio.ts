import { LocalVad, wavAudio } from "./vad";
import {PCM_WORKLET} from './worklet';
export class VoiceAudio {
  context?: AudioContext;
  stream?: MediaStream;
  node?: AudioWorkletNode;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  muted = false;
  speakerMuted = false;
  closed = false;
  captured: Float32Array[] = [];
  preRoll: Float32Array[] = [];
  sources = new Set<AudioBufferSourceNode>();
  nextTime = 0;
  vad = new LocalVad();
  playbackAbort?: AbortController;
  epoch = 0;
  levelTimer?: ReturnType<typeof setInterval>;
  deviceChanged = () => {
    if (
      !this.closed &&
      !this.stream?.getAudioTracks().some((t) => t.readyState === "live")
    )
      this.onError("Microfonul a fost schimbat. Reconectează-l.");
  };
  constructor(
    private onSpeech: (audio: Blob, epoch: number) => void,
    private onStart: (interrupted: boolean) => void,
    private onLevel: (level: number) => void,
    private onError: (message: string) => void,
  ) {}
  async start() {
    this.closed = false;
    this.context = new AudioContext({ sampleRate: 24000 });
    await this.context.resume();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (this.closed) {
        this.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!this.closed) this.onError("Microfonul a fost deconectat.");
        };
      });
      navigator.mediaDevices.addEventListener(
        "devicechange",
        this.deviceChanged,
      );
      const moduleUrl=URL.createObjectURL(new Blob([PCM_WORKLET],{type:'text/javascript'}));
      try{await this.context.audioWorklet.addModule(moduleUrl);}finally{URL.revokeObjectURL(moduleUrl);}
      if (this.closed) return;
      this.source = this.context.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.context, "jarvis-pcm");
      this.source.connect(this.node);
      this.node.connect(this.context.destination);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.context.destination);
      this.node.port.onmessage = ({ data }: { data: Float32Array }) => {
        if (this.closed || this.muted || document.hidden) return;
        const rms = Math.sqrt(
            data.reduce((s, v) => s + v * v, 0) / data.length,
          ),
          ms = (data.length / this.context!.sampleRate) * 1000;
        this.onLevel(this.sources.size ? this.outputLevel() : rms);
        const event = this.vad.frame(rms, ms);
        if (event === "start") {
          this.epoch++;
          const interrupted = this.sources.size > 0;
          this.interrupt();
          this.captured = [...this.preRoll];
          this.onStart(interrupted);
        }
        if (this.vad.talking || event === "end") this.captured.push(data);
        else {
          this.preRoll.push(data);
          if (this.preRoll.length > 6) this.preRoll.shift();
        }
        if (event === "end") {
          const chunks = this.captured;
          this.captured = [];
          this.preRoll = [];
          if (chunks.length > 4)
            this.onSpeech(
              wavAudio(chunks, this.context!.sampleRate),
              this.epoch,
            );
        }
      };
    } catch (e) {
      this.onError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Am nevoie de acces la microfon."
          : "Microfonul nu este disponibil.",
      );
      this.close();
      throw e;
    }
  }
  outputLevel() {
    if (!this.analyser) return 0;
    const values = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(values);
    return Math.sqrt(values.reduce((n, v) => n + v * v, 0) / values.length);
  }
  interrupt() {
    this.playbackAbort?.abort();
    this.playbackAbort = undefined;
    clearInterval(this.levelTimer);
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextTime = 0;
    this.onLevel(0);
  }
  setMicMuted(value: boolean) {
    this.muted = value;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !value));
    this.vad.reset();
    this.captured = [];
    this.preRoll = [];
  }
  async play(
    response: Response,
    controller: AbortController,
    onFirst: () => void,
  ) {
    if (!response.ok || !response.body)
      throw new Error("Nu pot reda vocea momentan.");
    if (this.speakerMuted) {
      await response.body.cancel();
      return;
    }
    if (this.playbackAbort !== controller) this.interrupt();
    this.playbackAbort = controller;
    const context = this.context!;
    await context.resume();
    const reader = response.body.getReader();
    let carry: Uint8Array<ArrayBufferLike> = new Uint8Array(),
      first = true;
    const waits: Promise<void>[] = [];
    this.levelTimer = setInterval(() => this.onLevel(this.outputLevel()), 50);
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (this.closed || controller.signal.aborted) {
          await reader.cancel();
          break;
        }
        const joined = new Uint8Array(carry.length + chunk.value.length);
        joined.set(carry);
        joined.set(chunk.value, carry.length);
        const length = joined.length - (joined.length % 2);
        carry = joined.slice(length);
        if (!length) continue;
        const buffer = context.createBuffer(1, length / 2, 24000),
          samples = buffer.getChannelData(0),
          view = new DataView(joined.buffer);
        for (let i = 0; i < samples.length; i++)
          samples[i] = view.getInt16(i * 2, true) / 32768;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser!);
        this.sources.add(source);
        this.nextTime = Math.max(this.nextTime, context.currentTime + 0.03);
        source.start(this.nextTime);
        this.nextTime += buffer.duration;
        waits.push(
          new Promise((resolve) => {
            source.onended = () => {
              this.sources.delete(source);
              resolve();
            };
          }),
        );
        if (first) {
          first = false;
          onFirst();
        }
      }
      await Promise.all(waits);
    } finally {
      reader.releaseLock();
      if (this.playbackAbort === controller) {
        this.playbackAbort = undefined;
        clearInterval(this.levelTimer);
        this.onLevel(0);
      }
    }
  }
  close() {
    this.closed = true;
    this.epoch++;
    this.interrupt();
    navigator.mediaDevices.removeEventListener(
      "devicechange",
      this.deviceChanged,
    );
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.captured = [];
    this.preRoll = [];
    this.node?.port.close();
    void this.context?.close().catch(() => {});
  }
}
