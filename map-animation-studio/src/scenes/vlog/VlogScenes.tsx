import React from "react";
import { z } from "zod";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TravelScene } from "../TravelScene";
import { useMap } from "../../map/MapView";
import { project3D } from "../../map/routeGeometry";
import { base, zColorOrAuto, zRouteMode, zRouteStyle, zVehicle } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { clamp, easeInOutCubic, easeOutBack, subsolarPoint } from "../../lib/geo";
import { usePlaces } from "../../lib/useTrip";
import { MediaFill } from "../../ui/MediaFill";
import { resolveMedia } from "../../lib/media";
import { font } from "../../lib/fonts";
import { Sfx } from "../../fx/Sfx";
import { MapView } from "../../map/MapView";
import { cam } from "../../lib/camera";
import { Finish } from "../../fx/Finish";

/* ---------------- Split screen: footage + live route tracker ---------------- */

export const splitScreenSchema = z.object({
  ...base,
  media: z.string().describe("Main footage (left/top)"),
  stops: z.array(z.string()).min(2),
  mode: zRouteMode,
  trackFile: z.string(),
  vehicle: zVehicle,
  routeStyle: zRouteStyle,
  routeColor: zColorOrAuto,
  layout: z.enum(["side-by-side", "picture-in-picture", "stacked"]),
  mapShare: z.number().min(0.25).max(0.6).describe("Fraction of the frame used by the map"),
  pitch: z.number().min(0).max(60),
});

export const SplitScreenTracker: React.FC<z.infer<typeof splitScreenSchema>> = (p) => {
  const { width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const pip = p.layout === "picture-in-picture";
  const stacked = p.layout === "stacked";
  const mapW = Math.round(pip ? width * p.mapShare * 0.75 : stacked ? width : width * p.mapShare);
  const mapH = Math.round(pip ? mapW * 0.75 : stacked ? height * p.mapShare : height);
  const gap = Math.round(height * 0.012);
  const travel = (
    <TravelScene
      stops={p.stops}
      mode={p.mode}
      trackFile={p.trackFile}
      projection="mercator"
      theme={p.theme}
      borders={p.borders}
      vehicle={p.vehicle}
      routeStyle={p.routeStyle}
      routeColor={p.routeColor}
      routeWidth={5}
      lift={0}
      cameraMode="follow"
      pitch={p.pitch}
      introSec={0.5}
      outroSec={1}
      easing="smooth"
      showDistance={false}
      showHud={false}
      arrivalCard={false}
      layers={{ roads: true, rivers: true }}
      sfx={false}
      sfxVolume={0}
      size={{ width: mapW, height: mapH }}
    />
  );
  return (
    <AbsoluteFill style={{ background: "#0b0f14" }}>
      <AbsoluteFill style={pip ? undefined : stacked ? { height: height - mapH - gap } : { width: width - mapW - gap }}>
        <MediaFill src={p.media} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          overflow: "hidden",
          width: mapW,
          height: mapH,
          ...(pip
            ? { right: width * 0.04, bottom: height * 0.06, borderRadius: height * 0.025, border: "4px solid white", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }
            : stacked
              ? { left: 0, bottom: 0 }
              : { right: 0, top: 0 }),
        }}
      >
        {travel}
        <div style={{ position: "absolute", left: 18, top: 14, padding: "6px 14px", borderRadius: 30, background: theme.accent, color: "white", font: `700 ${height * 0.022}px ${font("Inter")}`, letterSpacing: 2 }}>
          LIVE ROUTE
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Polaroid pin drops that expand into the clip ---------------- */

export const polaroidSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(2),
  photos: z.array(z.string()).describe("One photo/clip per stop (public/ paths), same order as stops"),
  captions: z.array(z.string()),
  mode: zRouteMode,
  vehicle: zVehicle,
  routeStyle: zRouteStyle,
  routeColor: zColorOrAuto,
  stopPauseSec: z.number().min(0).max(5),
  expandLast: z.boolean().describe("Last polaroid grows into a full-screen clip"),
  expandSec: z.number().min(0.5).max(5),
});

