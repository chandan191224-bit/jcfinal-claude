import { FORMATS } from "../src/lib/schema";
import { evaluate, IDENTITY, type Key, type Transform } from "../src/lib/keyframes";
import { TEMPLATE_BY_ID, type TemplateDef } from "../src/registry";
import { composerSchema, layerDefaults, type CamKey, type ComposerProps, type Layer, type LAYER_TYPES } from "../src/scenes/composer/MapComposer";

export const FPS = 30;

export type LayerType = (typeof LAYER_TYPES)[number];
export type Project = ComposerProps & { name: string };
export type { Layer, CamKey, Key, Transform };
export type Group = "map" | "screen" | "audio" | "scene";

export type FieldId =
  | "place"
  | "places"
  | "level"
  | "radiusKm"
  | "highlightStyle"
  | "routeStyle"
  | "mode"
  | "vehicle"
  | "cardStyle"
  | "pinVariant"
  | "color"
  | "text"
  | "subtext"
  | "media"
  | "wave"
  | "value"
  | "anchor"
  | "size";

type Meta = {
  label: string;
  desc: string;
  group: Group;
  /** Fields the inspector shows, with an optional label of their own for this type. */
  fields: [FieldId, string?, string?][];
  defaults: Partial<Layer>;
  dur: number;
  /** Dragging on the preview moves it (x/y keyframes do something visible). */
  movable: boolean;
};

