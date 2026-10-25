import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { base, zColorOrAuto, zRouteMode } from "../../lib/schema";
import { useAsset } from "../../lib/data";
import { loadDem, type Dem } from "../../lib/terrain";
import { useTrip } from "../../lib/useTrip";
import { GeoPath, bounds, clamp, distanceKm, easeInOutCubic, formatKm } from "../../lib/geo";
import { TERRAIN_STYLES, TerrainView, terrainHeightAt, toWorld, type CameraPose } from "../../three/Terrain3D";
import { Grain, Vignette } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { font } from "../../lib/fonts";
import type { LonLat } from "../../lib/places";

export const elevationTrailSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(2).describe('Waypoints; "Name (lat, lon)" works for unnamed spots'),
  mode: zRouteMode,
  trackFile: z.string().describe("GPX/GeoJSON in public/ (recommended for an exact trail)"),
  terrainStyle: z.enum(TERRAIN_STYLES),
  exaggeration: z.number().min(0.5).max(4),
  trailColor: zColorOrAuto,
  cameraDistanceKm: z.number().min(0.3).max(30),
  cameraHeightKm: z.number().min(0.1).max(15),
  sunAzimuth: z.number().min(0).max(360),
  sunElevation: z.number().min(2).max(89),
  fog: z.number().min(0).max(1),
  graph: z.boolean().describe("Elevation profile graph"),
  title: z.string(),
});

