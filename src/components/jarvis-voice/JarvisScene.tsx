"use client";
import { useEffect, useRef } from "react";
import type { CharacterState } from "@/lib/jarvis-voice/presentation";
import "./office-scene.css";
import officeScene from "./office-scene.png";

export function JarvisScene({
  state,
  audioLevel,
  panelOpen,
}: {
  state: CharacterState;
  audioLevel: number;
  panelOpen: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.style.setProperty(
      "--voice-energy",
      String(Math.min(1, audioLevel * 5)),
    );
  }, [audioLevel]);
  return (
    <div
      ref={root}
      className="jarvis-scene"
      data-state={state}
      data-panel={panelOpen}
      aria-hidden="true"
    >
      <div
        className="jarvis-office-plate"
        style={{ backgroundImage: `url(${officeScene.src})` }}
      />
      <div className="jarvis-stage-halo" />
      <div className="jarvis-stage-floor">
        <i />
        <i />
        <i />
      </div>
      <div className="jarvis-orbit jarvis-orbit-one" />
      <div className="jarvis-orbit jarvis-orbit-two" />
      <div className="jarvis-particles">
        {Array.from({ length: 24 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 37 + 11) % 100}%`,
              top: `${(index * 23 + 17) % 90}%`,
              animationDelay: `${-index * 0.7}s`,
              animationDuration: `${6 + (index % 5)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
