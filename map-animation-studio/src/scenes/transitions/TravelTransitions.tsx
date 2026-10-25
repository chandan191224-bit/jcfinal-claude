import React from "react";
import { z } from "zod";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MapView, MapOverlay } from "../../map/MapView";
import { Pin } from "../../map/overlays";
import { base, zProjection, zRouteMode } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { cam, baseScale, flyTo } from "../../lib/camera";
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic } from "../../lib/geo";
import { usePlaces, useTrip } from "../../lib/useTrip";
import { placeSubtitle } from "../../lib/places";
import { Finish, Grain, Vignette } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { Hud, LocationCard, LOCATION_CARD_STYLES } from "../../ui/Overlays2D";
import { MediaFill } from "../../ui/MediaFill";
import { ElevationTrail } from "../routes/ElevationTrail";
import { font } from "../../lib/fonts";

/* ---------------- Match cut: map pin → real footage ---------------- */

export const matchCutSchema = z.object({
  ...base,
  place: z.string(),
  media: z.string().describe("Footage/photo in public/ revealed by the cut"),
  style: z.enum(["iris", "window", "zoom-blur", "reverse-iris"]),
  startZoom: z.number().min(0).max(12),
  endZoom: z.number().min(1).max(14),
  cutAtSec: z.number().min(0.5).max(30),
  label: z.boolean(),
});

export const MatchCut: React.FC<z.infer<typeof matchCutSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const places = usePlaces([p.place]);
  const pl = places?.[0];
  if (!pl) return <AbsoluteFill style={{ background: "#000" }} />;
  const cut = Math.round(p.cutAtSec * fps);
  const reverse = p.style === "reverse-iris";
  // Reverse plays the same move backwards after the cut.
  const f = reverse ? Math.max(0, 2 * cut - frame) : frame;
  const t = clamp(f / cut);
  const accel = p.style === "zoom-blur" ? easeInCubic(t) : easeInOutCubic(t);
  const zoom = p.startZoom + (p.endZoom - p.startZoom) * accel;
  const camera = cam(pl.lon, pl.lat, zoom);
  const vel = p.style === "zoom-blur" ? (p.endZoom - p.startZoom) * 3 * t * t * (1 / cut) * fps : 0;
  const after = reverse ? clamp((cut - frame) / 18) : clamp((frame - cut) / 18);
  const diag = Math.hypot(width, height);
  let reveal: React.ReactNode = null;
  if (p.style === "iris" || reverse) {
    const r = easeInCubic(after) * diag * 0.6;
    reveal = (
      <AbsoluteFill style={{ clipPath: `circle(${r}px at 50% 50%)` }}>
        <MediaFill src={p.media} style={{ scale: String(1.15 - 0.15 * after) }} />
      </AbsoluteFill>
    );
  } else if (p.style === "window") {
    // A photo frame appears around the pin and grows with the zoom until it fills the screen.
    const appear = easeOutCubic(clamp((f - cut * 0.55) / 12));
    const grow = Math.pow(2, Math.max(0, zoom - (p.startZoom + (p.endZoom - p.startZoom) * 0.55)));
    const w = width * 0.28 * grow;
    const h = height * 0.28 * grow;
    const fill = clamp((w - width) / (width * 0.4));
    reveal =
      appear > 0 ? (
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: width / 2 - w / 2,
              top: height / 2 - h / 2,
              width: w,
              height: h,
              opacity: appear,
              border: `${Math.max(0, 10 * (1 - fill))}px solid white`,
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", left: (w - width) / 2, top: (h - height) / 2, width, height }}>
              <MediaFill src={p.media} />
            </div>
          </div>
        </AbsoluteFill>
      ) : null;
  } else {
    reveal = (
      <AbsoluteFill style={{ opacity: after, filter: `blur(${(1 - after) * 12}px)` }}>
        <MediaFill src={p.media} style={{ scale: String(1.3 - 0.3 * easeOutCubic(after)) }} />
      </AbsoluteFill>
    );
  }
  const flash = p.style === "zoom-blur" ? Math.max(0, 1 - Math.abs(frame - cut) / 5) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: vel > 0.5 ? `blur(${Math.min(14, vel * 0.8)}px)` : undefined }}>
        <MapView kind="globe" camera={camera} theme={theme} borderView={p.borders} layers={{ countryLabels: zoom < 6, states: zoom > 3 ? "all" : undefined, roads: zoom > 6 }}>
          <MapOverlay>{p.label ? <Pin at={[pl.lon, pl.lat]} label={pl.name} start={5} size={Math.round(height * 0.06)} /> : null}</MapOverlay>
        </MapView>
      </AbsoluteFill>
      {p.style === "zoom-blur" && vel > 0.5 ? <ZoomStreaks amount={Math.min(1, vel / 10)} /> : null}
      <Finish theme={theme} grain={false} />
      {reveal}
      {flash > 0 ? <AbsoluteFill style={{ background: "white", opacity: flash }} /> : null}
      <Sfx name={p.style === "zoom-blur" ? "zoom-in" : "whoosh"} at={cut - (p.style === "zoom-blur" ? 46 : 22)} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name={p.style === "zoom-blur" ? "impact" : "swish"} at={cut - 2} volume={p.sfxVolume * 0.7} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

