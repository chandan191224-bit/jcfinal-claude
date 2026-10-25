import React, { useMemo } from "react";
import { HIGHLIGHT_STYLES } from "../src/map/highlightStyles";
import { ROUTE_STYLES } from "../src/map/overlays";
import { VEHICLES } from "../src/map/icons";
import { LOCATION_CARD_STYLES } from "../src/ui/Overlays2D";
import { EASES, presetKeys } from "../src/lib/keyframes";
import { FORMATS, zRouteMode, type FormatName } from "../src/lib/schema";
import { THEMES, THEME_NAMES } from "../src/lib/themes";
import { ANCHORS } from "../src/scenes/composer/MapComposer";
import { FOLDERS, TEMPLATES, TEMPLATE_BY_ID } from "../src/registry";
import { FPS, LAYER_META, addKeyAt, clamp, fmtTime, humanize, layerDuration, r3, sceneSettings, type CamKey, type FieldId, type Layer, type Project } from "./model";
import { ColorInput, Field, Icon, LAYER_ICON, NumberInput, Seg, Select, Slider, Toggle } from "./ui";
import { PlaceInput, PlaceList } from "./PlaceInput";
import { MediaField, type MediaFieldKind } from "./Media";
import { BASE_KEYS, SchemaForm } from "./SchemaForm";
import type { Sel } from "./Timeline";

type Update = (fn: (p: Project) => Project, tag?: string) => void;

const MODES = zRouteMode.options;
const SIZE_MAX: Partial<Record<Layer["type"], number>> = { text: 400, "map-label": 200, pin: 200, radar: 300, route: 200, arrow: 200, image: 1920, video: 1920, flag: 800 };
const MEDIA_KIND: Partial<Record<Layer["type"], MediaFieldKind>> = { "region-media": "region", image: "image", video: "video", callout: "visual", flag: "flag", sfx: "sound" };
const ANCHOR_ARROWS: Record<string, string> = { "top-left": "↖", top: "↑", "top-right": "↗", left: "←", center: "•", right: "→", "bottom-left": "↙", bottom: "↓", "bottom-right": "↘" };

const AnchorPicker: React.FC<{ value: string; onChange: (v: (typeof ANCHORS)[number]) => void }> = ({ value, onChange }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 34px)", gap: 4 }}>
    {(["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const).map((a) => (
      <button key={a} type="button" className={`btn sm icon ${value === a ? "on" : ""}`} style={{ width: 34, height: 28 }} onClick={() => onChange(a)} title={a}>
        {ANCHOR_ARROWS[a]}
      </button>
    ))}
  </div>
);

/* ---------- layer ---------- */

