"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  PanelRightClose,
  PanelRightOpen,
  Keyboard,
  Check,
} from "lucide-react";
import { AssistantResultCard } from "@/components/ai/AssistantResultCard";
import {
  OwnerConsentDialog,
  loadOwnerConsent,
  consentPayload,
  type Consent,
} from "@/components/ai/OwnerConsentDialog";
import { ActionPreview } from "@/components/ai/ActionPreview";
import { JarvisCharacter } from "./JarvisCharacter";
import {
  activeJarvisSession,
  storeJarvisSession,
  editableTarget,
  voiceTimestamp,
} from "@/lib/jarvis-voice/session";
import { existingJarvisCommand } from "@/lib/jarvis-voice/command";
import { VoiceAudio } from "@/lib/jarvis-voice/audio";
import {
  presentVoice,
  confirmationIntent,
  type CharacterState,
  type Gesture,
  type Expression,
} from "@/lib/jarvis-voice/presentation";
import type {
  AssistantMessage,
  AssistantPlan,
  AssistantCard,
  AssistantAction,
} from "@/lib/ai-assistant/contracts";
const stateText: Record<CharacterState, string> = {
  IDLE: "Vorbește natural cu Jarvis.",
  LISTENING: "Ascult…",
  FINALIZING_SPEECH: "Procesez vocea…",
  PROCESSING: "Mă ocup…",
  WORKING: "Execut planul…",
  SPEAKING: "Jarvis vorbește…",
  AWAITING_CONFIRMATION: "Aștept confirmarea ta.",
  SUCCESS: "Gata.",
  ERROR: "Este necesară atenția ta.",
  RECONNECTING: "Reconectez microfonul…",
};
export function JarvisVoice() {
  const { user, agencyId } = useAgency();
  const [enabled, setEnabled] = useState(false),
    [open, setOpen] = useState(false),
    [state, setState] = useState<CharacterState>("IDLE"),
    [gesture, setGesture] = useState<Gesture>("NEUTRAL"),
    [level, setLevel] = useState(0),
    [micMuted, setMicMuted] = useState(false),
    [speakerMuted, setSpeakerMuted] = useState(false),
    [error, setError] = useState(""),
    [cards, setCards] = useState<AssistantCard[]>([]),
    [plan, setPlan] = useState<AssistantPlan | null>(null),
    [panel, setPanel] = useState(false),
    [keyboard, setKeyboard] = useState(false),
    [consent, setConsent] = useState<Consent | null>(null),
    [consentBusy, setConsentBusy] = useState(false);
  const audio = useRef<VoiceAudio | null>(null),
    pendingPlan = useRef<AssistantPlan | null>(null),
    opened = useRef(false),
    session = useRef(""),
    queue = useRef<Promise<void>>(Promise.resolve()),
    background = useRef(false),
    voiceSession = useRef(""),
    lastMessage = useRef<AssistantMessage | null>(null),
    requestAbort = useRef<AbortController | null>(null),
    actor = useRef(""),
    previousFocus = useRef<HTMLElement | null>(null),
    voiceStarted = useRef(0),
    turnStarted = useRef(0);
  const api = useCallback(
    async (path: string, body?: unknown) => {
      if (!user) throw new Error("Autentificare necesară.");
      const r = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: "Bearer " + (await user.getIdToken()),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Cererea nu a fost confirmată.");
      return data;
    },
    [user],
  );
  const platform = () =>
    window.imodeusDesktop
      ? "electron"
      : window.innerWidth < 768
        ? "mobile"
        : "web";
  const metric = (fields: Record<string, number>) => {
    void api("/api/ai-assistant/voice", {
      kind: "metrics",
      voiceSessionId: voiceSession.current,
      platform: platform(),
      ...fields,
    }).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setEnabled(false);
    });
    if (user && agencyId)
      api("/api/ai-assistant/voice")
        .then((r) => {
          if (active) setEnabled(r.enabled === true);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, agencyId, api]);
  const close = useCallback(() => {
    if (
      opened.current &&
      voiceStarted.current &&
      actor.current === user?.uid + ":" + agencyId
    )
      void api("/api/ai-assistant/voice", {
        kind: "metrics",
        voiceSessionId: voiceSession.current,
        platform: window.imodeusDesktop
          ? "electron"
          : window.innerWidth < 768
            ? "mobile"
            : "web",
        sessionSeconds: Math.min(
          86400,
          (voiceTimestamp() - voiceStarted.current) / 1000,
        ),
      }).catch(() => {});
    opened.current = false;
    audio.current?.close();
    audio.current = null;
    requestAbort.current?.abort();
    setOpen(false);
    setLevel(0);
    setMicMuted(false);
    setSpeakerMuted(false);
    setConsent(null);
    previousFocus.current?.focus();
    window.dispatchEvent(new Event("jarvis:voice-closed"));
  }, [api, user?.uid, agencyId]);
  useEffect(
    () => () => {
      opened.current = false;
      audio.current?.close();
      requestAbort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (open && actor.current !== user?.uid + ":" + agencyId) close();
  }, [user?.uid, agencyId, open, close]);
  async function speak(
    message: AssistantMessage,
    p: AssistantPlan | null,
    epoch: number,
  ) {
    const result = presentVoice(message, p || undefined);
    setCards(result.visualPayload);
    if (result.visualPayload.length || p) setPanel(true);
    if (audio.current?.epoch === epoch) {
      setGesture(result.gestureHint);
      setState(result.characterState);
    }
    if (
      !opened.current ||
      audio.current?.epoch !== epoch ||
      audio.current?.speakerMuted
    )
      return;
    const controller = new AbortController();
    audio.current!.playbackAbort = controller;
    const start = voiceTimestamp();
    const response = await fetch("/api/ai-assistant/voice", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + (await user!.getIdToken()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: result.spokenText,
        voiceSessionId: voiceSession.current,
        platform: platform(),
      }),
      signal: controller.signal,
    });
    if (!opened.current || audio.current?.epoch !== epoch) {
      controller.abort();
      return;
    }
    await audio.current!.play(response, controller, () => {
      setState("SPEAKING");
      metric({
        firstAudioMs: voiceTimestamp() - start,
        ...(turnStarted.current
          ? { turnToAudioMs: voiceTimestamp() - turnStarted.current }
          : {}),
        spokenWords: result.spokenText.split(/\s+/).length,
      });
    });
    if (opened.current && audio.current?.epoch === epoch)
      setState(p && p.status === "pending" ? "AWAITING_CONFIRMATION" : "IDLE");
  }
  async function approve(cancel = false) {
    const p = pendingPlan.current,
      active = voiceSession.current;
    if (!p || p.status !== "pending") return;
    pendingPlan.current = null;
    setState("WORKING");
    try {
      const response = await api("/api/ai-assistant/workspace", {
        kind: cancel ? "cancel" : "execute",
        planId: p.id,
      });
      if (!opened.current || active !== voiceSession.current) return;
      setPlan(response.plan);
      if (response.plan.status === "pending")
        pendingPlan.current = response.plan;
      await speak(
        lastMessage.current || {
          id: "result",
          role: "assistant",
          text: "",
          createdAt: new Date().toISOString(),
        },
        response.plan,
        audio.current!.epoch,
      );
    } catch (e) {
      if (opened.current && active === voiceSession.current) {
        try {
          const checked = (
            await api("/api/ai-assistant/workspace?planId=" + p.id)
          ).plan;
          setPlan(checked);
          if (checked.status === "pending") pendingPlan.current = checked;
        } catch {}
        setState("ERROR");
        setError(
          "Execuția necesită verificare. Nu repeta comanda înainte de verificarea rezultatului.",
        );
      }
      throw e;
    }
  }

  function command(prompt: string, epoch = audio.current?.epoch || 0) {
    const active = voiceSession.current,
      approvalId = pendingPlan.current?.id;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!opened.current || active !== voiceSession.current) return;
        try {
          const intent = confirmationIntent(prompt);
          if (
            intent &&
            pendingPlan.current &&
            approvalId === pendingPlan.current.id
          ) {
            await approve(intent === "no");
            return;
          }
          if (intent && !approvalId) {
            await speak(
              {
                id: "approval",
                role: "assistant",
                text: "Verifică mai întâi un plan în panou înainte de confirmare.",
                createdAt: new Date().toISOString(),
              },
              null,
              epoch,
            );
            return;
          }
          setState("PROCESSING");
          setError("");
          const started = voiceTimestamp();
          const response = await existingJarvisCommand(
            api,
            {
              sessionId: session.current,
              requestId: crypto.randomUUID(),
              prompt,
            },
            background.current,
          );
          if (!opened.current || active !== voiceSession.current) return;
          metric({ jarvisMs: voiceTimestamp() - started });
          storeJarvisSession(user!.uid, agencyId!, session.current);
          lastMessage.current = response.message;
          let p = null;
          if (response.message.planId)
            p = (
              await api(
                "/api/ai-assistant/workspace?planId=" + response.message.planId,
              )
            ).plan;
          pendingPlan.current = p?.status === "pending" ? p : null;
          setPlan(p);
          await speak(response.message, p, epoch);
        } catch (e) {
          if (
            opened.current &&
            active === voiceSession.current &&
            !(e instanceof DOMException && e.name === "AbortError")
          ) {
            setState("ERROR");
            setError(
              e instanceof Error ? e.message : "Cererea nu a fost confirmată.",
            );
          }
        }
      });
  }
  function cardQuery(card: AssistantCard, crm: boolean) {
    const active = voiceSession.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (!opened.current || active !== voiceSession.current) return;
        const response = await api(
          "/api/ai-assistant/workspace",
          card.search
            ? {
                kind: "search",
                sessionId: session.current,
                requestId: crypto.randomUUID(),
                query: {
                  ...card.search,
                  ...(crm
                    ? { source: "crm", cursor: undefined }
                    : { cursor: card.nextCursor }),
                },
              }
            : {
                kind: "query",
                query: { ...card.query, cursor: card.nextCursor },
              },
        );
        if (!opened.current || active !== voiceSession.current) return;
        if (response.message) {
          lastMessage.current = response.message;
          storeJarvisSession(user!.uid, agencyId!, session.current);
          await speak(response.message, null, audio.current!.epoch);
        } else {
          setCards((old) =>
            old.map((c) =>
              c === card
                ? { ...c, ...response, rows: [...c.rows, ...response.rows] }
                : c,
            ),
          );
        }
      })
      .catch((e) => {
        if (opened.current) setError(e.message);
      });
  }
  async function capture(blob: Blob, epoch: number) {
    if (!opened.current || consent) return;
    turnStarted.current = voiceTimestamp();
    const active = voiceSession.current;
    setState("FINALIZING_SPEECH");
    const controller = new AbortController();
    requestAbort.current = controller;
    try {
      const r = await fetch("/api/ai-assistant/voice", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + (await user!.getIdToken()),
          "Content-Type": "audio/wav",
          "X-Voice-Session-Id": voiceSession.current,
          "X-Voice-Platform": platform(),
        },
        body: blob,
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "Nu te-am auzit bine. Mai spune o dată.");
      if (
        data.text &&
        opened.current &&
        active === voiceSession.current &&
        audio.current?.epoch === epoch
      )
        command(data.text, epoch);
      else if (opened.current) setState("LISTENING");
    } catch (e) {
      if (
        opened.current &&
        !(e instanceof DOMException && e.name === "AbortError")
      ) {
        setError("Nu te-am auzit bine. Mai spune o dată.");
        setState("ERROR");
      }
    }
  }
  async function connect() {
    audio.current?.close();
    const engine = new VoiceAudio(
      capture,
      (interrupted) => {
        if (interrupted) metric({ interruptions: 1 });
        requestAbort.current?.abort();
        setState("LISTENING");
        setError("");
      },
      (value) => setLevel(value),
      (message) => {
        setState("ERROR");
        setError(message);
      },
    );
    audio.current = engine;
    try {
      await engine.start();
      if (opened.current) {
        engine.setMicMuted(micMuted);
        engine.speakerMuted = speakerMuted;
        setError('');
        setState("LISTENING");
      }
    } catch {}
  }
  async function toggle() {
    if (opened.current) {
      close();
      return;
    }
    if (!enabled || !user || !agencyId) return;
    previousFocus.current = document.activeElement as HTMLElement;
    voiceStarted.current = voiceTimestamp();
    actor.current = user.uid + ":" + agencyId;
    const shared = activeJarvisSession(user.uid, agencyId);
    session.current = shared.id;
    voiceSession.current = crypto.randomUUID();
    opened.current = true;
    setOpen(true);
    setState("LISTENING");
    setCards([]);
    setPlan(null);
    pendingPlan.current = null;
    setPanel(false);
    setError("");
    void api("/api/ai-assistant/workspace")
      .then((r) => {
        background.current = r.backgroundConfigured === true;
      })
      .catch(() => {});
    if (shared.hasHistory) {
      const active = voiceSession.current,
        initialEpoch = audio.current?.epoch || 0;
      void api(
        "/api/ai-assistant/workspace?sessionId=" +
          encodeURIComponent(shared.id),
      )
        .then(async (r) => {
          if (!opened.current || active !== voiceSession.current) return;
          const recent = r.messages
            ?.filter((m: AssistantMessage) => m.role === "assistant")
            .at(-1);
          if (!recent || (audio.current?.epoch || 0) !== initialEpoch) return;
          lastMessage.current = recent;
          setCards(recent.cards || []);
          if (recent.planId) {
            const loaded = (
              await api("/api/ai-assistant/workspace?planId=" + recent.planId)
            ).plan;
            if (!opened.current || active !== voiceSession.current) return;
            setPlan(loaded);
            pendingPlan.current = loaded.status === "pending" ? loaded : null;
          }
          setPanel(Boolean(recent.cards?.length || recent.planId));
        })
        .catch(() => {});
    }
    await connect();
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && opened.current) {
        e.preventDefault();
        if (consent) setConsent(null);
        else close();
      } else if (
        e.ctrlKey &&
        e.code === "Space" &&
        !e.repeat &&
        !e.isComposing &&
        !editableTarget(e.target) &&
        !editableTarget(document.activeElement)
      ) {
        e.preventDefault();
        void toggle();
      }
    };
    const launch = () => {
      if (!opened.current) void toggle();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("jarvis:open-voice", launch);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("jarvis:open-voice", launch);
    };
  });
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      setKeyboard(
        Boolean(
          viewport &&
            window.innerHeight - viewport.height > 180 &&
            editableTarget(document.activeElement),
        ),
      );
    viewport?.addEventListener("resize", resize);
    return () => viewport?.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        audio.current?.setMicMuted(true);
        audio.current?.interrupt();
        setMicMuted(true);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);
  useEffect(() => {
    if (consent) {
      audio.current?.setMicMuted(true);
      audio.current?.interrupt();
    } else audio.current?.setMicMuted(micMuted);
  }, [consent, micMuted]);
  if (!enabled) return null;
  const expression: Expression =
    state === "ERROR"
      ? "CONCERNED"
      : state === "PROCESSING"
        ? "THOUGHTFUL"
        : state === "LISTENING"
          ? "ATTENTIVE"
          : state === "AWAITING_CONFIRMATION"
            ? "CONFIRMING"
            : state === "SUCCESS"
              ? "SUCCESS"
              : "NEUTRAL_FRIENDLY";
  return (
    <>
      {!open && !keyboard && (
        <button
          type="button"
          aria-label="Deschide Jarvis Voice"
          title="Jarvis Voice · Ctrl + Space"
          onClick={() => void toggle()}
          className="jarvis-launcher fixed right-4 z-40 grid h-16 w-16 place-items-center rounded-full border border-cyan-200 bg-white/90 shadow-xl backdrop-blur-md outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 md:bottom-6"
        >
          <JarvisCharacter mini />
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jarvis Voice"
          className="fixed inset-0 z-[80] flex flex-col bg-[radial-gradient(ellipse_at_40%_30%,#e1fcff_0%,#f7f8ff_45%,#fff4ed_100%)] dark:bg-slate-950"
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              const nodes = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href]",
                ),
              );
              const first = nodes[0],
                last = nodes.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <header className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="font-semibold tracking-tight">Jarvis Voice</p>
              <p className="text-xs text-slate-500">
                Voce generată de AI · același Jarvis
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={panel ? "Închide panoul" : "Deschide panoul"}
                onClick={() => setPanel(!panel)}
              >
                {panel ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
              <Button
                autoFocus
                variant="ghost"
                size="icon"
                aria-label="Închide Jarvis Voice"
                onClick={close}
              >
                <X />
              </Button>
            </div>
          </header>
          <div className="relative flex min-h-0 flex-1">
            <main
              className={
                "flex min-w-0 flex-1 flex-col items-center px-5 " +
                (panel
                  ? "justify-start gap-4 pt-3 md:justify-center md:gap-8 md:pb-20"
                  : "justify-center gap-8 pb-20")
              }
            >
              <JarvisCharacter
                state={state}
                expression={expression}
                gesture={gesture}
                audioLevel={level}
                panelOpen={panel}
              />
              <p
                aria-live="polite"
                className="max-w-sm text-center text-sm text-slate-600"
              >
                {error || (micMuted ? "Microfon oprit." : stateText[state])}
              </p>
              {error && /microfon|auzit|deconectat/i.test(error) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setState("RECONNECTING");
                    void connect();
                  }}
                >
                  Permite microfonul / Reîncearcă
                </Button>
              )}
            </main>
            {panel && (
              <aside
                aria-label="Rezultate CRM"
                className="absolute bottom-0 left-0 right-0 z-10 max-h-[48%] overflow-y-auto rounded-t-3xl border bg-white/95 p-4 shadow-2xl backdrop-blur-md md:static md:max-h-none md:w-[390px] md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">Rezultate CRM</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Restrânge rezultatele"
                    onClick={() => setPanel(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {plan && (
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <h3 className="font-semibold">
                      {plan.status === "pending"
                        ? "Confirmă planul"
                        : "Rezultatul planului"}
                    </h3>
                    {plan.risks?.length && (
                      <p className="mt-2 text-xs text-slate-500">
                        Risc pe pași: {plan.risks.join(", ")}.
                      </p>
                    )}
                    {plan.externalCostNote && (
                      <p className="mt-2 text-xs text-amber-700">
                        {plan.externalCostNote}
                      </p>
                    )}
                    {plan.actions.map((action, i) => (
                      <div
                        key={i}
                        className="my-3 rounded-xl border bg-white p-3"
                      >
                        <p className="text-xs text-slate-500">Pasul {i + 1}</p>
                        <ActionPreview
                          action={action}
                          resolveName={(id) =>
                            String(
                              cards
                                .flatMap((c) => c.rows)
                                .find((r) => r.id === id)?.title || id,
                            )
                          }
                        />
                      </div>
                    ))}
                    {plan.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            queue.current = queue.current
                              .then(() => approve())
                              .catch((e) => setError(e.message));
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Confirmă
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            queue.current = queue.current
                              .then(() => approve(true))
                              .catch((e) => setError(e.message));
                          }}
                        >
                          Anulează
                        </Button>
                      </div>
                    )}
                    {plan.results?.map((step, i) => {
                      const result = step.result as
                          | Record<string, unknown>
                          | undefined,
                        href = result?.link;
                      return (
                        <div
                          key={i}
                          className="my-2 rounded-xl border bg-white p-3 text-sm"
                        >
                          <p>Pasul {i + 1}: confirmat</p>
                          {typeof href === "string" &&
                            href.startsWith("/") &&
                            !href.startsWith("//") && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 underline"
                              >
                                Deschide rezultatul
                              </a>
                            )}
                        </div>
                      );
                    })}
                    {plan.status !== "pending" && (
                      <p className="text-sm">
                        {plan.status === "completed"
                          ? "Execuție confirmată."
                          : plan.status === "cancelled"
                            ? "Plan anulat."
                            : "Verifică rezultatul în modul text înainte de repetare."}
                      </p>
                    )}
                  </section>
                )}
                {cards.map((card, i) => (
                  <AssistantResultCard
                    key={i}
                    card={card}
                    busy={state === "PROCESSING" || state === "WORKING"}
                    onPrompt={command}
                    onPrepare={(actions: AssistantAction[]) => {
                      const active = voiceSession.current;
                      queue.current = queue.current
                        .then(async () => {
                          if (
                            !opened.current ||
                            active !== voiceSession.current
                          )
                            return;
                          const r = await api("/api/ai-assistant/workspace", {
                            kind: "prepare",
                            sessionId: session.current,
                            requestId: crypto.randomUUID(),
                            actions,
                          });
                          if (
                            !opened.current ||
                            active !== voiceSession.current
                          )
                            return;
                          storeJarvisSession(
                            user!.uid,
                            agencyId!,
                            session.current,
                          );
                          lastMessage.current = r.message;
                          const p = (
                            await api(
                              "/api/ai-assistant/workspace?planId=" +
                                r.message.planId,
                            )
                          ).plan;
                          pendingPlan.current = p;
                          setPlan(p);
                          await speak(r.message, p, audio.current!.epoch);
                        })
                        .catch((e) => setError(e.message));
                    }}
                    onConsent={(row) => {
                      const active = voiceSession.current;
                      setConsentBusy(true);
                      void loadOwnerConsent(api, row)
                        .then((c) => {
                          if (opened.current && active === voiceSession.current)
                            setConsent(c);
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setConsentBusy(false));
                    }}
                    onContinue={() => cardQuery(card, false)}
                    onCrm={() => cardQuery(card, true)}
                    onArtifact={(row) => {
                      if (row.artifactId) {
                        void (async () => {
                          const r = await fetch(
                            "/api/ai-assistant/artifacts/" +
                              encodeURIComponent(String(row.artifactId)),
                            {
                              headers: {
                                Authorization:
                                  "Bearer " + (await user!.getIdToken()),
                              },
                            },
                          );
                          if (!r.ok) throw new Error("Document indisponibil.");
                          const url = URL.createObjectURL(await r.blob());
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = String(row.fileName || "document.pdf");
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        })().catch((e) => setError(e.message));
                      } else if (row.link && String(row.link).startsWith("/"))
                        window.open(String(row.link), "_blank", "noopener");
                    }}
                  />
                ))}
              </aside>
            )}
          </div>
          <footer
            className="flex shrink-0 items-center justify-center gap-3 border-t bg-white/60 px-4 py-4 backdrop-blur-md"
            style={{
              paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <Button
              variant="outline"
              size="icon"
              aria-label={
                micMuted ? "Pornește microfonul" : "Oprește microfonul"
              }
              onClick={() => {
                audio.current?.setMicMuted(!micMuted);
                setMicMuted(!micMuted);
              }}
            >
              {micMuted ? <MicOff /> : <Mic />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={speakerMuted ? "Pornește sunetul" : "Oprește sunetul"}
              onClick={() => {
                if (audio.current) {
                  audio.current.speakerMuted = !speakerMuted;
                  audio.current.interrupt();
                }
                setSpeakerMuted(!speakerMuted);
                setState(
                  pendingPlan.current ? "AWAITING_CONFIRMATION" : "LISTENING",
                );
              }}
            >
              {speakerMuted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button variant="outline" onClick={close}>
              <Keyboard className="mr-2 h-4 w-4" />
              Înapoi la text
            </Button>
          </footer>
        </div>
      )}
      <OwnerConsentDialog
        consent={consent}
        setConsent={setConsent}
        busy={consentBusy}
        error={error}
        saveConsent={() => {
          if (!consent) return;
          setConsentBusy(true);
          const active = voiceSession.current;
          void api("/api/ai-assistant/owner-consent", consentPayload(consent))
            .then((r) => {
              if (!opened.current || active !== voiceSession.current) return;
              setConsent(null);
              command(
                "Verifică șabloanele aprobate și pregătește un mesaj pentru conversația " +
                  r.conversationId,
              );
            })
            .catch((e) => setError(e.message))
            .finally(() => setConsentBusy(false));
        }}
      />
    </>
  );
}
