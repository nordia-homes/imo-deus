"use client";
import { useEffect, useRef } from "react";
import type {
  CharacterState,
  Expression,
  Gesture,
} from "@/lib/jarvis-voice/presentation";
import "./character.css";
const parts = {
  body: [0, 0, 390, 390],
  leftArm: [390, 80, 245, 275],
  rightArm: [730, 115, 210, 250],
  leftFoot: [975, 215, 255, 150],
  rightFoot: [50, 530, 220, 155],
  leftEye: [340, 420, 280, 280],
  rightEye: [620, 420, 290, 280],
  leftIris: [940, 420, 290, 285],
  rightIris: [20, 710, 300, 285],
  leftPupil: [360, 740, 230, 230],
  rightPupil: [650, 740, 240, 230],
  leftLid: [0, 990, 340, 240],
  rightLid: [900, 720, 350, 245],
  mouth: [420, 1080, 180, 100],
  antenna: [635, 975, 343, 279],
  glow: [970, 960, 280, 280],
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
        backgroundImage: "url(/jarvis/rig-atlas.png)",
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
        140,
      );
      root.current?.style.setProperty(
        "--gaze",
        `${panelOpen ? Math.random() * 4 : Math.random() * 3 - 1.5}px`,
      );
      timer = setTimeout(blink, 2500 + Math.random() * 3500);
    };
    timer = setTimeout(blink, 3200);
    return () => {
      clearTimeout(timer);
      clearTimeout(end);
    };
  }, [mini, panelOpen]);
  useEffect(() => {
    root.current?.style.setProperty(
      "--mouth",
      String(
        state === "SPEAKING"
          ? Math.max(0.12, Math.min(1, audioLevel * 4))
          : 0.4,
      ),
    );
    root.current?.style.setProperty(
      "--energy",
      String(Math.min(0.015, audioLevel * 0.025)),
    );
  }, [state, audioLevel]);
  return (
    <div
      ref={root}
      role="img"
      aria-label="Jarvis, personaj pufos alb și cyan"
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
        <Texture part="leftFoot" className="jarvis-foot jarvis-foot-left" />
        <Texture part="rightFoot" className="jarvis-foot jarvis-foot-right" />
        <Texture part="body" className="jarvis-body" />
        <Texture part="antenna" className="jarvis-antenna" />
        <Texture part="glow" className="jarvis-glow" />
        <Texture part="leftArm" className="jarvis-arm jarvis-arm-left" />
        <Texture part="rightArm" className="jarvis-arm jarvis-arm-right" />
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
