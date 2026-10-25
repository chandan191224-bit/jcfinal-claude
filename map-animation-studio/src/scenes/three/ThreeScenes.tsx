import React, { useLayoutEffect, useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GeoProjection } from "d3-geo";
import { base, zColorOrAuto, zRouteMode } from "../../lib/schema";
import { THEMES, type Theme } from "../../lib/themes";
import { useTrip, usePlaces } from "../../lib/useTrip";
import { clamp, easeInOutCubic, easeOutElastic, distanceKm } from "../../lib/geo";
import { useMapTexture } from "../../three/useMapTexture";
import { LandmarkMesh, makeCity, type ModelKind } from "../../three/Landmarks";
import type { LonLat } from "../../lib/places";
import { font } from "../../lib/fonts";
import { Grain, Vignette } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";

/* ---------------- shared 3D helpers ---------------- */

type Pose = { position: [number, number, number]; target: [number, number, number]; fov: number; ortho?: number };

const Rig: React.FC<{ pose: Pose }> = ({ pose }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(...pose.position);
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      (camera as THREE.OrthographicCamera).zoom = pose.ortho ?? 60;
    } else (camera as THREE.PerspectiveCamera).fov = pose.fov;
    camera.near = 0.01;
    camera.far = 500;
    camera.lookAt(new THREE.Vector3(...pose.target));
    camera.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};

function toScreen(pose: Pose, width: number, height: number, v: THREE.Vector3) {
  const cam: THREE.Camera = pose.ortho
    ? new THREE.OrthographicCamera(-width / 2 / pose.ortho, width / 2 / pose.ortho, height / 2 / pose.ortho, -height / 2 / pose.ortho, 0.01, 500)
    : new THREE.PerspectiveCamera(pose.fov, width / height, 0.01, 500);
  cam.position.set(...pose.position);
  cam.lookAt(new THREE.Vector3(...pose.target));
  cam.updateMatrixWorld();
  (cam as THREE.PerspectiveCamera).updateProjectionMatrix();
  const p = v.clone().project(cam);
  return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height, on: p.z < 1 };
}

const orbit = (target: [number, number, number], dist: number, height: number, angleDeg: number, fov = 40): Pose => {
  const a = (angleDeg * Math.PI) / 180;
  return { position: [target[0] + Math.sin(a) * dist, target[1] + height, target[2] + Math.cos(a) * dist], target, fov };
};

const Lights: React.FC<{ size: number; warm?: boolean }> = ({ size, warm }) => (
  <>
    <hemisphereLight args={[warm ? "#fff3dd" : "#eaf2ff", "#5a4a3a", 0.9]} />
    <directionalLight
      position={[size * 0.6, size * 1.2, size * 0.5]}
      intensity={2.2}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-left={-size}
      shadow-camera-right={size}
      shadow-camera-top={size}
      shadow-camera-bottom={-size}
      shadow-bias={-0.0005}
    />
  </>
);