export const LAYER_META: Record<LayerType, Meta> = {
  highlight: {
    label: "Highlight area",
    desc: "Glow, outline, pulse… on a country, state or radius",
    group: "map",
    fields: [["place", "Area", 'Country, state ("Kerala", "Texas, United States") or a place for a radius'], ["level"], ["radiusKm"], ["highlightStyle", "Style"], ["color"], ["text", "Label", '"auto" = area name, empty = no label'], ["subtext", "Second line"]],
    defaults: { places: ["India"], highlightStyle: "glow", text: "auto" },
    dur: 4,
    movable: false,
  },
  "region-media": {
    label: "Flag / photo / video in area",
    desc: "Fills a country or state exactly, no spill",
    group: "map",
    fields: [["place", "Area"], ["level"], ["radiusKm"], ["media", "Fill with"], ["wave", "Waving flag"], ["color", "Outline colour"], ["text", "Label"]],
    defaults: { places: ["India"], media: "flag", level: "auto" },
    dur: 4,
    movable: true,
  },
  route: {
    label: "Route",
    desc: "Road, rail, flight or sea path that draws on",
    group: "map",
    fields: [["places", "Stops"], ["mode", "Travel by"], ["vehicle"], ["routeStyle", "Line style"], ["color"], ["size", "Vehicle size"]],
    defaults: { places: ["Delhi", "Jaipur", "Mumbai"], mode: "road", vehicle: "car", routeStyle: "glow", size: 60 },
    dur: 6,
    movable: false,
  },
  pin: {
    label: "Pin",
    desc: "Map pin, dot, target or flag marker",
    group: "map",
    fields: [["place"], ["pinVariant", "Marker"], ["text", "Label", "Empty = place name"], ["subtext", "Second line"], ["color"], ["size"]],
    defaults: { places: ["Mumbai"], size: 56, keys: [] },
    dur: 4,
    movable: true,
  },
  radar: {
    label: "Radar pulse",
    desc: "Pulsing target rings",
    group: "map",
    fields: [["place"], ["text", "Label"], ["color"], ["size"]],
    defaults: { places: ["Mumbai"], text: "MUMBAI", color: "#ff3b3b", size: 70 },
    dur: 4,
    movable: true,
  },
  callout: {
    label: "Callout box",
    desc: "Info box pointing at a place (can hold a photo)",
    group: "map",
    fields: [["place"], ["text", "Title"], ["subtext", "Text"], ["media", "Photo or video"], ["color"]],
    defaults: { places: ["Mumbai"], text: "Mumbai", subtext: "Financial capital of India" },
    dur: 4,
    movable: true,
  },
  arrow: {
    label: "Military arrow",
    desc: "Thick advancing arrow through points",
    group: "map",
    fields: [["places", "Points"], ["text", "Label"], ["color"], ["size", "Width"]],
    defaults: { places: ["Delhi", "Lucknow", "Patna"], color: "#ff3b3b", size: 60 },
    dur: 4,
    movable: false,
  },
  "map-label": {
    label: "Map label",
    desc: "Big lettering placed on the map",
    group: "map",
    fields: [["place"], ["text", "Text", "Empty = place name"], ["subtext", "Second line"], ["color"], ["size"]],
    defaults: { places: ["Mumbai"], size: 48 },
    dur: 4,
    movable: true,
  },
  text: {
    label: "Text",
    desc: "Title or caption on screen",
    group: "screen",
    fields: [["text", "Text"], ["subtext", "Second line"], ["anchor", "Position"], ["size"], ["color"]],
    defaults: { text: "YOUR TITLE", anchor: "center", size: 96 },
    dur: 3,
    movable: true,
  },
  "location-card": {
    label: "Location card",
    desc: "Name, region and coordinates card",
    group: "screen",
    fields: [["place"], ["text", "Name", "Empty = place name"], ["subtext", "Subtitle", "Empty = region and country"], ["cardStyle", "Style"], ["anchor", "Position"], ["color", "Accent"]],
    defaults: { places: ["Mumbai"], anchor: "bottom-left" },
    dur: 3.5,
    movable: true,
  },
  image: {
    label: "Image",
    desc: "Photo, logo or PNG on screen",
    group: "screen",
    fields: [["media", "Image"], ["anchor", "Position"], ["size", "Width"]],
    defaults: { media: "", anchor: "center", size: 900 },
    dur: 4,
    movable: true,
  },
  video: {
    label: "Video",
    desc: "Your footage on screen",
    group: "screen",
    fields: [["media", "Video"], ["anchor", "Position"], ["size", "Width"]],
    defaults: { media: "", anchor: "center", size: 1200 },
    dur: 5,
    movable: true,
  },
  flag: {
    label: "Waving flag",
    desc: "A country's flag, waving",
    group: "screen",
    fields: [["place", "Country"], ["media", "Or pick a flag"], ["wave", "Waving"], ["anchor", "Position"], ["size", "Width"]],
    defaults: { places: ["India"], anchor: "top-right", size: 200 },
    dur: 4,
    movable: true,
  },
  counter: {
    label: "Counter",
    desc: "Number that counts up",
    group: "screen",
    fields: [["value", "Count to"], ["text", "Label"], ["subtext", "Unit", '"km" formats distances'], ["anchor", "Corner"], ["color"]],
    defaults: { value: 1400, text: "DISTANCE", subtext: "km", anchor: "top-right" },
    dur: 3,
    movable: true,
  },
  hud: {
    label: "GPS HUD",
    desc: "Drone-style telemetry overlay",
    group: "screen",
    fields: [["places", "Path"], ["mode", "Travel by"], ["text", "Title"], ["value", "Altitude (m)"], ["color"]],
    defaults: { places: ["Delhi", "Mumbai"], mode: "flight", color: "auto" },
    dur: 5,
    movable: true,
  },
  sfx: {
    label: "Sound",
    desc: "Whoosh, impact, ping… or your own audio",
    group: "audio",
    fields: [["media", "Sound"], ["value", "Volume (0 = project volume)"]],
    defaults: { media: "whoosh", value: 0 },
    dur: 1.5,
    movable: false,
  },
  scene: {
    label: "Scene",
    desc: "A whole ready-made animation",
    group: "scene",
    fields: [],
    defaults: {},
    dur: 8,
    movable: true,
  },
};

export const LAYER_ORDER: LayerType[] = ["highlight", "region-media", "route", "pin", "radar", "callout", "arrow", "map-label", "text", "location-card", "image", "video", "flag", "counter", "hud", "sfx", "scene"];