const LayerFields: React.FC<{ l: Layer; set: (patch: Partial<Layer>, tag?: string) => void }> = ({ l, set }) => {
  const meta = LAYER_META[l.type];
  const field = (id: FieldId, label?: string, hint?: string): React.ReactNode => {
    const L = label ?? humanize(id);
    switch (id) {
      case "place":
        return (
          <Field label={L} hint={hint}>
            <PlaceInput value={l.places[0] ?? ""} onChange={(v) => set({ places: [v, ...l.places.slice(1)] })} kinds={l.type === "flag" ? ["country"] : undefined} />
          </Field>
        );
      case "places":
        return (
          <Field label={L} hint={hint}>
            <PlaceList value={l.places} onChange={(v) => set({ places: v })} min={l.type === "route" || l.type === "arrow" ? 2 : 1} addLabel={l.type === "route" ? "Add stop" : "Add point"} />
          </Field>
        );
      case "level":
        return (
          <Field label="Area type" hint={l.level === "auto" ? "Auto picks a country, then a state, then a radius around a place" : undefined}>
            <Seg options={["auto", "country", "state", "radius"] as const} value={l.level} onChange={(v) => set({ level: v })} />
          </Field>
        );
      case "radiusKm":
        return l.level === "radius" || l.level === "auto" ? <Slider label="Radius (km, for radius areas)" value={l.radiusKm} min={0} max={3000} step={5} onChange={(v) => set({ radiusKm: v }, "radius")} /> : null;
      case "highlightStyle":
        return (
          <Field label={L}>
            <Select options={HIGHLIGHT_STYLES} value={l.highlightStyle} onChange={(v) => set({ highlightStyle: v })} />
          </Field>
        );
      case "routeStyle":
        return (
          <Field label={L}>
            <Select options={ROUTE_STYLES} value={l.routeStyle} onChange={(v) => set({ routeStyle: v })} />
          </Field>
        );
      case "mode":
        return (
          <Field label={L} hint={l.mode === "street" ? "Street mode asks OpenStreetMap for the exact roads (needs internet)" : l.mode === "road" || l.mode === "rail" ? "Follows real highways / railways" : undefined}>
            <Select options={MODES} value={l.mode} onChange={(v) => set({ mode: v })} />
          </Field>
        );
      case "vehicle":
        return (
          <Field label={L}>
            <Select options={VEHICLES} value={l.vehicle} onChange={(v) => set({ vehicle: v })} />
          </Field>
        );
      case "cardStyle":
        return (
          <Field label={L}>
            <Seg options={LOCATION_CARD_STYLES} value={l.cardStyle} onChange={(v) => set({ cardStyle: v })} />
          </Field>
        );
      case "pinVariant":
        return (
          <Field label={L}>
            <Seg options={["pin", "dot", "target", "flag"] as const} value={l.pinVariant} onChange={(v) => set({ pinVariant: v })} />
          </Field>
        );
      case "color":
        return (
          <Field label={label ?? "Colour"}>
            <ColorInput value={l.color} onChange={(v) => set({ color: v }, "color")} />
          </Field>
        );
      case "text":
        return (
          <Field label={L} hint={hint}>
            {l.type === "text" ? <textarea value={l.text} rows={2} onChange={(e) => set({ text: e.target.value }, "text")} /> : <input type="text" value={l.text} onChange={(e) => set({ text: e.target.value }, "text")} />}
          </Field>
        );
      case "subtext":
        return (
          <Field label={L} hint={hint}>
            <input type="text" value={l.subtext} onChange={(e) => set({ subtext: e.target.value }, "subtext")} />
          </Field>
        );
      case "media":
        return (
          <Field label={L}>
            <MediaField kind={MEDIA_KIND[l.type] ?? "visual"} value={l.media} onChange={(v) => set({ media: v })} />
          </Field>
        );
      case "wave":
        return <Toggle label={L} checked={l.wave} onChange={(v) => set({ wave: v })} />;
      case "value":
        return l.type === "sfx" ? (
          <Slider label="Volume" value={l.value} min={0} max={1} step={0.05} onChange={(v) => set({ value: v }, "value")} hint="0 = the project's sound volume" />
        ) : (
          <Field label={L}>
            <NumberInput value={l.value} onChange={(v) => set({ value: v }, "value")} />
          </Field>
        );
      case "anchor":
        return (
          <Field label={L}>
            <AnchorPicker value={l.anchor} onChange={(v) => set({ anchor: v })} />
          </Field>
        );
      case "size":
        return <Slider label={L} value={l.size} min={4} max={SIZE_MAX[l.type] ?? 400} step={1} onChange={(v) => set({ size: v }, "size")} />;
    }
  };
  return (
    <>
      {meta.fields.map(([id, label, hint]) => (
        <React.Fragment key={id}>{field(id, label, hint)}</React.Fragment>
      ))}
    </>
  );
};

