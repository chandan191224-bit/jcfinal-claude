import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FPS, LAYER_META, clamp, fmtTime, groupOf, r3, type Layer, type Project } from "./model";
import { GROUP_COLOR, Icon, LAYER_ICON } from "./ui";

export type Sel = { kind: "layer"; i: number; key: number | null } | { kind: "cam"; key: number | null } | { kind: "none" };

const LABEL_W = 190;
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];

type Props = {
  project: Project;
  update: (fn: (p: Project) => Project, tag?: string) => void;
  frame: number;
  seek: (frame: number) => void;
  sel: Sel;
  setSel: (s: Sel) => void;
  toolbar: React.ReactNode;
};

export const Timeline: React.FC<Props> = ({ project, update, frame, seek, sel, setSel, toolbar }) => {
  const box = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(60);
  const [fit, setFit] = useState(true);
  const [snapOn, setSnapOn] = useState(true);
  const [snapAt, setSnapAt] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const total = project.durationSec;
  const t = frame / FPS;

  const fitPps = useCallback(() => {
    const w = box.current?.clientWidth ?? 800;
    return Math.max(4, (w - LABEL_W - 36) / Math.max(1, total * 1.03));
  }, [total]);

  useLayoutEffect(() => {
    if (!fit) return;
    const apply = () => setPps(fitPps());
    apply();
    const ro = new ResizeObserver(apply);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [fit, fitPps]);

  const span = Math.max(total * 1.12, total + 1.5);
  const laneW = span * pps;

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const x = LABEL_W + t * pps;
    if (x < el.scrollLeft + LABEL_W + 10 || x > el.scrollLeft + el.clientWidth - 30) el.scrollLeft = Math.max(0, x - LABEL_W - 60);
  }, [t, pps]);

  // Ctrl/Cmd + wheel zooms around the pointer.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left - LABEL_W + el.scrollLeft;
      const at = px / pps;
      const next = clamp(pps * Math.exp(-e.deltaY * 0.002), 2, 900);
      setFit(false);
      setPps(next);
      requestAnimationFrame(() => (el.scrollLeft = at * next - (e.clientX - rect.left - LABEL_W)));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [pps]);

  /* ---------- snapping ---------- */

  const snapTargets = useCallback(
    (exclude: number | "cam" | null) => {
      const c = [0, total, t];
      project.layers.forEach((l, i) => {
        if (i === exclude) return;
        c.push(l.startSec, l.endSec);
      });
      if (exclude !== "cam") for (const k of project.camera) c.push(k.t);
      return c;
    },
    [project.layers, project.camera, total, t],
  );

  const snap = (v: number, targets: number[], alt: boolean) => {
    const q = Math.round(v * FPS) / FPS;
    if (!snapOn || alt) return { v: q, at: null as number | null };
    let best: number | null = null;
    for (const c of targets) if (Math.abs(c - v) * pps < 7 && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
    return best === null ? { v: q, at: null } : { v: best, at: best };
  };

  /* ---------- dragging ---------- */

  const drag = (e: React.PointerEvent, onMove: (dt: number, ev: PointerEvent) => void, onEnd?: () => void) => {
    e.preventDefault();
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => onMove((ev.clientX - x0) / pps, ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setSnapAt(null);
      onEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const timeAt = (clientX: number) => {
    const el = box.current!;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left - LABEL_W + el.scrollLeft) / pps, 0, span);
  };

  const seekTo = (sec: number) => seek(clamp(Math.round(sec * FPS), 0, Math.max(0, Math.round(total * FPS) - 1)));

  const onRuler = (e: React.PointerEvent) => {
    seekTo(timeAt(e.clientX));
    drag(e, (_dt, ev) => seekTo(timeAt(ev.clientX)));
  };

  const extendToFit = (tag: string) =>
    update((p) => {
      const end = Math.max(...p.layers.map((l) => l.endSec), ...p.camera.map((k) => k.t), 0);
      return end > p.durationSec + 1e-6 ? { ...p, durationSec: Math.min(600, Math.ceil(end * 10) / 10) } : p;
    }, tag);

  const onBar = (e: React.PointerEvent, i: number, mode: "move" | "l" | "r") => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSel({ kind: "layer", i, key: null });
    const l0 = project.layers[i];
    const dur = l0.endSec - l0.startSec;
    const tag = `bar:${i}:${Date.now()}`;
    const targets = snapTargets(i);
    drag(
      e,
      (dt, ev) => {
        let next: Layer;
        if (mode === "move") {
          const a = snap(l0.startSec + dt, targets, ev.altKey);
          const b = snap(l0.endSec + dt, targets, ev.altKey);
          const useB = b.at !== null && (a.at === null || Math.abs(b.v - (l0.endSec + dt)) < Math.abs(a.v - (l0.startSec + dt)));
          const s = Math.max(0, useB ? b.v - dur : a.v);
          setSnapAt(useB ? b.at : a.at);
          next = { ...l0, startSec: r3(s), endSec: r3(s + dur) };
        } else if (mode === "l") {
          const a = snap(l0.startSec + dt, targets, ev.altKey);
          const s = clamp(a.v, 0, l0.endSec - 1 / FPS);
          const d = s - l0.startSec;
          setSnapAt(a.at);
          next = { ...l0, startSec: r3(s), keys: l0.keys.map((k) => ({ ...k, t: r3(k.t - d) })) };
        } else {
          const b = snap(l0.endSec + dt, targets, ev.altKey);
          setSnapAt(b.at);
          next = { ...l0, endSec: r3(Math.max(l0.startSec + 1 / FPS, b.v)) };
        }
        update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? next : x)) }), tag);
      },
      () => extendToFit(tag),
    );
  };

  const onKey = (e: React.PointerEvent, i: number, ki: number) => {
    e.stopPropagation();
    setSel({ kind: "layer", i, key: ki });
    const l = project.layers[i];
    const k0 = l.keys[ki];
    const tag = `key:${i}:${ki}:${Date.now()}`;
    const targets = snapTargets(i);
    drag(e, (dt, ev) => {
      const a = snap(l.startSec + k0.t + dt, targets, ev.altKey);
      setSnapAt(a.at);
      const nt = r3(clamp(a.v - l.startSec, 0, l.endSec - l.startSec));
      update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, keys: x.keys.map((k, m) => (m === ki ? { ...k, t: nt } : k)) } : x)) }), tag);
    });
  };

  const onCamKey = (e: React.PointerEvent, ki: number) => {
    e.stopPropagation();
    setSel({ kind: "cam", key: ki });
    const k0 = project.camera[ki];
    const tag = `cam:${ki}:${Date.now()}`;
    const targets = snapTargets("cam");
    drag(
      e,
      (dt, ev) => {
        const a = snap(k0.t + dt, targets, ev.altKey);
        setSnapAt(a.at);
        const nt = r3(Math.max(0, a.v));
        update((p) => ({ ...p, camera: p.camera.map((k, m) => (m === ki ? { ...k, t: nt } : k)) }), tag);
      },
      () => extendToFit(tag),
    );
  };

  const onEnd = (e: React.PointerEvent) => {
    e.stopPropagation();
    const tag = `end:${Date.now()}`;
    const d0 = total;
    const targets = project.layers.map((l) => l.endSec);
    drag(e, (dt, ev) => {
      const a = snap(d0 + dt, targets, ev.altKey);
      setSnapAt(a.at);
      update((p) => ({ ...p, durationSec: r3(clamp(a.v, 0.5, 600)) }), tag);
    });
  };

  /* ---------- ruler ---------- */

  const ticks = useMemo(() => {
    const step = STEPS.find((s) => s * pps >= 64) ?? 120;
    const minor = step / 5;
    const out: { x: number; major: boolean; label: string }[] = [];
    for (let v = 0; v <= span + 1e-6; v += minor) {
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      if (!major && minor * pps < 7) continue;
      const s = Math.round(v * 100) / 100;
      out.push({ x: v * pps, major, label: step < 1 ? `${s.toFixed(1)}s` : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${s}s` });
    }
    return out;
  }, [pps, span]);

  const rows = project.layers.map((l, i) => ({ l, i })).reverse(); // top row = front-most layer
  const playX = LABEL_W + t * pps;
  const selLayer = sel.kind === "layer" ? sel.i : -1;

  const toggleHidden = (i: number) => update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x)) }));

  return (
    <div className="tlwrap" style={{ height: "100%" }}>
      <div className="tlhead">
        <span className="lbl">Timeline</span>
        {toolbar}
        <span className="sp" />
        <button className={`btn sm icon ghost ${snapOn ? "on" : ""}`} onClick={() => setSnapOn(!snapOn)} title="Snapping (hold Alt while dragging to turn it off)" aria-label="Snapping">
          <Icon name="magnet" />
        </button>
        <button
          className="btn sm icon ghost"
          onClick={() => {
            setFit(false);
            setPps((v) => clamp(v / 1.5, 2, 900));
          }}
          aria-label="Zoom out"
          title="Zoom out (Ctrl+wheel)"
        >
          <Icon name="minus" />
        </button>
        <button
          className="btn sm icon ghost"
          onClick={() => {
            setFit(false);
            setPps((v) => clamp(v * 1.5, 2, 900));
          }}
          aria-label="Zoom in"
          title="Zoom in (Ctrl+wheel)"
        >
          <Icon name="plus" />
        </button>
        <button className={`btn sm ${fit ? "on" : "ghost"}`} onClick={() => setFit(true)} title="Fit the whole project">
          Fit
        </button>
      </div>
      <div className="tl" ref={box}>
        <div className="tlinner" style={{ width: LABEL_W + laneW + 40 }}>
          <div className="trow ruler">
            <div className="tlabel" style={{ cursor: "default", color: "var(--muted)", fontSize: 11 }}>
              {fmtTime(t)}
            </div>
            <div className="lane rul" style={{ width: laneW }} onPointerDown={onRuler}>
              {ticks.map((k, i) => (
                <div key={i} className={`tick ${k.major ? "" : "minor"}`} style={{ left: k.x }}>
                  {k.major ? k.label : null}
                </div>
              ))}
              <div className="beyond" style={{ left: total * pps, width: Math.max(0, laneW - total * pps) }} />
              <div className="endh" style={{ left: total * pps }} onPointerDown={onEnd} title={`Project length ${total.toFixed(2)} s (drag to change)`} />
              <div className="ph" style={{ left: t * pps }} />
            </div>
          </div>

          <div className={`trow cam ${sel.kind === "cam" ? "sel" : ""}`}>
            <div className="tlabel" onClick={() => setSel({ kind: "cam", key: null })}>
              <span className="dot" style={{ background: "#8fdbe5" }} />
              <span className="nm">Camera</span>
              <span className="chip" style={{ padding: "0 5px" }}>{project.camera.length}</span>
            </div>
            <div
              className="lane"
              style={{ width: laneW }}
              onPointerDown={(e) => e.target === e.currentTarget && seekTo(timeAt(e.clientX))}
              onDoubleClick={(e) => {
                const at = r3(Math.round(timeAt(e.clientX) * FPS) / FPS);
                const prev = [...project.camera].sort((a, b) => a.t - b.t).filter((k) => k.t <= at).pop() ?? project.camera[0];
                update((p) => ({ ...p, camera: [...p.camera, { t: at, place: prev?.place ?? "India", zoom: prev?.zoom ?? 2.2, bearing: prev?.bearing ?? 0, pitch: prev?.pitch ?? 0, move: "fly", ease: "ease-in-out" }] }));
                setSel({ kind: "cam", key: project.camera.length });
              }}
              title="Double-click to add a camera keyframe"
            >
              <div className="beyond" style={{ left: total * pps, width: Math.max(0, laneW - total * pps) }} />
              {project.camera.map((k, ki) => (
                <div
                  key={ki}
                  className={`kf cam ${sel.kind === "cam" && sel.key === ki ? "sel" : ""}`}
                  style={{ left: k.t * pps }}
                  onPointerDown={(e) => onCamKey(e, ki)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    seekTo(k.t);
                  }}
                  title={`${k.place} · zoom ${k.zoom} · ${k.move} at ${k.t}s`}
                />
              ))}
            </div>
          </div>

          {rows.map(({ l, i }) => {
            const g = groupOf(l);
            const isSel = selLayer === i;
            return (
              <div key={i} className={`trow ${isSel ? "sel" : ""} ${l.hidden ? "off" : ""}`}>
                <div className="tlabel" onClick={() => setSel({ kind: "layer", i, key: null })} onDoubleClick={() => setRenaming(i)} title={`${LAYER_META[l.type].label} · double-click to rename`}>
                  <span className="dot" style={{ background: GROUP_COLOR[g] }} />
                  {renaming === i ? (
                    <input
                      type="text"
                      autoFocus
                      defaultValue={l.name}
                      style={{ padding: "2px 6px", height: 24 }}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, name: v } : x)) }));
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenaming(null);
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <span className="nm">{l.name || l.type}</span>
                  )}
                  <button
                    className="eye"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(i);
                    }}
                    title={l.hidden ? "Show layer" : "Hide layer"}
                    aria-label={l.hidden ? "Show layer" : "Hide layer"}
                  >
                    <Icon name={l.hidden ? "eyeoff" : "eye"} />
                  </button>
                </div>
                <div className="lane" style={{ width: laneW }} onPointerDown={(e) => e.target === e.currentTarget && (seekTo(timeAt(e.clientX)), setSel({ kind: "layer", i, key: null }))}>
                  <div className="beyond" style={{ left: total * pps, width: Math.max(0, laneW - total * pps) }} />
                  <div
                    className={`bar g-${g} ${isSel ? "sel" : ""}`}
                    style={{ left: l.startSec * pps, width: Math.max(4, (l.endSec - l.startSec) * pps) }}
                    onPointerDown={(e) => onBar(e, i, "move")}
                    title={`${l.name}: ${l.startSec.toFixed(2)}s → ${l.endSec.toFixed(2)}s`}
                  >
                    <div className="edge l" onPointerDown={(e) => onBar(e, i, "l")} />
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Icon name={LAYER_ICON[l.type]} size={12} />
                      {l.name}
                    </span>
                    <div className="edge r" onPointerDown={(e) => onBar(e, i, "r")} />
                  </div>
                  {l.keys.map((k, ki) => (
                    <div
                      key={ki}
                      className={`kf ${isSel && sel.kind === "layer" && sel.key === ki ? "sel" : ""}`}
                      style={{ left: (l.startSec + k.t) * pps }}
                      onPointerDown={(e) => onKey(e, i, ki)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        seekTo(l.startSec + k.t);
                      }}
                      title={`Keyframe at ${(l.startSec + k.t).toFixed(2)}s · opacity ${k.opacity} · scale ${k.scale} · ${k.ease}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {project.layers.length === 0 ? (
            <div className="trow" style={{ height: 60 }}>
              <div className="tlabel" />
              <div className="lane" style={{ width: laneW, display: "flex", alignItems: "center", paddingLeft: 16, color: "var(--muted)" }}>
                Add a layer from the left panel (or drop a photo or video on the preview).
              </div>
            </div>
          ) : null}
          <div className="ph" style={{ left: playX }} />
          {snapAt !== null ? <div className="snapline" style={{ left: LABEL_W + snapAt * pps }} /> : null}
        </div>
      </div>
    </div>
  );
};