const Label3D: React.FC<{ x: number; y: number; text: string; sub?: string; opacity: number; theme?: Theme }> = ({ x, y, text, sub, opacity }) => {
  const { height } = useVideoConfig();
  const u = height / 1080;
  return (
    <div style={{ position: "absolute", left: x, top: y, translate: "-50% -100%", opacity, textAlign: "center", pointerEvents: "none" }}>
      <div style={{ background: "rgba(12,16,22,0.85)", color: "white", padding: `${6 * u}px ${16 * u}px`, borderRadius: 10 * u, font: `700 ${30 * u}px ${font("Oswald")}`, whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.35)" }}>
        {text}
        {sub ? <div style={{ font: `500 ${18 * u}px ${font("Inter")}`, opacity: 0.85 }}>{sub}</div> : null}
      </div>
      <div style={{ width: 2 * u, height: 26 * u, background: "white", margin: "0 auto", opacity: 0.8 }} />
    </div>
  );
};

const TiltShift: React.FC<{ amount: number }> = ({ amount }) => (
  <>
    <AbsoluteFill style={{ backdropFilter: `blur(${amount}px)`, WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 38%)", maskImage: "linear-gradient(to bottom, black 0%, transparent 38%)" }} />
    <AbsoluteFill style={{ backdropFilter: `blur(${amount}px)`, WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 34%)", maskImage: "linear-gradient(to top, black 0%, transparent 34%)" }} />
  </>
);

/** Draws a route on a map texture canvas. */
const paintRoute = (coords: LonLat[], progress: number, color: string, width: number) => (ctx: CanvasRenderingContext2D, projection: GeoProjection) => {
  if (coords.length < 2 || progress <= 0) return;
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distanceKm(coords[i - 1], coords[i]));
  const L = cum[cum.length - 1] * progress;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < coords.length; i++) {
    let p = coords[i];
    if (cum[i] > L) {
      const f = (L - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      p = [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
    }
    const q = projection(p);
    if (!q) continue;
    if (!started) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
    started = true;
    if (cum[i] > L) break;
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = width * 1.8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
};

/* ---------------- 3D pop-up miniatures ---------------- */

export const popUpSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(2).describe("Landmarks or places; known landmarks get their own miniature"),
  mode: zRouteMode,
  routeColor: zColorOrAuto,
  modelScale: z.number().min(0.3).max(4),
  pitch: z.number().min(20).max(80).describe("Camera tilt"),
  turnDeg: z.number().min(0).max(180).describe("Camera orbit during the clip"),
  labels: z.boolean(),
});

export const PopUpMiniatures: React.FC<z.infer<typeof popUpSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const theme = THEMES[p.theme];
  const trip = useTrip(p.stops, p.mode, "");
  const color = !p.routeColor || p.routeColor === "auto" ? theme.route : p.routeColor;
  const intro = Math.round(fps * 0.8);
  const prog = easeInOutCubic(clamp((frame - intro) / Math.max(1, durationInFrames - intro - fps * 1.6)));
  const coords = useMemo(() => trip?.coords ?? [], [trip]);
  const plane = useMapTexture({
    points: coords,
    theme,
    borders: p.borders,
    layers: { rivers: true, states: "all" },
    extraPaint: paintRoute(coords, prog, color, 14),
    frameKey: Math.round(prog * 2000),
    padding: 0.2,
  });
  const fracs = useMemo(() => {
    if (!trip) return [];
    return trip.stops.map((s) => {
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
  }, [trip]);
  if (!trip || !plane) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;
  const h = plane.half;
  const head = plane.toPlane(trip.path.at(prog));
  const t = frame / durationInFrames;
  const target: [number, number, number] = [head[0] * 0.45, 0, head[1] * 0.45];
  const pitchRad = (p.pitch * Math.PI) / 180;
  const dist = h * 1.55;
  const pose = orbit(target, dist * Math.cos(pitchRad), dist * Math.sin(pitchRad), -p.turnDeg / 2 + p.turnDeg * t, 38);
  const pops = trip.stops.map((s, i) => {
    const reachF = intro + fracs[i] * (durationInFrames - intro - fps * 1.6);
    const k = easeOutElastic(clamp((frame - reachF + 6) / 30));
    const at = plane.toPlane([s.lon, s.lat]);
    return { s, k, at };
  });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${theme.ocean} 0%, ${theme.oceanEdge} 100%)` }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={{ fov: 38 }}>
        <Rig pose={pose} />
        <Lights size={h * 1.4} warm />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[h * 2, h * 2]} />
          <meshStandardMaterial map={plane.texture} roughness={0.9} />
        </mesh>
        {pops.map(({ s, k, at }, i) =>
          k > 0.001 ? (
            <group key={i} position={[at[0], 0, at[1]]} scale={[k * p.modelScale * 1.3, k * p.modelScale * 1.3, k * p.modelScale * 1.3]}>
              <LandmarkMesh kind={(s.model ?? "pin") as ModelKind} accent={color} />
            </group>
          ) : null,
        )}
        <mesh position={[head[0], 0.15, head[1]]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      </ThreeCanvas>
      {p.labels
        ? pops.map(({ s, k, at }, i) => {
            if (k < 0.3) return null;
            const q = toScreen(pose, width, height, new THREE.Vector3(at[0], 1.25 * p.modelScale * 1.3, at[1]));
            return q.on ? <Label3D key={i} x={q.x} y={q.y} text={s.name} opacity={clamp((k - 0.3) / 0.4)} /> : null;
          })
        : null}
      <Vignette amount={0.4} />
      {pops.map((_, i) => (
        <Sfx key={i} name="pop" at={intro + fracs[i] * (durationInFrames - intro - fps * 1.6) - 4} volume={p.sfxVolume} enabled={p.sfx} />
      ))}
    </AbsoluteFill>
  );
};

/* ---------------- 360° landmark swivel ---------------- */

export const swivelSchema = z.object({
  ...base,
  landmark: z.string().describe("Landmark or place"),
  model: z.enum(["auto", "tower", "dome", "arena", "statue", "clocktower", "skyscraper", "arch", "pyramid", "temple", "mountain", "bridge", "wall", "pin"]),
  turnDeg: z.number().min(30).max(720),
  heightDeg: z.number().min(5).max(80).describe("Camera elevation angle"),
  distance: z.number().min(2).max(20),
  city: z.boolean().describe("Surrounding miniature city"),
  tiltShift: z.number().min(0).max(20).describe("Tilt-shift blur (0 = off)"),
  label: z.boolean(),
});

export const LandmarkSwivel: React.FC<z.infer<typeof swivelSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const pl = usePlaces([p.landmark]);
  const city = useMemo(() => makeCity(7, 11, 1.1).filter((b) => Math.hypot(b.x, b.z) > 2.6), []);
  if (!pl) return <AbsoluteFill style={{ background: "#9fc2d8" }} />;
  const place = pl[0];
  const kind = (p.model === "auto" ? (place.model ?? "pin") : p.model) as ModelKind;
  const t = frame / durationInFrames;
  const e = easeInOutCubic(t);
  const el = (p.heightDeg * Math.PI) / 180;
  const pose = orbit([0, 0.9, 0], p.distance * Math.cos(el), p.distance * Math.sin(el), p.turnDeg * e - 30, 35);
  const rise = easeOutElastic(clamp(frame / 40));
  const q = toScreen(pose, width, height, new THREE.Vector3(0, 2.55 + Math.sin(frame / 12) * 0.05, 0));
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #9cc8e6 0%, #e5f1f8 70%)", filter: p.tiltShift > 0 ? "saturate(1.35) contrast(1.05)" : undefined }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={{ fov: 35 }}>
        <Rig pose={pose} />
        <fog attach="fog" args={["#e5f1f8", 12, 30]} />
        <Lights size={8} warm />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[14, 64]} />
          <meshStandardMaterial color="#9fbf7a" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
          <circleGeometry args={[1.5, 48]} />
          <meshStandardMaterial color="#e6dcc8" roughness={1} />
        </mesh>
        <group scale={[2 * rise, 2 * rise, 2 * rise]}>
          <LandmarkMesh kind={kind} accent={theme.accent} />
        </group>
        {p.city
          ? city.map((b, i) => (
              <mesh key={i} position={[b.x, (b.h * 0.22) / 2, b.z]} castShadow receiveShadow>
                <boxGeometry args={[b.w, b.h * 0.22, b.d]} />
                <meshStandardMaterial color={b.color} roughness={0.85} flatShading />
              </mesh>
            ))
          : null}
        <mesh position={[0, 2.55 + Math.sin(frame / 12) * 0.05, 0]}>
          <coneGeometry args={[0.1, 0.25, 16]} />
          <meshStandardMaterial color={theme.accent} emissive={theme.accent} emissiveIntensity={0.5} />
        </mesh>
      </ThreeCanvas>
      {p.tiltShift > 0 ? <TiltShift amount={p.tiltShift} /> : null}
      {p.label && q.on ? <Label3D x={q.x} y={q.y - 30} text={place.name} sub={place.country} opacity={clamp((frame - 20) / 15)} /> : null}
      <Vignette amount={0.25} />
      <Sfx name="whoosh" at={4} volume={p.sfxVolume} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

/* ---------------- extruded / isometric city ---------------- */

export const citySchema = z.object({
  ...base,
  look: z.enum(["isometric", "tilt-shift"]),
  seed: z.number().int().min(1).max(9999).describe("Change for a different city layout"),
  blocks: z.number().int().min(3).max(16),
  palette: z.enum(["corporate", "pastel", "night", "mono"]),
  buildingsFile: z.string().describe("Optional GeoJSON of real building footprints (height or building:levels property) in public/"),
  traffic: z.boolean(),
  title: z.string(),
});

const PALETTES = {
  corporate: { ground: "#dfe6ee", road: "#c3ccd6", b: ["#ffffff", "#e9eef5", "#cfdcec", "#2f6fed", "#9db8e8"], bg: ["#eef3f8", "#dce6f0"] },
  pastel: { ground: "#e7f0dc", road: "#d6d2c4", b: ["#f8d5c2", "#f3e6b5", "#cfe5d8", "#c8d8f0", "#f1c6d3"], bg: ["#fdf6ec", "#f2e7d8"] },
  night: { ground: "#141b2b", road: "#0c1220", b: ["#27324d", "#1f2a40", "#33415f", "#ffb347", "#3d4f78"], bg: ["#0b1020", "#03060d"] },
  mono: { ground: "#e9e9e9", road: "#d0d0d0", b: ["#ffffff", "#f2f2f2", "#dcdcdc", "#c8c8c8", "#111111"], bg: ["#f5f5f5", "#e4e4e4"] },
} as const;

type Footprint = { shape: THREE.Shape; h: number; cx: number; cz: number };

function useBuildings(file: string): Footprint[] | null {
  const [data, setData] = React.useState<Footprint[] | null>(null);
  React.useEffect(() => {
    if (!file) return;
    {
      const h = delayRender("Loading buildings");
      fetch(staticFile(file))
        .then((r) => r.json())
        .then((gj) => {
          const feats = (gj.features ?? []) as { geometry: { type: string; coordinates: number[][][] | number[][][][] }; properties: Record<string, unknown> }[];
          const polys: { ring: number[][]; h: number }[] = [];
          for (const f of feats) {
            const hgt = Number(f.properties?.height ?? 0) || Number(f.properties?.["building:levels"] ?? 0) * 3.2 || 9;
            if (f.geometry?.type === "Polygon") polys.push({ ring: (f.geometry.coordinates as number[][][])[0], h: hgt });
            if (f.geometry?.type === "MultiPolygon") for (const pg of f.geometry.coordinates as number[][][][]) polys.push({ ring: pg[0], h: hgt });
          }
          const all = polys.flatMap((p) => p.ring);
          const lon0 = all.reduce((a, c) => a + c[0], 0) / Math.max(1, all.length);
          const lat0 = all.reduce((a, c) => a + c[1], 0) / Math.max(1, all.length);
          const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
          const ky = 110540;
          const span = Math.max(...all.map((c) => Math.max(Math.abs((c[0] - lon0) * kx), Math.abs((c[1] - lat0) * ky))), 1);
          const s = 5 / span;
          setData(
            polys.map((p) => {
              const shape = new THREE.Shape(p.ring.map((c) => new THREE.Vector2((c[0] - lon0) * kx * s, (c[1] - lat0) * ky * s)));
              const cx = p.ring.reduce((a, c) => a + (c[0] - lon0) * kx * s, 0) / p.ring.length;
              const cz = -p.ring.reduce((a, c) => a + (c[1] - lat0) * ky * s, 0) / p.ring.length;
              return { shape, h: p.h * s, cx, cz };
            }),
          );
          continueRender(h);
        })
        .catch(() => continueRender(h));
    }
  }, [file]);
  return file ? data : null;
}

export const ExtrudedCity: React.FC<z.infer<typeof citySchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const pal = PALETTES[p.palette];
  const city = useMemo(
    () => makeCity(p.seed, p.blocks, 1, [...pal.b]).map((b) => (p.look === "tilt-shift" ? { ...b, h: b.h * 0.45 } : b)),
    [p.seed, p.blocks, pal, p.look],
  );
  const real = useBuildings(p.buildingsFile);
  const half = p.blocks / 2 + 0.5;
  const t = frame / durationInFrames;
  const iso = p.look === "isometric";
  const pose: Pose = iso
    ? { position: [half * 2 * Math.cos(Math.PI / 4 + t * 0.4), half * 1.7, half * 2 * Math.sin(Math.PI / 4 + t * 0.4)], target: [0, 0, 0], fov: 30, ortho: (height / (half * 2.4)) * (1 + 0.15 * t) }
    : orbit([0, 0, 0], half * 1.35, half * 1.55, 30 + 40 * t, 30);
  const grow = (delay: number) => easeOutElastic(clamp((frame / fps - 0.2 - delay * 1.6) / 0.9));
  const cars = p.traffic
    ? Array.from({ length: p.blocks * 6 }, (_, i) => {
        const lane = (i % p.blocks) - (p.blocks - 1) / 2 + 0.5;
        const horizontal = i % 2 === 0;
        const speed = 0.02 + ((i * 37) % 10) * 0.003;
        const pos = ((((i * 0.37 + frame * speed) % (half * 2)) + half * 2) % (half * 2)) - half;
        return { x: horizontal ? pos : lane, z: horizontal ? lane : pos, horizontal, color: ["#ff4d4d", "#ffd34d", "#4dd4ff", "#ffffff"][i % 4] };
      })
    : [];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)`, filter: p.look === "tilt-shift" ? "saturate(1.5) contrast(1.06)" : undefined }}>
      <ThreeCanvas width={width} height={height} shadows orthographic={iso} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={iso ? { zoom: 60, position: [10, 10, 10] } : { fov: 32 }}>
        <Rig pose={pose} />
        <Lights size={half * 1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[half * 2.2, half * 2.2]} />
          <meshStandardMaterial color={pal.road} roughness={1} />
        </mesh>
        {real
          ? real.map((b, i) => {
              const g = grow(Math.hypot(b.cx, b.cz) / 6);
              return (
                <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, Math.max(0.001, g)]} castShadow receiveShadow>
                  <extrudeGeometry args={[b.shape, { depth: b.h, bevelEnabled: false }]} />
                  <meshStandardMaterial color={pal.b[i % pal.b.length]} roughness={0.8} flatShading />
                </mesh>
              );
            })
          : null}
        {!real
          ? Array.from({ length: p.blocks * p.blocks }, (_, i) => {
              const bx = (i % p.blocks) - (p.blocks - 1) / 2;
              const bz = Math.floor(i / p.blocks) - (p.blocks - 1) / 2;
              return (
                <mesh key={`g${i}`} position={[bx, 0.01, bz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[0.86, 0.86]} />
                  <meshStandardMaterial color={pal.ground} roughness={1} />
                </mesh>
              );
            })
          : null}
        {!real
          ? city.map((b, i) => {
              const g = grow(b.delay);
              if (g <= 0.001) return null;
              return (
                <mesh key={i} position={[b.x, (b.h * g) / 2, b.z]} castShadow receiveShadow>
                  <boxGeometry args={[b.w, Math.max(0.001, b.h * g), b.d]} />
                  <meshStandardMaterial color={b.color} roughness={0.75} flatShading emissive={p.palette === "night" && i % 5 === 3 ? "#ffb347" : "#000000"} emissiveIntensity={0.4} />
                </mesh>
              );
            })
          : null}
        {cars.map((c, i) => (
          <mesh key={`c${i}`} position={[c.x, 0.04, c.z]} rotation={[0, c.horizontal ? 0 : Math.PI / 2, 0]} castShadow>
            <boxGeometry args={[0.1, 0.06, 0.05]} />
            <meshStandardMaterial color={c.color} />
          </mesh>
        ))}
      </ThreeCanvas>
      {p.look === "tilt-shift" ? <TiltShift amount={9} /> : null}
      {p.title ? (
        <div style={{ position: "absolute", left: 90, top: 70, font: `800 ${height * 0.06}px ${font("Poppins")}`, color: p.palette === "night" ? "#fff" : "#1f2933" }}>{p.title}</div>
      ) : null}
      {p.look === "tilt-shift" ? <Grain amount={0.04} /> : null}
      <Sfx name="riser" at={0} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
    </AbsoluteFill>
  );
};

