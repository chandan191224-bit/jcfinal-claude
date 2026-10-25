import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { MapView, MapOverlay, useMap } from "../../map/MapView";
import { Callout, Pin, RadarMarker, RouteLine, VehicleMarker, useRouteGeometry } from "../../map/overlays";
import { HIGHLIGHT_STYLES } from "../../map/highlightStyles";
import { highlightDefaults, useAreaHighlights, useAreaShapes } from "../../map/useAreaHighlights";
import { RegionFill, regionMediaDefaults } from "../../map/RegionFill";
import { project3D } from "../../map/routeGeometry";
import { MilitaryArrow } from "../history/HistoryScenes";
import { base, zProjection, zRouteMode, zRouteStyle, zVehicle } from "../../lib/schema";
import { THEMES, type Theme } from "../../lib/themes";
import { cam, fitCamera, flyTo, mixCamera, type Camera } from "../../lib/camera";
import { clamp, easeInOutCubic, formatKm, subsolarPoint } from "../../lib/geo";
import { evaluate, zEase, zKey, ease, type Transform } from "../../lib/keyframes";
import { usePlaces, useTrip } from "../../lib/useTrip";
import { placeSubtitle, type LonLat } from "../../lib/places";
import { fetchJson, useAsset } from "../../lib/data";
import { resolveMedia, isVideoFile } from "../../lib/media";
import { Finish } from "../../fx/Finish";
import { Sfx, SFX } from "../../fx/Sfx";
import { Counter, Hud, LocationCard, LOCATION_CARD_STYLES } from "../../ui/Overlays2D";
import { WavingFlag } from "../../ui/Flag";
import { font } from "../../lib/fonts";
import { shapePoints } from "../highlights/MapHighlights";

/* ---------------- schema ---------------- */

export const LAYER_TYPES = [
  "highlight",
  "region-media",
  "route",
  "pin",
  "radar",
  "callout",
  "arrow",
  "map-label",
  "text",
  "location-card",
  "image",
  "video",
  "flag",
  "counter",
  "hud",
  "sfx",
] as const;

export const ANCHORS = ["center", "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"] as const;

export const zLayer = z.object({
  name: z.string().describe("Shown on the Studio timeline"),
  type: z.enum(LAYER_TYPES),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  places: z.array(z.string()).describe("Area/place for map layers; all stops for routes; points for arrows; country for flags"),
  level: z.enum(["auto", "country", "state", "radius"]),
  radiusKm: z.number().min(0).max(5000),
  highlightStyle: z.enum(HIGHLIGHT_STYLES),
  routeStyle: zRouteStyle,
  mode: zRouteMode,
  vehicle: zVehicle,
  cardStyle: z.enum(LOCATION_CARD_STYLES),
  pinVariant: z.enum(["pin", "dot", "target", "flag"]),
  color: z.string().describe('CSS colour or "auto"'),
  text: z.string(),
  subtext: z.string(),
  media: z.string().describe('Image/video in public/, "flag", "flag:jp", or an SFX name for sfx layers'),
  wave: z.boolean(),
  value: z.number().describe("Counter target value"),
  anchor: z.enum(ANCHORS).describe("Screen position for text, image, video, flag, counter"),
  size: z.number().min(4).max(2000).describe("Text size, icon size or media width in pixels (at 1080p)"),
  keys: z.array(zKey).describe("Keyframes: opacity, scale, x, y, rotate over time (empty = auto fade)"),
});
export type Layer = z.infer<typeof zLayer>;

export const zCamKey = z.object({
  t: z.number().min(0).describe("Seconds"),
  place: z.string().describe('Place, landmark or "lat, lon"'),
  zoom: z.number().min(-1).max(14),
  bearing: z.number().min(-360).max(360),
  pitch: z.number().min(0).max(60),
  move: z.enum(["fly", "smooth", "linear", "cut"]).describe("How the camera travels to this keyframe"),
  ease: zEase,
});
export type CamKey = z.infer<typeof zCamKey>;

