import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MapView, MapOverlay, type MapLayers } from "../map/MapView";
import { Pin, RouteLine, VehicleMarker, useRouteGeometry, type RouteStyle } from "../map/overlays";
import type { Vehicle } from "../map/icons";
import { useTrip, type Trip } from "../lib/useTrip";
import type { RouteMode } from "../lib/routing";
import { THEMES, type ThemeName } from "../lib/themes";
import { cam, fitCamera, flyTo, mixCamera, baseScale, type Camera, type ProjectionKind } from "../lib/camera";
import { clamp, distanceKm, easeInOutCubic, formatKm, smooth, subsolarPoint } from "../lib/geo";
import { placeSubtitle, type LonLat } from "../lib/places";
import { Finish, LightLeak, Letterbox } from "../fx/Finish";
import { Sfx } from "../fx/Sfx";
import { CompassRose, Counter, Hud, LocationCard, ScaleBar, TitleCard, type LocationCardStyle } from "../ui/Overlays2D";
import type { BorderView } from "../lib/data";
import { auto } from "../lib/schema";
import { geoDistance } from "d3-geo";

export type CameraMode = "fit" | "follow" | "fly" | "overview-follow";

export type TravelProps = {
  stops: string[];
  mode: RouteMode;
  trackFile?: string;
  projection: ProjectionKind;
  theme: ThemeName;
  borders: BorderView;
  vehicle: Vehicle;
  routeStyle: RouteStyle;
  routeColor: string;
  routeWidth: number;
  lift: number;
  cameraMode: CameraMode;
  pitch: number;
  headingUp?: boolean;
  /** Seconds before the vehicle departs and after it arrives. */
  introSec: number;
  outroSec: number;
  stopPauseSec?: number;
  easing: "smooth" | "linear";
  showDistance: boolean;
  showHud: boolean;
  showCompass?: boolean;
  showScale?: boolean;
  arrivalCard: boolean;
  cardStyle?: LocationCardStyle;
  title?: string;
  subtitle?: string;
  /** Real-world trip duration in hours, used for the HUD speed/clock. 0 = estimate. */
  realHours?: number;
  departure?: string;
  dayNight?: boolean;
  dateTimeUtc?: string;
  layers?: MapLayers;
  highlight?: string[];
  letterbox?: boolean;
  sfx: boolean;
  sfxVolume: number;
};

const CRUISE: Record<RouteMode, number> = { flight: 820, road: 60, rail: 75, sea: 30, straight: 60, street: 45 };