export const ElevationTrail: React.FC<z.infer<typeof elevationTrailSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const trip = useTrip(p.stops, p.mode, p.trackFile);
  const area = useMemo(() => {
    if (!trip) return null;
    const [[w, s], [e, n]] = bounds(trip.coords);
    const c: LonLat = [(w + e) / 2, (s + n) / 2];
    const r = Math.max(distanceKm([w, c[1]], [e, c[1]]), distanceKm([c[0], s], [c[0], n])) / 2;
    return { center: c, radius: Math.min(120, r * 1.35 + 3) };
  }, [trip]);
  const dem = useAsset<Dem>(area ? `dem:${area.center.join(",")}:${area.radius}` : null, () => loadDem(area!.center, area!.radius));
  const profile = useMemo(() => {
    if (!trip || !dem) return null;
    const n = 240;
    const gp = new GeoPath(trip.coords);
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return { t, km: gp.lengthKm * t, ele: dem.elevation(gp.at(t)) };
    });
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].ele - pts[i - 1].ele;
      if (d > 0) gain += d;
      else loss -= d;
    }
    return { pts, gain, loss, gp, min: Math.min(...pts.map((q) => q.ele)), max: Math.max(...pts.map((q) => q.ele)) };
  }, [trip, dem]);

  if (!trip || !dem || !profile || !area) return <AbsoluteFill style={{ background: "#9fb7cc" }} />;
  const color = !p.trailColor || p.trailColor === "auto" ? "#ff4d2e" : p.trailColor;
  const intro = 20;
  const prog = easeInOutCubic(clamp((frame - intro) / Math.max(1, durationInFrames - intro - 40)));
  const gp = profile.gp;
  const head = gp.at(prog);
  const ahead = gp.at(Math.min(1, prog + 0.04));
  const behind = gp.at(Math.max(0, prog - 0.04));
  const ex = p.exaggeration;
  const hv = toWorld(dem, head, ex);
  const dir = toWorld(dem, ahead, ex).sub(toWorld(dem, behind, ex)).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  // Chase camera: behind and above the hiker, looking a little ahead.
  const pos = hv.clone().sub(dir.clone().multiplyScalar(p.cameraDistanceKm)).add(new THREE.Vector3(0, p.cameraHeightKm, 0));
  pos.y = Math.max(pos.y, terrainHeightAt(dem, pos.x, pos.z, ex) + 0.3 * ex);
  const target = hv.clone().add(dir.clone().multiplyScalar(p.cameraDistanceKm * 0.25));
  const pose: CameraPose = { position: pos.toArray() as [number, number, number], target: target.toArray() as [number, number, number], fov: 55 };
  const reached = trip.stops.map((s) => {
    let best = 0;
    let bd = Infinity;
    trip.coords.forEach((c, i) => {
      const d = distanceKm(c, [s.lon, s.lat]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return trip.path.cum[best] / (trip.path.lengthKm || 1);
  });
  const markers = trip.stops.map((s, i) => ({
    at: [s.lon, s.lat] as LonLat,
    label: s.name,
    sub: `${Math.round(dem.elevation([s.lon, s.lat])).toLocaleString("en-IN")} m`,
    appear: i === 0 ? 0 : intro + Math.round(reached[i] * (durationInFrames - intro - 40)) - 20,
  }));
  return (
    <AbsoluteFill>
      <TerrainView
        dem={dem}
        style={p.terrainStyle}
        exaggeration={ex}
        camera={pose}
        sunAzimuth={p.sunAzimuth}
        sunElevation={p.sunElevation}
        fog={p.fog}
        trail={{ coords: trip.coords, progress: prog, color, widthKm: Math.max(0.015, p.cameraDistanceKm * 0.008), markerKm: Math.max(0.02, p.cameraDistanceKm * 0.012) }}
        markers={markers}
        frame={frame}
      />
      <Grain amount={0.04} />
      <Vignette amount={0.3} />
      {p.title ? (
        <div style={{ position: "absolute", left: 90, top: 70, font: `700 ${height * 0.055}px ${font("Oswald")}`, color: "white", textShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>{p.title}</div>
      ) : null}
      {p.graph ? <ElevationGraph profile={profile} progress={prog} color={color} width={width} height={height} stops={trip.stops.map((s, i) => ({ name: s.name, t: reached[i] }))} /> : null}
      <Sfx name="riser" at={0} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
      {reached.slice(1).map((r, i) => (
        <Sfx key={i} name="ping" at={intro + Math.round(r * (durationInFrames - intro - 40))} volume={p.sfxVolume * 0.6} enabled={p.sfx} />
      ))}
    </AbsoluteFill>
  );
};

type Profile = { pts: { t: number; km: number; ele: number }[]; gain: number; loss: number; min: number; max: number; gp: GeoPath };

const ElevationGraph: React.FC<{ profile: Profile; progress: number; color: string; width: number; height: number; stops: { name: string; t: number }[] }> = ({
  profile,
  progress,
  color,
  width,
  height,
  stops,
}) => {
  const u = height / 1080;
  const W = width - 180 * u;
  const H = 170 * u;
  const lo = profile.min - (profile.max - profile.min) * 0.1;
  const hi = profile.max + (profile.max - profile.min) * 0.15;
  const x = (t: number) => t * W;
  const y = (e: number) => H - ((e - lo) / Math.max(1, hi - lo)) * H;
  const line = profile.pts.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)},${y(q.ele).toFixed(1)}`).join("");
  const cur = profile.pts[Math.round(progress * (profile.pts.length - 1))];
  const done = profile.pts.filter((q) => q.t <= progress);
  const doneD = done.length > 1 ? done.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)},${y(q.ele).toFixed(1)}`).join("") + `L${x(done[done.length - 1].t)},${H}L0,${H}Z` : "";
  return (
    <div style={{ position: "absolute", left: 90 * u, bottom: 50 * u, width: W, height: H + 70 * u, background: "rgba(8,12,18,0.55)", borderRadius: 14 * u, padding: `${14 * u}px 0 0 0`, backdropFilter: "blur(6px)" }}>
      <div style={{ position: "absolute", top: 10 * u, left: 20 * u, right: 20 * u, display: "flex", justifyContent: "space-between", color: "white", font: `600 ${22 * u}px ${font("Inter")}` }}>
        <span>
          ALT <b style={{ font: `700 ${30 * u}px ${font("JetBrains Mono")}`, color }}>{Math.round(cur.ele).toLocaleString("en-IN")} m</b>
        </span>
        <span style={{ opacity: 0.85 }}>
          {formatKm(cur.km)} · ▲ {Math.round(profile.gain).toLocaleString("en-IN")} m · ▼ {Math.round(profile.loss).toLocaleString("en-IN")} m
        </span>
      </div>
      <svg width={W} height={H} style={{ position: "absolute", bottom: 20 * u, left: 0 }}>
        <path d={line + `L${W},${H}L0,${H}Z`} fill="rgba(255,255,255,0.12)" />
        <path d={line} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2 * u} />
        {doneD ? <path d={doneD} fill={color} opacity={0.45} /> : null}
        {stops.map((s, i) => (
          <g key={i} transform={`translate(${x(s.t)},0)`}>
            <line y1={0} y2={H} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
            <text y={H - 6 * u} x={4 * u} fill="white" opacity={0.8} style={{ font: `500 ${16 * u}px ${font("Inter")}` }}>
              {s.name}
            </text>
          </g>
        ))}
        <circle cx={x(cur.t)} cy={y(cur.ele)} r={9 * u} fill={color} stroke="white" strokeWidth={3 * u} />
      </svg>
    </div>
  );
};