/** Radial speed lines for fast zoom pushes. */
export const ZoomStreaks: React.FC<{ amount: number }> = ({ amount }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lines = Array.from({ length: 90 }, (_, i) => {
    const a = (i / 90) * Math.PI * 2 + ((i * 7) % 5) * 0.01;
    const r0 = Math.hypot(width, height) * (0.18 + ((i * 37 + frame * 13) % 100) / 400);
    const len = 120 + ((i * 53) % 200);
    return (
      <line
        key={i}
        x1={width / 2 + Math.cos(a) * r0}
        y1={height / 2 + Math.sin(a) * r0}
        x2={width / 2 + Math.cos(a) * (r0 + len)}
        y2={height / 2 + Math.sin(a) * (r0 + len)}
        stroke="white"
        strokeWidth={1.5 + (i % 3)}
        opacity={0.12 + 0.25 * ((i * 17) % 10) / 10}
      />
    );
  });
  return (
    <AbsoluteFill style={{ opacity: amount, pointerEvents: "none" }}>
      <svg width={width} height={height}>{lines}</svg>
    </AbsoluteFill>
  );
};

/* ---------------- GPS / flight HUD over footage or a drone-style map ---------------- */

export const hudOverlaySchema = z.object({
  ...base,
  stops: z.array(z.string()).min(1).describe("One place for a fixed position, or a route the telemetry follows"),
  mode: zRouteMode,
  media: z.string().describe("Footage under the HUD; empty = 3D terrain drone view of the route"),
  hudStyle: z.enum(["drone", "flight", "minimal"]),
  color: z.string(),
  altitudeM: z.number().min(0).max(15000).describe("Base altitude shown (drone/flight)"),
  realHours: z.number().min(0).max(100),
  clockStart: z.string().describe("HH:MM:SS shown at the start"),
  miniMap: z.boolean(),
});