const Polaroid: React.FC<{ at: [number, number]; start: number; src: string; caption: string; index: number }> = ({ at, start, src, caption, index }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame - start;
  if (t < 0) return null;
  const q = project3D(m, at);
  const k = easeOutBack(clamp(t / 16), 1.6);
  const w = height * 0.2;
  const rot = index % 2 ? 5 : -6;
  return (
    <foreignObject x={q.x + (index % 2 ? -w * 1.25 : w * 0.25)} y={q.y - w * 1.45} width={w * 1.1} height={w * 1.35} style={{ overflow: "visible" }}>
      <div
        style={{
          width: w,
          padding: w * 0.06,
          paddingBottom: w * 0.2,
          background: "#fbfaf6",
          boxShadow: "0 14px 34px rgba(0,0,0,0.4)",
          transform: `translateY(${(1 - k) * -80}px) rotate(${rot * k}deg) scale(${0.6 + 0.4 * k})`,
          opacity: clamp(t / 5),
          transformOrigin: "50% 100%",
        }}
      >
        <div style={{ width: "100%", aspectRatio: "1", background: "#d9d4c7", overflow: "hidden" }}>
          {src ? <Img src={resolveMedia(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        <div style={{ font: `700 ${w * 0.11}px ${font("Caveat")}`, color: "#333", textAlign: "center", marginTop: w * 0.04 }}>{caption}</div>
      </div>
    </foreignObject>
  );
};

export const PolaroidPinDrop: React.FC<z.infer<typeof polaroidSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const expandF = Math.round(p.expandSec * fps);
  return (
    <AbsoluteFill>
      <TravelScene
        stops={p.stops}
        mode={p.mode}
        projection="mercator"
        theme={p.theme}
        borders={p.borders}
        vehicle={p.vehicle}
        routeStyle={p.routeStyle}
        routeColor={p.routeColor}
        routeWidth={6}
        lift={p.mode === "flight" ? 1 : 0}
        cameraMode="fit"
        pitch={0}
        introSec={1}
        outroSec={p.expandLast ? p.expandSec + 1 : 1.5}
        stopPauseSec={p.stopPauseSec}
        easing="smooth"
        showDistance
        showHud={false}
        arrivalCard={false}
        sfx={p.sfx}
        sfxVolume={p.sfxVolume}
        mapChildren={(info) =>
          info.trip.stops.map((s, i) => (
            <Polaroid key={i} at={[s.lon, s.lat]} start={info.arrivalFrames[i] + (i === 0 ? 6 : -2)} src={p.photos[i] ?? ""} caption={p.captions[i] ?? s.name} index={i} />
          ))
        }
        overlay={(info) => {
          if (!p.expandLast) return null;
          const t = clamp((frame - (info.travelEnd + 18)) / expandF);
          if (t <= 0) return null;
          const e = easeInOutCubic(t);
          const last = p.photos[p.photos.length - 1] ?? "";
          return (
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: `${interpolate(e, [0, 1], [22, 100])}%`, height: `${interpolate(e, [0, 1], [39, 100])}%`, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", border: `${(1 - e) * 14}px solid #fbfaf6`, rotate: `${(1 - e) * 4}deg` }}>
                <MediaFill src={last} label="Your last clip" />
              </div>
            </AbsoluteFill>
          );
        }}
      />
      {p.expandLast ? <Sfx name="whoosh" at={durationInFrames - expandF - Math.round(fps)} volume={p.sfxVolume} enabled={p.sfx} /> : null}
    </AbsoluteFill>
  );
};

/* ---------------- Day/night globe with the real terminator ---------------- */

export const dayNightSchema = z.object({
  ...base,
  startUtc: z.string().describe("UTC start, e.g. 2025-12-21T00:00:00Z"),
  hoursCovered: z.number().min(0).max(72).describe("How many real hours pass during the clip"),
  focus: z.string().describe('Place the globe faces (or "lat, lon")'),
  rotate: z.boolean().describe("Turn with the Earth so the focus stays put; off = sun appears fixed"),
  zoom: z.number().min(-0.6).max(4),
  showClock: z.boolean(),
});

export const DayNightGlobe: React.FC<z.infer<typeof dayNightSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const start = new Date(p.startUtc || "2025-12-21T00:00:00Z");
  const now = new Date(start.getTime() + t * p.hoursCovered * 3600 * 1000);
  const sun = subsolarPoint(now);
  const focus = usePlaces([p.focus || "21, 78.9"]);
  if (!focus) return <AbsoluteFill style={{ background: "#000" }} />;
  const [flon, flat] = [focus[0].lon, focus[0].lat];
  const lon = p.rotate ? flon : flon - (sun[0] - subsolarPoint(start)[0]);
  const theme = THEMES[p.theme];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MapView kind="globe" camera={cam(lon, flat, p.zoom)} theme={THEMES.satellite} borderView={p.borders} sun={sun} layers={{ countryLabels: p.zoom > 0.5 }} />
      <Finish theme={theme} grain={false} />
      {p.showClock ? (
        <div style={{ position: "absolute", right: 80, bottom: 70, color: "white", textAlign: "right", textShadow: "0 0 14px black" }}>
          <div style={{ font: `600 ${height * 0.022}px ${font("Inter")}`, letterSpacing: 4, opacity: 0.8 }}>UTC</div>
          <div style={{ font: `700 ${height * 0.06}px ${font("JetBrains Mono")}` }}>{now.toISOString().slice(11, 16)}</div>
          <div style={{ font: `500 ${height * 0.024}px ${font("Inter")}`, opacity: 0.85 }}>{now.toUTCString().slice(0, 16)}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