export const composerSchema = z.object({
  ...base,
  projectFile: z.string().describe("Optional JSON in public/ with { camera, layers, ... }; overrides these props (for automation)"),
  projection: zProjection,
  camera: z.array(zCamKey).describe("Camera keyframes; empty = frame all layers"),
  layers: z.array(zLayer),
  mapLayers: z.object({ countryLabels: z.boolean(), states: z.boolean(), roads: z.boolean(), rail: z.boolean(), rivers: z.boolean(), graticule: z.boolean() }),
  dayNight: z.boolean(),
  dateTimeUtc: z.string(),
});
export type ComposerProps = z.infer<typeof composerSchema>;

export const layerDefaults = (l: Partial<Layer> & Pick<Layer, "type" | "startSec" | "endSec">): Layer => ({
  name: l.type,
  places: [],
  level: "auto",
  radiusKm: 0,
  highlightStyle: "glow",
  routeStyle: "glow",
  mode: "road",
  vehicle: "car",
  cardStyle: "documentary",
  pinVariant: "pin",
  color: "auto",
  text: "",
  subtext: "",
  media: "",
  wave: true,
  value: 0,
  anchor: "center",
  size: 60,
  keys: [],
  ...l,
});

const auto = (c: string, t: string) => (!c || c === "auto" ? t : c);

/* ---------------- helpers ---------------- */

function useLayerTransform(l: Layer): { tr: Transform; local: number; dur: number } {
  const frame = useCurrentFrame(); // relative to the layer's <Sequence>
  const { fps } = useVideoConfig();
  const dur = Math.max(0.05, l.endSec - l.startSec);
  const local = frame / fps;
  return { tr: evaluate(l.keys, local, dur), local, dur };
}

const anchorStyle = (a: (typeof ANCHORS)[number], height: number): React.CSSProperties => {
  const m = height * 0.08;
  const h = a.includes("left") ? { left: m } : a.includes("right") ? { right: m } : { left: 0, right: 0, display: "flex", justifyContent: "center" };
  const v = a.startsWith("top") ? { top: m } : a.startsWith("bottom") ? { bottom: m } : { top: 0, bottom: 0, display: "flex", alignItems: "center" };
  return { position: "absolute", ...h, ...v } as React.CSSProperties;
};