export const HudOverlay: React.FC<z.infer<typeof hudOverlaySchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();
  const stops = p.stops.length === 1 ? [p.stops[0], p.stops[0]] : p.stops;
  const trip = useTrip(stops, p.mode, "");
  const theme = THEMES[p.theme];
  if (!trip) return <AbsoluteFill style={{ background: "#000" }} />;
  // Same timing as the terrain chase underneath, so telemetry matches the picture.
  const t = p.media ? frame / Math.max(1, durationInFrames - 1) : easeInOutCubic(clamp((frame - 20) / Math.max(1, durationInFrames - 60)));
  const head = trip.path.at(t);
  const hours = p.realHours > 0 ? p.realHours : durationInFrames / fps / 3600;
  const speed = trip.path.lengthKm > 0.01 ? trip.path.lengthKm / hours : 0;
  const [hh, mm, ss] = (p.clockStart || "10:00:00").split(":").map((x) => parseInt(x, 10) || 0);
  const secs = hh * 3600 + mm * 60 + ss + t * hours * 3600;
  const clock = [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, Math.floor(secs) % 60].map((v) => String(v).padStart(2, "0")).join(":");
  const heading = trip.path.lengthKm > 0.01 ? trip.path.bearingAt(Math.min(0.999, Math.max(0.001, t))) : 0;
  const alt = p.altitudeM + Math.sin(frame / 40) * p.altitudeM * 0.01;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {p.media ? (
        <MediaFill src={p.media} />
      ) : (
        <ElevationTrail
          {...p}
          stops={stops}
          trackFile=""
          terrainStyle="realistic"
          exaggeration={1.3}
          trailColor={p.color || "#7CFFB2"}
          cameraDistanceKm={3.5}
          cameraHeightKm={1.6}
          sunAzimuth={140}
          sunElevation={35}
          fog={0.35}
          graph={false}
          title=""
          sfx={false}
        />
      )}
      <Vignette amount={0.35} />
      <Hud
        style={p.hudStyle}
        color={p.color || "#7CFFB2"}
        data={{ lat: head[1], lon: head[0], altitudeM: alt, speedKmh: speed, headingDeg: heading, clock, title: trip.stops[trip.stops.length - 1].name.toUpperCase(), distanceKm: trip.path.lengthKm * (1 - t) }}
      />
      {p.miniMap ? (
        <div style={{ position: "absolute", right: 110 * (height / 1080), top: 170 * (height / 1080), width: 320 * (height / 1080), height: 320 * (height / 1080), borderRadius: "50%", overflow: "hidden", border: `3px solid ${p.color || "#7CFFB2"}`, boxShadow: "0 0 30px rgba(0,0,0,0.6)" }}>
          <MapView kind="mercator" camera={cam(head[0], head[1], 5.5)} theme={theme} borderView={p.borders} size={{ width: 320 * (height / 1080), height: 320 * (height / 1080) }} layers={{ roads: true }}>
            <MapOverlay>
              <MiniPos at={head} color={p.color || "#7CFFB2"} />
            </MapOverlay>
          </MapView>
        </div>
      ) : null}
      <Grain amount={0.05} />
      <Sfx name="static" at={0} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
      <Sfx name="beep" at={8} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

const MiniPos: React.FC<{ at: [number, number]; color: string }> = ({ at, color }) => <Pin at={at} variant="dot" color={color} size={40} pulse start={-100} />;

/* ---------------- Kinetic location card ---------------- */

export const kineticCardSchema = z.object({
  ...base,
  place: z.string(),
  title: z.string().describe("Override the place name (empty = automatic)"),
  subtitle: z.string().describe("Override the subtitle (empty = region/country)"),
  cardStyle: z.enum(LOCATION_CARD_STYLES),
  position: z.enum(["bottom-left", "center", "top-left", "bottom-right"]),
  background: z.enum(["map", "media"]),
  media: z.string(),
  projection: zProjection,
  accent: z.string(),
});

