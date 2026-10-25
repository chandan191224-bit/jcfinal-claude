import React, { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { MapComposer, type ComposerProps } from "../src/scenes/composer/MapComposer";
import { FPS, fmtTime, frameSize, LAYER_META, type Delta, type Layer, type Project } from "./model";
import { Icon } from "./ui";

/* ---------- the composition the preview plays ---------- */

class Boundary extends React.Component<{ resetKey: unknown; children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="err-card">
          <div>
            <div style={{ fontSize: 44, marginBottom: 12 }}>Something in this frame can't be drawn</div>
            {this.state.error.message}
            <div style={{ fontSize: 22, opacity: 0.7, marginTop: 16 }}>Fix the setting (or press Ctrl+Z) and the preview comes back.</div>
          </div>
        </div>
      );
    return this.props.children;
  }
}

export const StudioComposition: React.FC<ComposerProps> = (p) => (
  <Boundary resetKey={p}>
    <MapComposer {...p} />
  </Boundary>
);

/* ---------- stage ---------- */

export type Gesture = { phase: "start" | "move" | "end"; delta: Delta } | { phase: "wheel"; delta: Delta };

export const Stage: React.FC<{
  project: Project;
  playerRef: React.RefObject<PlayerRef | null>;
  selected: Layer | null;
  recording: boolean;
  warnings: string[];
  onGesture: (g: Gesture) => void;
  onDropFiles: (files: File[]) => void;
  loop: boolean;
}> = ({ project, playerRef, selected, recording, warnings, onGesture, onDropFiles, loop }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 640, h: 360 });
  const [cw, ch] = frameSize(project);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const s = Math.min((r.width - 16) / cw, (r.height - 16) / ch);
      setBox({ w: Math.max(80, Math.floor(cw * s)), h: Math.max(45, Math.floor(ch * s)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cw, ch]);

  const movable = Boolean(selected && LAYER_META[selected.type].movable && !selected.hidden);
  // Screen pixels → layer units (pixels of a 1080p frame).
  const toUnits = (px: number) => (px * (cw / box.w) * 1080) / ch;

  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;
  useEffect(() => {
    const el = hit.current;
    if (!el || !movable) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey || e.altKey) onGestureRef.current({ phase: "wheel", delta: { rotate: (e.deltaY || e.deltaX) * 0.12 } });
      else onGestureRef.current({ phase: "wheel", delta: { scale: Math.exp(-e.deltaY * 0.0012) } });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [movable]);

  const drag = useRef<{ x: number; y: number } | null>(null);
  const durationInFrames = Math.max(1, Math.round(project.durationSec * FPS));

  return (
    <div
      className={`stage ${dropping ? "dropping" : ""}`}
      ref={wrap}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        if (e.dataTransfer.files.length) onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="frame" style={{ width: box.w, height: box.h }}>
        <Player
          ref={playerRef}
          component={StudioComposition}
          inputProps={project}
          durationInFrames={durationInFrames}
          compositionWidth={cw}
          compositionHeight={ch}
          fps={FPS}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          loop={loop}
          acknowledgeRemotionLicense
        />
        <div
          ref={hit}
          className={`hit ${movable ? "movable" : ""}`}
          onPointerDown={(e) => {
            if (!movable || e.button !== 0) return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY };
            onGesture({ phase: "start", delta: {} });
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            onGesture({ phase: "move", delta: { dx: toUnits(e.clientX - drag.current.x), dy: toUnits(e.clientY - drag.current.y) } });
          }}
          onPointerUp={() => {
            if (!drag.current) return;
            drag.current = null;
            onGesture({ phase: "end", delta: {} });
          }}
        />
      </div>
      <div className="stage-badge">
        {selected ? <span className="badge">{selected.name}</span> : null}
        {recording ? <span className="badge rec">● Recording keyframes</span> : null}
        {warnings.map((w) => (
          <span key={w} className="badge warn" title={w}>
            ⚠ {w}
          </span>
        ))}
      </div>
      {movable ? <div className="stage-hint">Drag to move · wheel to scale · Shift+wheel to rotate</div> : null}
    </div>
  );
};

/* ---------- transport ---------- */

export const Transport: React.FC<{
  playerRef: React.RefObject<PlayerRef | null>;
  frame: number;
  playing: boolean;
  project: Project;
  loop: boolean;
  setLoop: (v: boolean) => void;
  seek: (f: number) => void;
  children?: React.ReactNode;
}> = ({ playerRef, frame, playing, project, loop, setLoop, seek, children }) => {
  const total = Math.max(1, Math.round(project.durationSec * FPS));
  const [vol, setVol] = useState(0.8);
  useEffect(() => {
    playerRef.current?.setVolume(vol);
  }, [vol, playerRef]);
  return (
    <div className="transport">
      <button className="btn icon ghost" onClick={() => seek(0)} aria-label="Go to start" title="Start (Home)">
        <Icon name="start" />
      </button>
      <button className="btn icon ghost" onClick={() => seek(Math.max(0, frame - 1))} aria-label="Previous frame" title="Previous frame (←)">
        <Icon name="prev" />
      </button>
      <button className="play" onClick={() => playerRef.current?.toggle()} aria-label={playing ? "Pause" : "Play"} title="Play / pause (Space)">
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <button className="btn icon ghost" onClick={() => seek(Math.min(total - 1, frame + 1))} aria-label="Next frame" title="Next frame (→)">
        <Icon name="next" />
      </button>
      <button className="btn icon ghost" onClick={() => seek(total - 1)} aria-label="Go to end" title="End (End)">
        <Icon name="end" />
      </button>
      <div className="tc">
        {fmtTime(frame / FPS)} <span>/ {fmtTime(project.durationSec)}</span>
      </div>
      <button className={`btn icon ghost ${loop ? "on" : ""}`} onClick={() => setLoop(!loop)} aria-label="Loop" title="Loop playback">
        <Icon name="loop" />
      </button>
      <input className="vol" type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVol(parseFloat(e.target.value))} aria-label="Preview volume" title="Preview volume" />
      <button className="btn icon ghost" onClick={() => playerRef.current?.requestFullscreen()} aria-label="Full screen" title="Full screen preview">
        <Icon name="full" />
      </button>
      <span className="sp" />
      {children}
    </div>
  );
};