const ScreenLayer: React.FC<{ l: Layer; children: React.ReactNode }> = ({ l, children }) => {
  const { height } = useVideoConfig();
  const { tr } = useLayerTransform(l);
  const u = height / 1080;
  const center = l.anchor === "center";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...anchorStyle(l.anchor, height), ...(center ? { width: "100%", height: "100%" } : {}) }}>
        <div
          style={{
            opacity: tr.opacity,
            translate: `${tr.x * u}px ${tr.y * u}px`,
            scale: String(tr.scale),
            rotate: `${tr.rotate}deg`,
            ...(center ? { margin: "auto" } : {}),
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Keyframe transform for SVG map layers, scaling around the layer's map anchor. */
const MapLayerG: React.FC<{ l: Layer; at?: LonLat | null; children: React.ReactNode }> = ({ l, at, children }) => {
  const m = useMap();
  const { height } = useVideoConfig();
  const { tr } = useLayerTransform(l);
  const q = at ? project3D(m, at) : { x: m.width / 2, y: m.height / 2 };
  const u = height / 1080;
  return (
    <g
      opacity={tr.opacity}
      transform={`translate(${tr.x * u},${tr.y * u}) translate(${q.x},${q.y}) rotate(${tr.rotate}) scale(${tr.scale}) translate(${-q.x},${-q.y})`}
    >
      {children}
    </g>
  );
};

/* ---------------- map layers ---------------- */

const PinLayer: React.FC<{ l: Layer; theme: Theme }> = ({ l, theme }) => {
  const pl = usePlaces(l.places.slice(0, 1));
  const { height } = useVideoConfig();
  if (!pl || !pl[0]) return null;
  const at: LonLat = [pl[0].lon, pl[0].lat];
  const size = l.size * (height / 1080);
  return (
    <MapLayerG l={l} at={at}>
      {l.type === "radar" ? (
        <RadarMarker at={at} color={auto(l.color, theme.accent)} size={size * 2} label={l.text} />
      ) : l.type === "callout" ? (
        <Callout at={at} title={l.text || pl[0].name} text={l.subtext} media={l.media} color={auto(l.color, theme.accent)} />
      ) : l.type === "map-label" ? (
        <MapText at={at} text={l.text || pl[0].name} sub={l.subtext} size={size} color={auto(l.color, theme.label)} theme={theme} />
      ) : (
        <Pin at={at} label={l.text === "" ? pl[0].name : l.text} sublabel={l.subtext} variant={l.pinVariant} size={size} color={auto(l.color, theme.accent)} />
      )}
    </MapLayerG>
  );
};

const MapText: React.FC<{ at: LonLat; text: string; sub: string; size: number; color: string; theme: Theme }> = ({ at, text, sub, size, color, theme }) => {
  const m = useMap();
  const q = project3D(m, at);
  return (
    <g>
      <text x={q.x} y={q.y} textAnchor="middle" fill={color} stroke={theme.labelHalo} strokeWidth={size * 0.12} paintOrder="stroke" style={{ font: `700 ${size}px ${font(theme.titleFont)}`, letterSpacing: size * 0.06 }}>
        {text}
      </text>
      {sub ? (
        <text x={q.x} y={q.y + size * 0.75} textAnchor="middle" fill={color} stroke={theme.labelHalo} strokeWidth={size * 0.08} paintOrder="stroke" style={{ font: `500 ${size * 0.45}px ${font(theme.labelFont)}` }}>
          {sub}
        </text>
      ) : null}
    </g>
  );
};

const RouteLayerC: React.FC<{ l: Layer; theme: Theme }> = ({ l, theme }) => {
  const trip = useTrip(l.places, l.mode, "");
  const { tr, local, dur } = useLayerTransform(l);
  const { height } = useVideoConfig();
  const lift = l.mode === "flight" ? 1 : 0;
  const coords = useMemo(() => trip?.coords ?? [], [trip]);
  const g = useRouteGeometry(coords, lift);
  if (!trip) return null;
  const prog = easeInOutCubic(clamp((local - 0.3) / Math.max(0.1, dur - 0.8)));
  const c = auto(l.color, theme.route);
  return (
    <g opacity={tr.opacity}>
      <RouteLine coords={coords} progress={prog} color={c} width={(l.size / 10) * (height / 1080)} style={l.routeStyle} lift={lift} geometry={g} />
      {prog > 0.002 && l.vehicle !== "dot" ? <VehicleMarker coords={coords} progress={prog} type={l.vehicle} size={l.size * (height / 1080)} color={c} lift={lift} geometry={g} /> : null}
      {trip.stops.map((s, i) => (
        <Pin key={i} at={[s.lon, s.lat]} label={s.name} variant="dot" size={Math.round(height * 0.045)} color={c} pulse={false} />
      ))}
    </g>
  );
};

const ArrowLayer: React.FC<{ l: Layer; theme: Theme }> = ({ l, theme }) => {
  const pts = usePlaces(l.places);
  const { tr, dur } = useLayerTransform(l);
  const { fps } = useVideoConfig();
  if (!pts || pts.length < 2) return null;
  return (
    <g opacity={tr.opacity}>
      <MilitaryArrow path={pts.map((p) => [p.lon, p.lat] as LonLat)} start={0} end={Math.round(Math.min(dur * 0.7, 2.5) * fps)} color={auto(l.color, theme.accent)} label={l.text} width={l.size * 0.4} />
    </g>
  );
};

const RegionLayer: React.FC<{ l: Layer }> = ({ l }) => {
  const spec = useMemo(
    () => regionMediaDefaults({ target: l.places[0] ?? "", level: l.level, radiusKm: l.radiusKm, media: l.media || "flag", wave: l.wave, label: l.text, outline: l.color === "auto" ? "#ffffff" : l.color }),
    [l],
  );
  const shapes = useAreaShapes([spec]);
  const { tr } = useLayerTransform(l);
  const { height } = useVideoConfig();
  if (!shapes || !l.places[0]) return null;
  const u = height / 1080;
  return (
    <div style={{ position: "absolute", inset: 0, translate: `${tr.x * u}px ${tr.y * u}px`, scale: String(tr.scale), rotate: `${tr.rotate}deg` }}>
      <RegionFill spec={spec} shape={shapes[0]} alpha={tr.opacity} />
    </div>
  );
};

/* ---------------- screen layers ---------------- */

const FlagLayer: React.FC<{ l: Layer }> = ({ l }) => {
  const { height } = useVideoConfig();
  const shapes = useAreaShapes(l.media.startsWith("flag:") ? [] : [{ target: l.places[0] ?? "India", level: "country", radiusKm: 0 }]);
  const code = l.media.startsWith("flag:") ? l.media.slice(5) : shapes?.[0] && "properties" in shapes[0].feature ? String((shapes[0].feature.properties as { iso2?: string })?.iso2 ?? "") : "";
  if (!code) return null;
  const w = l.size * (height / 1080);
  return (
    <ScreenLayer l={l}>
      <div style={{ filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.45))" }}>
        <WavingFlag src={staticFile(`flags/${code.toLowerCase()}.svg`)} width={w} height={w * 0.75} wave={l.wave} />
      </div>
    </ScreenLayer>
  );
};

const CardLayer: React.FC<{ l: Layer; theme: Theme }> = ({ l, theme }) => {
  const pl = usePlaces(l.places.slice(0, 1));
  const { fps } = useVideoConfig();
  if (!pl || !pl[0]) return null;
  const pos = l.anchor === "center" ? "center" : l.anchor === "top-left" ? "top-left" : l.anchor === "bottom-right" ? "bottom-right" : "bottom-left";
  return (
    <LocationCard
      name={l.text || pl[0].name}
      subtitle={l.subtext || placeSubtitle(pl[0])}
      lat={pl[0].lat}
      lon={pl[0].lon}
      start={0}
      duration={Math.round((l.endSec - l.startSec) * fps)}
      cardStyle={l.cardStyle}
      position={pos}
      accent={auto(l.color, theme.accent)}
    />
  );
};

const HudLayer: React.FC<{ l: Layer }> = ({ l }) => {
  const trip = useTrip(l.places.length === 1 ? [l.places[0], l.places[0]] : l.places, l.mode, "");
  const { local, dur, tr } = useLayerTransform(l);
  if (!trip) return null;
  const t = clamp(local / dur);
  const head = trip.path.at(t);
  return (
    <AbsoluteFill style={{ opacity: tr.opacity }}>
      <Hud
        style="drone"
        color={l.color === "auto" ? "#7CFFB2" : l.color}
        data={{ lat: head[1], lon: head[0], altitudeM: l.value || undefined, headingDeg: trip.path.lengthKm > 0.01 ? trip.path.bearingAt(Math.min(0.999, Math.max(0.001, t))) : undefined, title: l.text }}
      />
    </AbsoluteFill>
  );
};

const CounterLayer: React.FC<{ l: Layer; theme: Theme }> = ({ l, theme }) => {
  const { local, dur, tr } = useLayerTransform(l);
  const v = l.value * ease("ease-out", clamp(local / Math.max(0.1, Math.min(dur, 2))));
  const corner = l.anchor === "top-left" ? "top-left" : l.anchor === "bottom-right" ? "bottom-right" : "top-right";
  return (
    <AbsoluteFill style={{ opacity: tr.opacity }}>
      <Counter value={v} label={l.text} theme={theme} corner={corner} format={(x) => (l.subtext === "km" ? formatKm(x) : `${Math.round(x).toLocaleString("en-IN")}${l.subtext ? ` ${l.subtext}` : ""}`)} />
    </AbsoluteFill>
  );
};

/* ---------------- camera ---------------- */

function cameraFrom(keys: CamKey[], resolved: (q: string) => LonLat | null, frame: number, fps: number, kind: ComposerProps["projection"]): Camera | null {
  const ks = keys
    .map((k) => ({ k, at: resolved(k.place) }))
    .filter((x) => x.at)
    .sort((a, b) => a.k.t - b.k.t);
  if (!ks.length) return null;
  const toCam = (x: (typeof ks)[number]) => cam(x.at![0], x.at![1], x.k.zoom, x.k.bearing, x.k.pitch);
  const t = frame / fps;
  if (t <= ks[0].k.t) return toCam(ks[0]);
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].k.t) {
      const a = toCam(ks[i - 1]);
      const b = toCam(ks[i]);
      const raw = (t - ks[i - 1].k.t) / Math.max(1e-6, ks[i].k.t - ks[i - 1].k.t);
      const e = ease(ks[i].k.ease, raw);
      switch (ks[i].k.move) {
        case "cut":
          return raw < 1 ? a : b;
        case "fly":
          return flyTo(a, b, e, kind);
        default:
          return mixCamera(a, b, e);
      }
    }
  }
  return toCam(ks[ks.length - 1]);
}