export const KineticLocationCard: React.FC<z.infer<typeof kineticCardSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const places = usePlaces([p.place]);
  const pl = places?.[0];
  const theme = THEMES[p.theme];
  if (!pl) return <AbsoluteFill style={{ background: "#000" }} />;
  const zoom = interpolate(frame, [0, durationInFrames], [5.2, 5.8]);
  return (
    <AbsoluteFill>
      {p.background === "media" ? (
        <MediaFill src={p.media} />
      ) : (
        <MapView kind={p.projection} camera={cam(pl.lon + 0.6, pl.lat - 0.2, zoom)} theme={theme} borderView={p.borders} layers={{ states: "all", rivers: true, roads: true, countryLabels: true }}>
          <MapOverlay>
            <Pin at={[pl.lon, pl.lat]} start={6} size={Math.round(height * 0.06)} variant="target" />
          </MapOverlay>
        </MapView>
      )}
      {p.background === "map" ? <Finish theme={theme} /> : <Vignette amount={0.45} />}
      <LocationCard
        name={p.title || pl.name}
        subtitle={p.subtitle || placeSubtitle(pl)}
        lat={pl.lat}
        lon={pl.lon}
        start={8}
        duration={durationInFrames - 8}
        cardStyle={p.cardStyle}
        position={p.position}
        accent={p.accent || theme.accent}
      />
      <Sfx name="swish" at={8} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name="typing" at={26} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

/* ---------------- Search bar fly-to (Google Earth style) ---------------- */

export const searchFlySchema = z.object({
  ...base,
  from: z.string(),
  to: z.string(),
  query: z.string().describe("Text typed into the search bar (empty = destination name)"),
  projection: zProjection,
  endZoom: z.number().min(1).max(12),
});

export const SearchFlyTo: React.FC<z.infer<typeof searchFlySchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height, width } = useVideoConfig();
  const places = usePlaces([p.from, p.to]);
  const theme = THEMES[p.theme];
  if (!places || places.length < 2) return <AbsoluteFill style={{ background: "#000" }} />;
  const [a, b] = places;
  const text = p.query || `${b.name}, ${b.country}`;
  const typeEnd = Math.round(fps * 0.5) + text.length * 2;
  const flyStart = typeEnd + 12;
  const flyEnd = durationInFrames - Math.round(fps * 1.2);
  const t = clamp((frame - flyStart) / Math.max(1, flyEnd - flyStart));
  const startCam = cam(a.lon, a.lat, 4);
  const endCam = cam(b.lon, b.lat, p.endZoom);
  const camera = t <= 0 ? startCam : flyTo(startCam, endCam, easeInOutCubic(t), p.projection);
  const typed = text.slice(0, Math.max(0, Math.floor((frame - fps * 0.5) / 2)));
  const u = height / 1080;
  const barOut = clamp((frame - flyStart) / 15);
  const kmPx = 6371 / (baseScale(p.projection, width, height) * Math.pow(2, camera.zoom));
  return (
    <AbsoluteFill>
      <MapView kind={p.projection} camera={camera} theme={theme} borderView={p.borders} layers={{ countryLabels: true, states: camera.zoom > 3.5 ? "all" : undefined, roads: camera.zoom > 6 }}>
        <MapOverlay>
          <Pin at={[b.lon, b.lat]} label={b.name} sublabel={placeSubtitle(b)} start={flyEnd - 10} size={Math.round(height * 0.06)} />
        </MapOverlay>
      </MapView>
      <Finish theme={theme} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 70 * u,
          translate: `-50% ${-barOut * 160 * u}px`,
          width: 900 * u,
          height: 92 * u,
          borderRadius: 46 * u,
          background: "white",
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          padding: `0 ${34 * u}px`,
          gap: 22 * u,
          font: `500 ${36 * u}px ${font("Inter")}`,
          color: "#1f2933",
        }}
      >
        <svg width={40 * u} height={40 * u} viewBox="0 0 24 24" fill="none" stroke="#5f6b7a" strokeWidth="2.4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>
          {typed}
          <span style={{ opacity: Math.floor(frame / 12) % 2 ? 0 : 1, color: "#2f6fed" }}>|</span>
        </span>
      </div>
      <div style={{ position: "absolute", right: 60 * u, bottom: 40 * u, color: theme.label, opacity: 0.75, font: `500 ${20 * u}px ${font("JetBrains Mono")}`, textShadow: `0 0 8px ${theme.labelHalo}` }}>
        Eye alt {Math.round((kmPx * width) / 1.15).toLocaleString("en-IN")} km
      </div>
      {Array.from({ length: Math.max(0, Math.floor(text.length / 2)) }, (_, i) => (
        <Sfx key={i} name="tick" at={Math.round(fps * 0.5) + i * 4} volume={p.sfxVolume * 0.6} enabled={p.sfx} />
      ))}
      <Sfx name="whoosh" at={flyStart} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name="pop" at={flyEnd - 10} volume={p.sfxVolume} enabled={p.sfx} />
    </AbsoluteFill>
  );
};