export const groupOf = (l: Layer): Group => LAYER_META[l.type].group;

export const round = (v: number, step = 1 / FPS) => Math.round(v / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const humanize = (id: string) => {
  const s = id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const frameSize = (p: Pick<Project, "format">) => FORMATS[p.format] ?? FORMATS["16:9 1080p"];

export const isComposerTemplate = (t: TemplateDef) => t.schema === (composerSchema as unknown);

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const composerDefaults = () => clone(TEMPLATE_BY_ID.get("MapComposer")!.defaultProps) as ComposerProps;

export const exampleProject = (): Project => ({ ...composerDefaults(), name: "Delhi to Mumbai" });

export const blankProject = (): Project => ({
  ...composerDefaults(),
  name: "Untitled map",
  durationSec: 10,
  camera: [
    { t: 0, place: "India", zoom: 2.2, bearing: 0, pitch: 0, move: "cut", ease: "linear" },
    { t: 10, place: "India", zoom: 2.5, bearing: 0, pitch: 0, move: "smooth", ease: "linear" },
  ],
  layers: [],
});

/** Template settings a scene layer stores; frame size and length come from the project and layer. */
export const sceneSettings = (t: TemplateDef) => {
  const p = clone(t.defaultProps) as Record<string, unknown>;
  delete p.format;
  delete p.durationSec;
  return p;
};

export const templateDuration = (t: TemplateDef) => Number((t.defaultProps as { durationSec?: number }).durationSec ?? 8);

export const sceneLayer = (t: TemplateDef, startSec: number, dur = templateDuration(t)): Layer =>
  layerDefaults({ type: "scene", name: humanize(t.id), startSec, endSec: r3(startSec + dur), scene: t.id, sceneProps: sceneSettings(t) });

export const projectFromTemplate = (t: TemplateDef): Project => {
  if (isComposerTemplate(t)) return { ...(clone(t.defaultProps) as ComposerProps), name: humanize(t.id) };
  const d = t.defaultProps as { format: Project["format"] };
  const dur = templateDuration(t);
  return { ...blankProject(), name: humanize(t.id), format: d.format, durationSec: dur, camera: [], layers: [sceneLayer(t, 0, dur)] };
};

export const newLayer = (type: LayerType, startSec: number, extra: Partial<Layer> = {}): Layer => {
  const m = LAYER_META[type];
  if (type === "scene") {
    const t = TEMPLATE_BY_ID.get(String(extra.scene ?? "FlightPath"))!;
    return { ...sceneLayer(t, startSec), ...extra };
  }
  return layerDefaults({ type, name: m.label, startSec: r3(startSec), endSec: r3(startSec + m.dur), ...clone(m.defaults), ...extra });
};

/** Makes sure every layer has every field (projects from older versions or hand-written JSON). */
export const normalizeProject = (raw: Partial<Project>): Project => {
  const base = blankProject();
  const p = { ...base, ...raw } as Project;
  p.mapLayers = { ...base.mapLayers, ...(raw.mapLayers ?? {}) };
  p.layers = (raw.layers ?? []).map((l) => layerDefaults(l as Layer));
  p.camera = (raw.camera ?? []).map((c) => ({ ...base.camera[0], ...c }));
  p.projectFile = "";
  return p;
};

/** Props for the renderer: the project minus editor-only fields. */
export const renderProps = (p: Project): ComposerProps => {
  const { name, ...rest } = p;
  void name;
  return rest;
};

export const layerDuration = (l: Layer) => Math.max(0.05, l.endSec - l.startSec);

/** Opacity fade in and out, the same look a layer has with no keyframes. */
export const fadeKeys = (dur: number): Key[] => {
  const f = Math.min(0.35, dur / 2);
  const k = (t: number, opacity: number): Key => ({ t: r3(t), opacity, scale: 1, x: 0, y: 0, rotate: 0, ease: "ease-out" });
  return [k(0, 0), k(f, 1), k(dur - f, 1), k(dur, 0)];
};

export const transformAt = (l: Layer, local: number): Transform => {
  if (!l.keys.length) return { ...IDENTITY };
  return evaluate(l.keys, local, layerDuration(l));
};

export type Delta = { dx?: number; dy?: number; scale?: number; rotate?: number };

const applyDelta = (k: Key, d: Delta): Key => ({
  ...k,
  x: r3(k.x + (d.dx ?? 0)),
  y: r3(k.y + (d.dy ?? 0)),
  scale: r3(clamp(k.scale * (d.scale ?? 1), 0, 20)),
  rotate: r3(k.rotate + (d.rotate ?? 0)),
});

/**
 * Moves/scales/rotates a layer from a drag on the preview. With `record` on, the change becomes a
 * keyframe at the playhead (like After Effects' stopwatch); otherwise the whole layer shifts.
 */
export const nudgeLayer = (l: Layer, local: number, d: Delta, record: boolean): Key[] => {
  const dur = layerDuration(l);
  if (!record) return (l.keys.length ? l.keys : fadeKeys(dur)).map((k) => applyDelta(k, d));
  const t = r3(clamp(round(local), 0, dur));
  const i = l.keys.findIndex((k) => Math.abs(k.t - t) < 0.5 / FPS);
  if (i >= 0) return l.keys.map((k, j) => (j === i ? applyDelta(k, d) : k));
  const cur = transformAt(l, t);
  const nk = applyDelta({ t, ...cur, opacity: l.keys.length ? cur.opacity : 1, ease: "ease-in-out" }, d);
  return [...l.keys, nk].sort((a, b) => a.t - b.t);
};

export const addKeyAt = (l: Layer, local: number): { keys: Key[]; index: number } => {
  const dur = layerDuration(l);
  const t = r3(clamp(round(local), 0, dur));
  const existing = l.keys.findIndex((k) => Math.abs(k.t - t) < 0.5 / FPS);
  if (existing >= 0) return { keys: l.keys, index: existing };
  const cur = transformAt(l, t);
  const keys = [...l.keys, { t, ...cur, opacity: l.keys.length ? r3(cur.opacity) : 1, ease: "ease-in-out" as const }].sort((a, b) => a.t - b.t);
  return { keys, index: keys.findIndex((k) => k.t === t) };
};

export const splitLayer = (l: Layer, at: number): [Layer, Layer] | null => {
  if (at <= l.startSec + 0.05 || at >= l.endSec - 0.05) return null;
  const cut = r3(at - l.startSec);
  const a: Layer = { ...l, endSec: r3(at), keys: l.keys.filter((k) => k.t <= cut) };
  const b: Layer = { ...l, name: `${l.name} (2)`, startSec: r3(at), keys: l.keys.filter((k) => k.t >= cut).map((k) => ({ ...k, t: r3(k.t - cut) })) };
  if (l.keys.length) {
    const mid = transformAt(l, cut);
    if (!a.keys.some((k) => Math.abs(k.t - cut) < 1e-3)) a.keys = [...a.keys, { t: cut, ...mid, ease: "linear" }];
    if (!b.keys.some((k) => k.t < 1e-3)) b.keys = [{ t: 0, ...mid, ease: "linear" }, ...b.keys];
  }
  return [a, b];
};

/** Camera keyframe for "add camera key here": the previous key's framing, at time t. */
export const cameraKeyAt = (p: Project, t: number): CamKey => {
  const before = [...p.camera].sort((a, b) => a.t - b.t).filter((k) => k.t <= t);
  const prev = before[before.length - 1] ?? p.camera[0];
  return { t: r3(round(t)), place: prev?.place ?? "India", zoom: prev?.zoom ?? 2.2, bearing: prev?.bearing ?? 0, pitch: prev?.pitch ?? 0, move: "fly", ease: "ease-in-out" };
};

export const fmtTime = (sec: number) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const f = Math.floor((s - Math.floor(s)) * FPS + 1e-6);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "project";
