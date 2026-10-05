"use client";
import { useEffect, useRef } from "react";
import type {
  CharacterState,
  Expression,
  Gesture,
} from "@/lib/jarvis-voice/presentation";
import "./character-v2.css";
import rigAtlas from "./rig-atlas-v2.png";
import blueBody from "./blue-body.png";
const parts = {
  leftEye: [340, 420, 280, 280],
  rightEye: [620, 420, 290, 280],
  leftIris: [940, 420, 290, 285],
  rightIris: [20, 710, 300, 285],
  leftPupil: [360, 740, 230, 230],
  rightPupil: [650, 740, 240, 230],
  leftLid: [0, 990, 340, 240],
  rightLid: [900, 720, 350, 245],
  mouth: [420, 1080, 180, 100],
} as const;
function Texture({
  part,
  className,
}: {
  part: keyof typeof parts;
  className?: string;
}) {
  const [x, y, w, h] = parts[part];
  return (
    <span
      aria-hidden="true"
      data-layer={part}
      className={"jarvis-texture " + (className || "")}
      style={{
        backgroundImage: `url(${rigAtlas.src})`,
        backgroundSize: `${(1254 / w) * 100}% ${(1254 / h) * 100}%`,
        backgroundPosition: `${(x / (1254 - w)) * 100}% ${(y / (1254 - h)) * 100}%`,
      }}
    />
  );
}
export function JarvisCharacter({
  state = "IDLE",
  expression = "NEUTRAL_FRIENDLY",
  gesture = "NEUTRAL",
  audioLevel = 0,
  mini = false,
  panelOpen = false,
}: {
  state?: CharacterState;
  expression?: Expression;
  gesture?: Gesture;
  audioLevel?: number;
  mini?: boolean;
  panelOpen?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mini) return;
    let timer: ReturnType<typeof setTimeout>;
    let end: ReturnType<typeof setTimeout>;
    const blink = () => {
      if (document.hidden) {
        timer = setTimeout(blink, 5000);
        return;
      }
      root.current?.classList.add("jarvis-blink");
      end = setTimeout(
        () => root.current?.classList.remove("jarvis-blink"),
        180,
      );
      root.current?.style.setProperty(
        "--gaze",
        `${panelOpen ? Math.random() * 4 : Math.random() * 3 - 1.5}px`,
      );
      timer = setTimeout(blink, 1700 + Math.random() * 2800);
    };
    timer = setTimeout(blink, 3200);
    return () => {
      clearTimeout(timer);
      clearTimeout(end);
    };
  }, [mini, panelOpen]);
  useEffect(() => {
    if (mini || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let frame = 0;
    const look = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = root.current?.getBoundingClientRect();
        if (!bounds) return;
        const x = Math.max(
          -1,
          Math.min(
            1,
            (event.clientX - bounds.left - bounds.width / 2) / bounds.width,
          ),
        );
        const y = Math.max(
          -1,
          Math.min(
            1,
            (event.clientY - bounds.top - bounds.height / 2) / bounds.height,
          ),
        );
        root.current?.style.setProperty("--look-x", `${x * 7}px`);
        root.current?.style.setProperty("--look-y", `${y * 5}px`);
        root.current?.style.setProperty("--lean", `${x * 3}deg`);
      });
    };
    window.addEventListener("pointermove", look, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", look);
    };
  }, [mini]);
  useEffect(() => {
    root.current?.style.setProperty(
      "--mouth",
      String(
        state === "SPEAKING"
          ? Math.max(0.45, Math.min(1.65, 0.45 + audioLevel * 8))
          : 0.65,
      ),
    );
    root.current?.style.setProperty(
      "--energy",
      String(Math.min(1, audioLevel * 5)),
    );
  }, [state, audioLevel]);
  return (
    <div
      ref={root}
      role="img"
      aria-label="Jarvis, ghemotoc pufos albastru"
      data-state={state}
      data-expression={expression}
      data-gesture={gesture}
      className={
        "jarvis-character " +
        (mini ? "jarvis-mini" : "") +
        (panelOpen ? " jarvis-panel-open" : "")
      }
    >
      <div className="jarvis-pose">
        <span
          aria-hidden="true"
          data-layer="body"
          className="jarvis-texture jarvis-body"
          style={{
            backgroundImage: `url(${blueBody.src})`,
            backgroundSize: "100% 100%",
          }}
        />
        {(["left", "right"] as const).map((side) => (
          <div key={side} className={"jarvis-eye jarvis-eye-" + side}>
            <Texture
              part={side === "left" ? "leftEye" : "rightEye"}
              className="jarvis-eyeball"
            />
            <div className="jarvis-gaze">
              <Texture
                part={side === "left" ? "leftIris" : "rightIris"}
                className="jarvis-iris"
              />
              <Texture
                part={side === "left" ? "leftPupil" : "rightPupil"}
                className="jarvis-pupil"
              />
            </div>
            <Texture
              part={side === "left" ? "leftLid" : "rightLid"}
              className="jarvis-eyelid"
            />
          </div>
        ))}
        <Texture part="mouth" className="jarvis-mouth" />
      </div>
    </div>
  );
}