/** Frame timeline: where the vehicle is along the route for every frame, with pauses at stops. */
function useTimeline(trip: Trip | null, p: TravelProps, fps: number, total: number) {
  return useMemo(() => {
    if (!trip) return null;
    const intro = Math.round(p.introSec * fps);
    const outro = Math.round(p.outroSec * fps);
    const pause = Math.round((p.stopPauseSec ?? 0) * fps);
    const legsFrac: number[] = [0];
    // Fraction along the route closest to each intermediate stop.
    for (let s = 1; s < trip.stops.length - 1; s++) {
      const st: LonLat = [trip.stops[s].lon, trip.stops[s].lat];
      let best = 0;
      let bestD = Infinity;
      trip.coords.forEach((c, i) => {
        const d = distanceKm(c, st);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      legsFrac.push(trip.path.cum[best] / (trip.path.lengthKm || 1));
    }
    legsFrac.push(1);
    const nLegs = legsFrac.length - 1;
    const travel = Math.max(1, total - intro - outro - pause * (nLegs - 1));
    const legFrames = legsFrac.slice(1).map((f, i) => Math.max(1, Math.round(travel * (f - legsFrac[i]))));
    const arrivals: number[] = [intro];
    let t = intro;
    legFrames.forEach((lf, i) => {
      t += lf;
      arrivals.push(t);
      if (i < nLegs - 1) t += pause;
    });
    const ease = p.easing === "linear" ? (x: number) => x : nLegs > 1 && pause === 0 ? smooth : easeInOutCubic;
    const progressAt = (f: number) => {
      if (f <= intro) return 0;
      let start = intro;
      for (let i = 0; i < nLegs; i++) {
        const end = start + legFrames[i];
        if (f <= end) {
          const local = (f - start) / legFrames[i];
          const e = nLegs > 1 && pause === 0 ? local : ease(local);
          return legsFrac[i] + (legsFrac[i + 1] - legsFrac[i]) * e;
        }
        start = end + (i < nLegs - 1 ? pause : 0);
        if (f <= start) return legsFrac[i + 1];
      }
      return 1;
    };
    // With no pauses, ease the whole journey instead of each leg.
    const whole = nLegs > 1 && pause === 0;
    const progress = (f: number) => {
      if (!whole) return progressAt(f);
      const x = clamp((f - intro) / Math.max(1, total - intro - outro));
      return p.easing === "linear" ? x : easeInOutCubic(x);
    };
    const stopFrame = whole ? legsFrac.map((fr) => intro + Math.round(fr * (total - intro - outro))) : arrivals;
    return { progress, intro, outro, arrivalFrames: stopFrame, travelEnd: total - outro };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, p.introSec, p.outroSec, p.stopPauseSec, p.easing, fps, total]);
}

export const TravelScene: React.FC<TravelProps & { children?: React.ReactNode; overlay?: (info: { progress: number; head: LonLat }) => React.ReactNode }> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const trip = useTrip(p.stops, p.mode, p.trackFile ?? "");
  const tl = useTimeline(trip, p, fps, durationInFrames);
  const kind = p.projection;

  const cams = useMemo(() => {
    if (!trip) return null;
    const all = fitCamera(kind, trip.coords, width, height, 0.16);
    const L = trip.path.lengthKm;
    // Close-up zoom: frame about a quarter of the route (or 40 km for short trips).
    const windowKm = Math.max(40, Math.min(L * 0.3, 2500));
    const k0 = baseScale(kind, width, height);
    const closeZoom = Math.log2((Math.min(width, height) * 0.55) / ((windowKm / 6371) * k0));
    return { all, closeZoom: Math.min(closeZoom, 13) };
  }, [trip, kind, width, height]);

  const geom = useMemo(() => trip?.coords ?? [], [trip]);

  if (!trip || !tl || !cams) return <AbsoluteFill style={{ backgroundColor: theme.oceanEdge }} />;

  const prog = tl.progress(frame);
  const head = trip.path.at(prog);
  const lead = trip.path.at(Math.min(1, prog + 0.02));
  const end = trip.coords[trip.coords.length - 1];
  const start = trip.coords[0];

  // Heading-up rotation, smoothed over a short window.
  const bearingNow = p.headingUp ? trip.path.bearingAt(Math.min(0.999, Math.max(0.001, prog))) : 0;

  let camera: Camera;
  const pitch = p.pitch;
  const T = durationInFrames;
  if (p.cameraMode === "fit") {
    const push = 0.15 * (frame / T);
    camera = { ...cams.all, zoom: cams.all.zoom + push, pitch };
  } else if (p.cameraMode === "fly") {
    const a = cam(start[0], start[1], cams.closeZoom, 0, pitch);
    const b = cam(end[0], end[1], cams.closeZoom, 0, pitch);
    // Zoom profile of the optimal fly-to, with the camera locked to the vehicle.
    const z = flyTo(a, b, prog, kind).zoom;
    camera = cam(head[0], head[1], z, bearingNow, pitch);
  } else if (p.cameraMode === "overview-follow") {
    const follow = cam((head[0] + lead[0]) / 2, (head[1] + lead[1]) / 2, cams.closeZoom, bearingNow, pitch);
    const startBlend = smooth(clamp(frame / Math.max(1, tl.intro)));
    const endBlend = smooth(clamp((frame - tl.travelEnd) / Math.max(1, tl.outro)));
    const overview = { ...cams.all, pitch: 0 };
    camera = endBlend > 0 ? mixCamera(follow, overview, endBlend) : mixCamera(overview, follow, startBlend);
  } else {
    camera = cam((head[0] * 2 + lead[0]) / 3, (head[1] * 2 + lead[1]) / 3, cams.closeZoom, bearingNow, pitch);
  }
  if (kind === "globe" && p.cameraMode === "fit" && geoDistance(start, end) > 1.6) {
    // Very long routes: turn the globe with the vehicle instead.
    camera = cam(head[0], Math.max(-50, Math.min(50, head[1])), -0.15, 0, pitch);
  }

  const stopsReached = tl.arrivalFrames;
  const sun = p.dayNight ? subsolarPoint(new Date(p.dateTimeUtc || "2025-06-21T06:00:00Z")) : null;
  const kmDone = trip.path.lengthKm * prog;
  const realHours = p.realHours && p.realHours > 0 ? p.realHours : trip.path.lengthKm / CRUISE[p.mode];
  const dProg = (tl.progress(frame + 1) - tl.progress(frame - 1)) / 2;
  const avgProgPerFrame = 1 / Math.max(1, tl.travelEnd - tl.intro);
  const speed = (dProg / avgProgPerFrame) * (trip.path.lengthKm / realHours);
  const alt = p.mode === "flight" ? 11000 * Math.min(1, Math.sin(Math.PI * prog) * 3) : undefined;
  const [hh, mm] = (p.departure || "08:00").split(":").map(Number);
  const minutes = (hh || 0) * 60 + (mm || 0) + prog * realHours * 60;
  const clock = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
  const kmPerPixel = (6371 / (baseScale(kind, width, height) * Math.pow(2, camera.zoom))) / (kind === "mercator" ? 1 / Math.cos((camera.lat * Math.PI) / 180) : 1);
  const last = trip.stops[trip.stops.length - 1];

  return (
    <AbsoluteFill>
      <MapView
        kind={kind}
        camera={camera}
        theme={theme}
        borderView={p.borders}
        sun={sun}
        layers={{ countryLabels: true, ...p.layers }}
        highlights={(p.highlight ?? []).map((c) => ({ country: c, amount: smooth(clamp(frame / 20)), dim: 0.4 }))}
      >
        <MapOverlay>
          <RouteLayer
            coords={geom}
            progress={prog}
            p={p}
            color={auto(p.routeColor, theme.route)}
          />
          {trip.stops.map((s, i) => (
            <Pin
              key={i}
              at={[s.lon, s.lat]}
              label={s.name}
              sublabel={i === 0 || i === trip.stops.length - 1 ? s.country : undefined}
              start={i === 0 ? 4 : Math.max(0, stopsReached[i] - 8)}
              color={i === 0 ? theme.label : auto(p.routeColor, theme.accent)}
              size={Math.round(height * 0.05)}
              labelSide={labelSide(trip, i, camera)}
              pulse={i === trip.stops.length - 1}
            />
          ))}
        </MapOverlay>
      </MapView>
      <Finish theme={theme} />
      {p.showDistance ? <Counter value={kmDone} label={p.mode === "flight" ? "Flight distance" : "Distance"} theme={theme} format={formatKm} /> : null}
      {p.showCompass ? <CompassRose bearing={camera.bearing} theme={theme} /> : null}
      {p.showScale && kmPerPixel > 0 ? <ScaleBar kmPerPixel={kmPerPixel} theme={theme} /> : null}
      {p.showHud ? (
        <Hud
          style={p.mode === "flight" ? "flight" : "drone"}
          data={{
            lat: head[1],
            lon: head[0],
            altitudeM: alt,
            speedKmh: Math.max(0, speed),
            headingDeg: trip.path.bearingAt(Math.min(0.999, Math.max(0.001, prog))),
            distanceKm: trip.path.lengthKm - kmDone,
            clock,
            title: `${trip.stops[0].name.toUpperCase()} → ${last.name.toUpperCase()}`,
          }}
        />
      ) : null}
      {p.title ? <TitleCard title={p.title} subtitle={p.subtitle} theme={theme} duration={Math.max(60, tl.intro + 40)} /> : null}
      {p.arrivalCard ? (
        <LocationCard
          name={last.name}
          subtitle={placeSubtitle(last)}
          lat={last.lat}
          lon={last.lon}
          start={tl.travelEnd - 6}
          duration={T}
          cardStyle={p.cardStyle ?? "documentary"}
          accent={auto(p.routeColor, theme.accent)}
        />
      ) : null}
      {p.letterbox ? <Letterbox amount={1} /> : null}
      {p.children}
      {p.overlay ? p.overlay({ progress: prog, head }) : null}
      <LightLeak start={tl.travelEnd - 10} duration={36} />
      <Sfx name="whoosh" at={tl.intro - 8} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name={p.mode === "flight" ? "plane-flyby" : "engine"} at={tl.intro + (tl.travelEnd - tl.intro) / 2 - 60} volume={p.sfxVolume * 0.8} enabled={p.sfx} />
      {stopsReached.slice(1).map((f, i) => (
        <Sfx key={i} name={i === stopsReached.length - 2 ? "ping" : "pop"} at={f} volume={p.sfxVolume} enabled={p.sfx} />
      ))}
      <Sfx name="pop" at={4} volume={p.sfxVolume * 0.8} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

/** Puts each label on the side away from the route so lines never cross text. */
function labelSide(trip: Trip, i: number, camera: Camera): "left" | "right" {
  const s = trip.stops[i];
  const others = trip.stops.filter((_, k) => k !== i);
  if (!others.length) return "right";
  const avgLon = others.reduce((a, o) => a + o.lon, 0) / others.length;
  let d = s.lon - avgLon;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  void camera;
  return d >= 0 ? "right" : "left";
}

const RouteLayer: React.FC<{ coords: LonLat[]; progress: number; p: TravelProps; color: string }> = ({ coords, progress, p, color }) => {
  const { height } = useVideoConfig();
  const g = useRouteGeometry(coords, p.lift);
  const w = p.routeWidth * (height / 1080);
  return (
    <>
      <RouteLine coords={coords} progress={progress} color={color} width={w} style={p.routeStyle} lift={p.lift} geometry={g} />
      {progress > 0.002 ? (
        <VehicleMarker coords={coords} progress={progress} type={p.vehicle} size={Math.round(height * 0.075)} color={color} lift={p.lift} geometry={g} />
      ) : null}
    </>
  );
};