/* ---------------- unfolding paper map ---------------- */

export const unfoldSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(1).describe("Places shown on the map (a route is drawn after it unfolds if 2+)"),
  mode: zRouteMode,
  routeColor: zColorOrAuto,
  columns: z.number().int().min(2).max(6),
  unfoldSec: z.number().min(1).max(10),
  table: z.string().describe("Background (table) colour"),
});

const Panel: React.FC<{ tex: THREE.Texture; u0: number; u1: number; v0: number; v1: number; w: number; h: number; offsetY: number }> = ({ tex, u0, u1, v0, v1, w, h, offsetY }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    g.translate(w / 2, offsetY, 0);
    return g;
  }, [u0, u1, v0, v1, w, h, offsetY]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.95} />
    </mesh>
  );
};

export const UnfoldingPaperMap: React.FC<z.infer<typeof unfoldSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const theme = THEMES[p.theme];
  const trip = useTrip(p.stops.length === 1 ? [p.stops[0], p.stops[0]] : p.stops, p.mode, "");
  const color = !p.routeColor || p.routeColor === "auto" ? theme.route : p.routeColor;
  const unfoldF = p.unfoldSec * fps;
  const routeT = easeInOutCubic(clamp((frame - unfoldF - 10) / Math.max(1, durationInFrames - unfoldF - fps * 1.5)));
  const coords = useMemo(() => trip?.coords ?? [], [trip]);
  const plane = useMapTexture({
    points: coords,
    theme,
    borders: p.borders,
    layers: { rivers: true, graticule: true },
    extraPaint: (ctx, projection) => {
      paintRoute(coords, routeT, color, 12)(ctx, projection);
      // Stop markers appear as the route reaches them; labels that would collide are skipped.
      const placed: [number, number][] = [];
      trip?.stops.forEach((st, i) => {
        const q = projection([st.lon, st.lat]);
        const reach = trip.stops.length > 1 ? i / (trip.stops.length - 1) : 0;
        if (!q || routeT < reach - 0.02) return;
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = "#f3e6c4";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(q[0], q[1], 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (placed.some(([x, y]) => Math.abs(x - q[0]) < 260 && Math.abs(y - q[1]) < 60)) {
          ctx.restore();
          return;
        }
        placed.push([q[0], q[1]]);
        ctx.font = `600 44px "IM Fell English", serif`;
        ctx.fillStyle = "#3b2612";
        ctx.strokeStyle = "rgba(240,225,190,0.9)";
        ctx.lineWidth = 10;
        ctx.strokeText(st.name, q[0] + 26, q[1] + 14);
        ctx.fillText(st.name, q[0] + 26, q[1] + 14);
        ctx.restore();
      });
      // Worn paper edges.
      const s = ctx.canvas.width;
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s * 0.72);
      g.addColorStop(0, "rgba(60,35,10,0)");
      g.addColorStop(1, "rgba(60,35,10,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    },
    frameKey: Math.round(routeT * 1500),
    padding: 0.25,
  });
  if (!plane || !plane.texture) return <AbsoluteFill style={{ background: p.table }} />;
  const cols = p.columns;
  const W = 16;
  const H = 12;
  const pw = W / cols;
  // Vertical fold opens first, then the accordion.
  const v = easeInOutCubic(clamp(frame / (unfoldF * 0.4)));
  const u = easeInOutCubic(clamp((frame - unfoldF * 0.35) / (unfoldF * 0.65)));
  const fold = (1 - u) * Math.PI * 0.94;
  const vfold = (1 - v) * Math.PI * 0.97;
  // Builds the accordion: each panel hangs off the previous one's right edge.
  const chain = (i: number): React.ReactNode => {
    if (i >= cols) return null;
    const angle = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * fold;
    const u0 = i / cols;
    const u1 = (i + 1) / cols;
    return (
      <group position={[i === 0 ? 0 : pw, 0, 0]} rotation={[0, angle, 0]}>
        <Panel tex={plane.texture!} u0={u0} u1={u1} v0={0} v1={0.5} w={pw} h={H / 2} offsetY={-H / 4} />
        <group rotation={[vfold, 0, 0]}>
          <Panel tex={plane.texture!} u0={u0} u1={u1} v0={0.5} v1={1} w={pw} h={H / 2} offsetY={H / 4} />
        </group>
        {chain(i + 1)}
      </group>
    );
  };
  const push = easeInOutCubic(clamp((frame - unfoldF) / (durationInFrames - unfoldF)));
  const pose: Pose = { position: [0, 4 - push * 1.2, 15.5 - push * 4], target: [0, 0, 0], fov: 42 };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, ${p.table} 0%, #1b120b 100%)` }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={{ fov: 42 }}>
        <Rig pose={pose} />
        <hemisphereLight args={["#fff4e0", "#3a2a1a", 1.0]} />
        <directionalLight position={[-6, 10, 12]} intensity={2.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <group position={[-W / 2 + (1 - u) * (W / 2 - pw / 2), 0, 0]} rotation={[-0.32, 0, 0]}>
          {chain(0)}
        </group>
      </ThreeCanvas>
      <Grain amount={0.06} />
      <Vignette amount={0.5} />
      <Sfx name="paper" at={2} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name="paper" at={Math.round(unfoldF * 0.45)} volume={p.sfxVolume} enabled={p.sfx} />
    </AbsoluteFill>
  );
};