/* ---------------- composer ---------------- */

const ComposerInner: React.FC<ComposerProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const camPlaces = usePlaces(p.camera.map((c) => c.place));
  const allMapPlaces = useMemo(
    () => p.layers.filter((l) => ["pin", "radar", "callout", "map-label", "route", "arrow"].includes(l.type)).flatMap((l) => l.places),
    [p.layers],
  );
  const fitPlaces = usePlaces(p.camera.length ? [] : allMapPlaces);
  const areaQueries = useMemo(
    () => (p.camera.length ? [] : p.layers.filter((l) => l.type === "highlight" || l.type === "region-media").map((l) => ({ target: l.places[0] ?? "", level: l.level, radiusKm: l.radiusKm }))),
    [p.camera.length, p.layers],
  );
  const areaShapes = useAreaShapes(areaQueries, p.borders);
  const specs = useMemo(
    () =>
      p.layers
        .filter((l) => l.type === "highlight" && l.places[0])
        .map((l) =>
          highlightDefaults({ target: l.places[0], level: l.level, radiusKm: l.radiusKm, style: l.highlightStyle, color: l.color, startSec: l.startSec, endSec: l.endSec, label: l.text || "", sublabel: l.subtext }),
        ),
    [p.layers],
  );
  const hlLayers = useMemo(() => p.layers.filter((l) => l.type === "highlight" && l.places[0]), [p.layers]);
  const areasRaw = useAreaHighlights(specs, frame, fps, theme, p.borders);
  const areas = areasRaw.map((a, i) => {
    const l = hlLayers[i];
    const tr = evaluate(l.keys, (frame - l.startSec * fps) / fps, l.endSec - l.startSec, 0.001);
    return { ...a, alpha: l.keys.length ? tr.opacity : 1 };
  });

  const fallback = useMemo<Camera>(() => {
    const pts: LonLat[] = [...(fitPlaces ?? []).map((x) => [x.lon, x.lat] as LonLat), ...(areaShapes ?? []).flatMap((s) => shapePoints(s.feature))];
    return pts.length ? fitCamera(p.projection, pts, width, height, 0.15) : cam(78, 22, 1.5);
  }, [fitPlaces, areaShapes, p.projection, width, height]);

  const lookup = (q: string) => {
    const i = p.camera.findIndex((c) => c.place === q);
    const pl = camPlaces?.[i];
    return pl ? ([pl.lon, pl.lat] as LonLat) : null;
  };
  const camera = (camPlaces && cameraFrom(p.camera, lookup, frame, fps, p.projection)) || fallback;
  const sun = p.dayNight ? subsolarPoint(new Date(p.dateTimeUtc || "2025-06-21T06:00:00Z")) : null;
  const seq = (l: Layer, i: number, child: React.ReactNode) => (
    <Sequence key={i} from={Math.round(l.startSec * fps)} durationInFrames={Math.max(1, Math.round((l.endSec - l.startSec) * fps))} name={l.name || l.type} layout="none">
      {child}
    </Sequence>
  );
  const svgTypes = ["route", "pin", "radar", "callout", "arrow", "map-label"];
  return (
    <AbsoluteFill>
      <MapView
        kind={p.projection}
        camera={camera}
        theme={theme}
        borderView={p.borders}
        sun={sun}
        areas={areas}
        layers={{
          countryLabels: p.mapLayers.countryLabels,
          states: p.mapLayers.states ? "all" : undefined,
          roads: p.mapLayers.roads,
          rail: p.mapLayers.rail,
          rivers: p.mapLayers.rivers,
          lakes: p.mapLayers.rivers,
          graticule: p.mapLayers.graticule,
        }}
      >
        {p.layers.map((l, i) => (l.type === "region-media" ? seq(l, i, <RegionLayer l={l} />) : null))}
        <MapOverlay>
          {p.layers.map((l, i) =>
            svgTypes.includes(l.type)
              ? seq(l, i, l.type === "route" ? <RouteLayerC l={l} theme={theme} /> : l.type === "arrow" ? <ArrowLayer l={l} theme={theme} /> : <PinLayer l={l} theme={theme} />)
              : null,
          )}
        </MapOverlay>
      </MapView>
      <Finish theme={theme} />
      {p.layers.map((l, i) => {
        if (l.type === "highlight") return seq(l, i, null);
        if (l.type === "text")
          return seq(
            l,
            i,
            <ScreenLayer l={l}>
              <div style={{ font: `700 ${l.size * (height / 1080)}px ${font(theme.titleFont)}`, color: auto(l.color, "#ffffff"), textShadow: "0 6px 28px rgba(0,0,0,0.55)", textAlign: "center", whiteSpace: "pre-wrap" }}>
                {l.text}
                {l.subtext ? <div style={{ font: `500 ${l.size * 0.42 * (height / 1080)}px ${font(theme.labelFont)}`, opacity: 0.9, marginTop: 8 }}>{l.subtext}</div> : null}
              </div>
            </ScreenLayer>,
          );
        if (l.type === "image" || l.type === "video")
          return seq(
            l,
            i,
            <ScreenLayer l={l}>
              {l.media ? (
                isVideoFile(l.media) || l.type === "video" ? (
                  <Video src={resolveMedia(l.media)} muted style={{ width: l.size * (height / 1080), borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} />
                ) : (
                  <Img src={resolveMedia(l.media)} style={{ width: l.size * (height / 1080), borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} />
                )
              ) : null}
            </ScreenLayer>,
          );
        if (l.type === "flag") return seq(l, i, <FlagLayer l={l} />);
        if (l.type === "location-card") return seq(l, i, <CardLayer l={l} theme={theme} />);
        if (l.type === "counter") return seq(l, i, <CounterLayer l={l} theme={theme} />);
        if (l.type === "hud") return seq(l, i, <HudLayer l={l} />);
        if (l.type === "sfx" && l.media) {
          const named = (SFX as readonly string[]).includes(l.media);
          return seq(l, i, <Sfx name={named ? (l.media as (typeof SFX)[number]) : undefined} src={named ? undefined : l.media} at={0} volume={l.value || p.sfxVolume} enabled={p.sfx} />);
        }
        return null;
      })}
    </AbsoluteFill>
  );
};

/** Loads an optional project JSON (for automation) and merges it over the Studio props. */
export const MapComposer: React.FC<ComposerProps> = (p) => {
  const file = useAsset<Partial<ComposerProps>>(p.projectFile ? `project:${p.projectFile}` : null, () => fetchJson(p.projectFile));
  if (p.projectFile && !file) return <AbsoluteFill style={{ background: "#000" }} />;
  const merged: ComposerProps = file
    ? { ...p, ...file, layers: (file.layers ?? p.layers).map((l) => layerDefaults(l as Layer)), camera: file.camera ?? p.camera }
    : p;
  return <ComposerInner {...merged} />;
};