const SceneFields: React.FC<{ l: Layer; set: (patch: Partial<Layer>, tag?: string) => void }> = ({ l, set }) => {
  const t = l.scene ? TEMPLATE_BY_ID.get(l.scene) : undefined;
  return (
    <>
      <Field label="Animation" hint={t?.desc}>
        <select
          value={l.scene}
          onChange={(e) => {
            const nt = TEMPLATE_BY_ID.get(e.target.value)!;
            set({ scene: nt.id, sceneProps: sceneSettings(nt), name: humanize(nt.id) });
          }}
        >
          {Object.entries(FOLDERS).map(([f, name]) => (
            <optgroup key={f} label={name}>
              {TEMPLATES.filter((x) => x.folder === f).map((x) => (
                <option key={x.id} value={x.id}>
                  {humanize(x.id)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {t ? (
        <>
          <div className="sec">
            <h3>
              Settings
              <span className="sp" />
              <button className="btn sm ghost" onClick={() => set({ sceneProps: sceneSettings(t) })} title="Back to this template's defaults">
                Reset
              </button>
            </h3>
          </div>
          <SchemaForm schema={t.schema} value={(l.sceneProps ?? {}) as Record<string, unknown>} onChange={(v) => set({ sceneProps: v }, "scene")} skip={BASE_KEYS} />
        </>
      ) : null}
    </>
  );
};

export const LayerPanel: React.FC<{ project: Project; i: number; update: Update; frame: number; setSel: (s: Sel) => void; onSplit: () => void }> = ({ project, i, update, frame, setSel, onSplit }) => {
  const l = project.layers[i];
  if (!l) return null;
  const meta = LAYER_META[l.type];
  const set = (patch: Partial<Layer>, tag?: string) => update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, ...patch } : x)) }), tag ? `${tag}:${i}` : "");
  const moveZ = (d: number) => {
    const j = i + d;
    if (j < 0 || j >= project.layers.length) return;
    update((p) => {
      const ls = [...p.layers];
      [ls[i], ls[j]] = [ls[j], ls[i]];
      return { ...p, layers: ls };
    });
    setSel({ kind: "layer", i: j, key: null });
  };
  const t = frame / FPS;
  return (
    <div className="pad">
      <div className="rowf">
        <span className={`ic g-${meta.group}`} style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name={LAYER_ICON[l.type]} size={15} />
        </span>
        <input type="text" value={l.name} onChange={(e) => set({ name: e.target.value }, "name")} aria-label="Layer name" style={{ fontWeight: 600 }} />
      </div>
      <p className="hint" style={{ marginTop: -6 }}>{meta.label} · {meta.desc}</p>
      <div className="grid3">
        <Field label="Start (s)">
          <NumberInput value={l.startSec} min={0} step={0.1} onChange={(v) => set({ startSec: r3(Math.min(v, l.endSec - 0.05)) }, "start")} />
        </Field>
        <Field label="End (s)">
          <NumberInput value={l.endSec} min={0} step={0.1} onChange={(v) => set({ endSec: r3(Math.max(v, l.startSec + 0.05)) }, "end")} />
        </Field>
        <Field label="Length">
          <NumberInput value={r3(l.endSec - l.startSec)} min={0.05} step={0.1} onChange={(v) => set({ endSec: r3(l.startSec + Math.max(0.05, v)) }, "len")} />
        </Field>
      </div>
      <div className="rowf" style={{ flexWrap: "wrap" }}>
        <button className="btn sm" onClick={() => set({ startSec: r3(t), endSec: r3(t + (l.endSec - l.startSec)) })} title="Move the layer so it starts at the playhead">
          Start at playhead
        </button>
        <button className="btn sm" onClick={onSplit} disabled={t <= l.startSec || t >= l.endSec} title="Split at the playhead (S)">
          <Icon name="split" />
          Split
        </button>
        <Toggle label="Hidden" checked={Boolean(l.hidden)} onChange={(v) => set({ hidden: v })} />
      </div>
      {l.type === "scene" ? <SceneFields l={l} set={set} /> : <LayerFields l={l} set={set} />}
      <div className="rowf" style={{ flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <button className="btn sm" onClick={() => moveZ(1)} disabled={i === project.layers.length - 1} title="Bring forward">
          <Icon name="up" />
          Forward
        </button>
        <button className="btn sm" onClick={() => moveZ(-1)} disabled={i === 0} title="Send backward">
          <Icon name="down" />
          Backward
        </button>
        <button
          className="btn sm"
          onClick={() => {
            update((p) => ({ ...p, layers: [...p.layers.slice(0, i + 1), { ...JSON.parse(JSON.stringify(l)), name: `${l.name} copy` }, ...p.layers.slice(i + 1)] }));
            setSel({ kind: "layer", i: i + 1, key: null });
          }}
          title="Duplicate (Ctrl+D)"
        >
          <Icon name="copy" />
          Duplicate
        </button>
        <button
          className="btn sm danger"
          onClick={() => {
            update((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) }));
            setSel({ kind: "none" });
          }}
          title="Delete (Del)"
        >
          <Icon name="trash" />
          Delete
        </button>
      </div>
    </div>
  );
};

/* ---------- keyframes ---------- */

const PRESETS = [
  ["pop", "Pop in"],
  ["slide-up", "Slide up"],
  ["zoom-in", "Zoom in"],
  ["spin-in", "Spin in"],
  ["fade", "Fade"],
] as const;

export const AnimatePanel: React.FC<{ project: Project; i: number; keyIndex: number | null; update: Update; frame: number; seek: (f: number) => void; setSel: (s: Sel) => void; recording: boolean; setRecording: (v: boolean) => void }> = ({
  project,
  i,
  keyIndex,
  update,
  frame,
  seek,
  setSel,
  recording,
  setRecording,
}) => {
  const l = project.layers[i];
  const order = useMemo(() => (l ? l.keys.map((k, idx) => ({ k, idx })).sort((a, b) => a.k.t - b.k.t) : []), [l]);
  if (!l) return null;
  const dur = layerDuration(l);
  const local = frame / FPS - l.startSec;
  const inside = local >= -1e-6 && local <= dur + 1e-6;
  const setKeys = (keys: Layer["keys"], tag?: string) => update((p) => ({ ...p, layers: p.layers.map((x, j) => (j === i ? { ...x, keys } : x)) }), tag);
  const movable = LAYER_META[l.type].movable;
  return (
    <div className="pad">
      <p className="hint">
        Keyframes animate <b>opacity, scale, position and rotation</b> of “{l.name}”. Times are seconds from the layer's start. With no keyframes the layer fades in and out by itself.
      </p>
      <div className="rowf" style={{ flexWrap: "wrap" }}>
        <button
          className="btn sm pri"
          disabled={!inside}
          onClick={() => {
            const r = addKeyAt(l, local);
            setKeys(r.keys);
            setSel({ kind: "layer", i, key: r.index });
          }}
          title="Add a keyframe at the playhead (K)"
        >
          <Icon name="key" />
          Add keyframe here
        </button>
        <button className={`btn sm ${recording ? "on rec" : ""}`} onClick={() => setRecording(!recording)} title="When on, dragging/scaling on the preview writes keyframes at the playhead">
          <Icon name="rec" />
          {recording ? "Recording" : "Record"}
        </button>
        {l.keys.length ? (
          <button className="btn sm ghost danger" onClick={() => setKeys([])} title="Remove all keyframes (auto fade)">
            Clear
          </button>
        ) : null}
      </div>
      {!inside ? <p className="hint">Move the playhead inside the layer ({fmtTime(l.startSec)} – {fmtTime(l.endSec)}) to add keyframes.</p> : null}
      {movable ? <p className="hint">Tip: drag the layer on the preview to move it, scroll to scale, Shift+scroll to rotate. Turn on Record to keyframe those moves.</p> : null}
      <div className="sec">
        <h3>Presets</h3>
        <div className="seg">
          {PRESETS.map(([id, name]) => (
            <button key={id} type="button" onClick={() => setKeys(presetKeys(id, Math.max(0.7, dur - 0.45)).map((k) => ({ ...k, t: r3(Math.min(k.t, dur)) })))}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="sec">
        <h3>Keyframes ({l.keys.length})</h3>
        {order.length === 0 ? <div className="empty-note">No keyframes yet.</div> : null}
        {order.map(({ k, idx }) => {
          const isSel = keyIndex === idx;
          const setK = (patch: Partial<typeof k>, tag?: string) => setKeys(l.keys.map((x, m) => (m === idx ? { ...x, ...patch } : x)), tag ? `${tag}:${i}:${idx}` : "");
          return (
            <details key={idx} className={`card2 ${isSel ? "sel" : ""}`} open={isSel}>
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  setSel({ kind: "layer", i, key: isSel ? null : idx });
                  if (!isSel) seek(Math.round((l.startSec + k.t) * FPS));
                }}
              >
                <span className="diamond-ic" />
                <span style={{ flex: 1 }}>
                  {k.t.toFixed(2)}s <span className="hint">(at {(l.startSec + k.t).toFixed(2)}s)</span>
                </span>
                <span className="hint">{k.ease}</span>
                <button
                  className="btn sm icon ghost danger"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setKeys(l.keys.filter((_, m) => m !== idx));
                    setSel({ kind: "layer", i, key: null });
                  }}
                  aria-label="Delete keyframe"
                >
                  <Icon name="trash" />
                </button>
              </summary>
              {isSel ? (
                <div className="body">
                  <div className="grid2">
                    <Field label="Time (s from start)">
                      <NumberInput value={k.t} min={0} max={dur} step={1 / FPS} onChange={(v) => setK({ t: r3(clamp(v, 0, dur)) }, "kt")} />
                    </Field>
                    <Field label="Easing in">
                      <Select options={EASES} value={k.ease} onChange={(v) => setK({ ease: v })} />
                    </Field>
                  </div>
                  <Slider label="Opacity" value={k.opacity} min={0} max={1} step={0.01} onChange={(v) => setK({ opacity: v }, "ko")} />
                  <Slider label="Scale" value={k.scale} min={0} max={5} step={0.01} onChange={(v) => setK({ scale: v }, "ks")} />
                  <div className="grid3">
                    <Field label="X (px)">
                      <NumberInput value={k.x} step={1} onChange={(v) => setK({ x: v }, "kx")} />
                    </Field>
                    <Field label="Y (px)">
                      <NumberInput value={k.y} step={1} onChange={(v) => setK({ y: v }, "ky")} />
                    </Field>
                    <Field label="Rotate (°)">
                      <NumberInput value={k.rotate} step={1} onChange={(v) => setK({ rotate: v }, "kr")} />
                    </Field>
                  </div>
                </div>
              ) : null}
            </details>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- camera ---------- */

export const CameraPanel: React.FC<{ project: Project; keyIndex: number | null; update: Update; frame: number; seek: (f: number) => void; setSel: (s: Sel) => void; onAdd: () => void }> = ({
  project,
  keyIndex,
  update,
  seek,
  setSel,
  onAdd,
}) => {
  const order = project.camera.map((k, idx) => ({ k, idx })).sort((a, b) => a.k.t - b.k.t);
  const setK = (idx: number, patch: Partial<CamKey>, tag?: string) => update((p) => ({ ...p, camera: p.camera.map((x, m) => (m === idx ? { ...x, ...patch } : x)) }), tag ? `${tag}:cam:${idx}` : "");
  return (
    <div className="pad">
      <p className="hint">Each camera keyframe frames a place at a zoom, rotation (bearing) and 3D tilt (pitch). The camera travels between them: <b>fly</b> zooms out and back in like Google Earth, <b>smooth</b> glides, <b>cut</b> jumps.</p>
      <div className="rowf">
        <button className="btn sm pri" onClick={onAdd}>
          <Icon name="camera" />
          Add camera key here
        </button>
        {project.camera.length ? (
          <button className="btn sm ghost danger" onClick={() => update((p) => ({ ...p, camera: [] }))} title="No keys = the camera frames all layers">
            Clear all
          </button>
        ) : null}
      </div>
      {!project.camera.length ? <div className="empty-note">No camera keys: the camera frames all your layers automatically.</div> : null}
      {order.map(({ k, idx }) => {
        const isSel = keyIndex === idx;
        return (
          <details key={idx} className={`card2 ${isSel ? "sel" : ""}`} open={isSel}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                setSel({ kind: "cam", key: isSel ? null : idx });
                if (!isSel) seek(Math.round(k.t * FPS));
              }}
            >
              <span className="diamond-ic" style={{ background: "#8fdbe5" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.t.toFixed(2)}s · {k.place}
              </span>
              <span className="hint">{k.move}</span>
              <button
                className="btn sm icon ghost danger"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  update((p) => ({ ...p, camera: p.camera.filter((_, m) => m !== idx) }));
                  setSel({ kind: "cam", key: null });
                }}
                aria-label="Delete camera key"
              >
                <Icon name="trash" />
              </button>
            </summary>
            {isSel ? (
              <div className="body">
                <div className="grid2">
                  <Field label="Time (s)">
                    <NumberInput value={k.t} min={0} step={0.1} onChange={(v) => setK(idx, { t: r3(Math.max(0, v)) }, "t")} />
                  </Field>
                  <Field label="Easing">
                    <Select options={EASES} value={k.ease} onChange={(v) => setK(idx, { ease: v })} />
                  </Field>
                </div>
                <Field label="Look at" hint='Place, landmark, country or "lat, lon"'>
                  <PlaceInput value={k.place} onChange={(v) => setK(idx, { place: v })} />
                </Field>
                <Slider label="Zoom" value={k.zoom} min={-1} max={14} step={0.05} onChange={(v) => setK(idx, { zoom: v }, "zoom")} hint="0 ≈ whole world · 2 ≈ a country · 5 ≈ a state · 8 ≈ a city" />
                <Slider label="Bearing (rotation °)" value={k.bearing} min={-360} max={360} step={1} onChange={(v) => setK(idx, { bearing: v }, "bearing")} />
                <Slider label="Pitch (3D tilt °)" value={k.pitch} min={0} max={60} step={1} onChange={(v) => setK(idx, { pitch: v }, "pitch")} />
                <Field label="How the camera gets here">
                  <Seg options={["fly", "smooth", "linear", "cut"] as const} value={k.move} onChange={(v) => setK(idx, { move: v })} />
                </Field>
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
};

/* ---------- project ---------- */

export const ProjectPanel: React.FC<{ project: Project; update: Update }> = ({ project, update }) => {
  const set = (patch: Partial<Project>, tag?: string) => update((p) => ({ ...p, ...patch }), tag ? `proj:${tag}` : "");
  const themeLabels = Object.fromEntries(THEME_NAMES.map((n) => [n, THEMES[n].name]));
  return (
    <div className="pad">
      <Field label="Project name">
        <input type="text" value={project.name} onChange={(e) => set({ name: e.target.value }, "name")} />
      </Field>
      <div className="grid2">
        <Field label="Frame size">
          <Select options={Object.keys(FORMATS) as FormatName[]} value={project.format} onChange={(v) => set({ format: v })} />
        </Field>
        <Field label="Length (s)">
          <NumberInput value={project.durationSec} min={0.5} max={600} step={0.5} onChange={(v) => set({ durationSec: clamp(v, 0.5, 600) }, "dur")} />
        </Field>
      </div>
      <Field label="Map look">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 5 }}>
          {THEME_NAMES.map((n) => {
            const th = THEMES[n] as unknown as { land: string; ocean: string; accent: string };
            return (
              <button key={n} type="button" className={`btn sm ${project.theme === n ? "on" : ""}`} onClick={() => set({ theme: n })} style={{ justifyContent: "flex-start", gap: 6, padding: "0 6px", minWidth: 0 }} title={themeLabels[n]}>
                <span style={{ width: 16, height: 16, borderRadius: 4, flex: "none", background: `linear-gradient(135deg, ${th.ocean} 0 50%, ${th.land} 50% 100%)`, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.15), 0 0 0 2px ${th.accent}33` }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{themeLabels[n]}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Projection">
        <Seg options={["globe", "mercator", "flat", "natural"] as const} value={project.projection} onChange={(v) => set({ projection: v })} />
      </Field>
      <Field label="Borders" hint="India view shows boundaries as officially recognised by India (Survey of India)">
        <Seg options={["india", "world"] as const} value={project.borders} onChange={(v) => set({ borders: v })} labels={{ india: "India view", world: "De facto" }} />
      </Field>
      <div className="sec">
        <h3>Map details</h3>
        <div className="grid2">
          {(
            [
              ["countryLabels", "Country names"],
              ["states", "State borders"],
              ["roads", "Highways"],
              ["rail", "Railways"],
              ["rivers", "Rivers and lakes"],
              ["graticule", "Lat/lon grid"],
            ] as const
          ).map(([k, name]) => (
            <Toggle key={k} label={name} checked={project.mapLayers[k]} onChange={(v) => set({ mapLayers: { ...project.mapLayers, [k]: v } })} />
          ))}
        </div>
      </div>
      <div className="sec">
        <h3>Sun</h3>
        <Toggle label="Real day / night shading" checked={project.dayNight} onChange={(v) => set({ dayNight: v })} />
        {project.dayNight ? (
          <Field label="Date and time (UTC)">
            <input
              type="datetime-local"
              value={(project.dateTimeUtc || "2025-06-21T06:00:00Z").slice(0, 16)}
              onChange={(e) => set({ dateTimeUtc: `${e.target.value}:00Z` })}
            />
          </Field>
        ) : null}
      </div>
      <div className="sec">
        <h3>Sound</h3>
        <Toggle label="Sound effects" checked={project.sfx} onChange={(v) => set({ sfx: v })} />
        <Slider label="Sound volume" value={project.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => set({ sfxVolume: v }, "vol")} />
      </div>
    </div>
  );
};
