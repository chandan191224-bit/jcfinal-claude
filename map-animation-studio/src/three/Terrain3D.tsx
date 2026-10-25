import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Dem } from "../lib/terrain";
import type { LonLat } from "../lib/places";
import { font } from "../lib/fonts";
import { clamp } from "../lib/geo";

export const TERRAIN_STYLES = ["realistic", "lowpoly", "paper", "night", "golden-hour", "blueprint"] as const;
export type TerrainStyle = (typeof TERRAIN_STYLES)[number];

export type CameraPose = { position: [number, number, number]; target: [number, number, number]; fov: number };

type Palette = { sky: [string, string]; fog: string; water: string; low: string; mid: string; high: string; rock: string; snow: string; sun: string; ambient: number; sunIntensity: number };

const PALETTES: Record<TerrainStyle, Palette> = {
  realistic: { sky: ["#6fa6d6", "#dfe9f2"], fog: "#c9d7e3", water: "#2f5f8a", low: "#55703a", mid: "#7d7458", high: "#8a8580", rock: "#6f6a66", snow: "#f4f7fb", sun: "#fff4e0", ambient: 0.55, sunIntensity: 2.4 },
  lowpoly: { sky: ["#7fd3e6", "#f7f1df"], fog: "#e9f1ef", water: "#3fb8c9", low: "#8cc56b", mid: "#c9b27a", high: "#9b8fa8", rock: "#7d7590", snow: "#ffffff", sun: "#ffffff", ambient: 0.75, sunIntensity: 2.0 },
  paper: { sky: ["#efe6cf", "#f6efdc"], fog: "#efe6cf", water: "#b9cfd6", low: "#efe2c2", mid: "#e2cfa3", high: "#cdb88a", rock: "#b9a47a", snow: "#fbf7ec", sun: "#fff8ea", ambient: 0.85, sunIntensity: 1.6 },
  night: { sky: ["#030712", "#14213d"], fog: "#0b1428", water: "#0a1a33", low: "#1b2a3a", mid: "#24324a", high: "#34425c", rock: "#2a3448", snow: "#b9c8e6", sun: "#9db7ff", ambient: 0.25, sunIntensity: 1.2 },
  "golden-hour": { sky: ["#f59e5b", "#ffe0b0"], fog: "#f2c79b", water: "#4b6a8a", low: "#6d6a3a", mid: "#8f6f4a", high: "#9a7c66", rock: "#7d5f52", snow: "#ffe9d6", sun: "#ffb26b", ambient: 0.45, sunIntensity: 3.0 },
  blueprint: { sky: ["#0d3b78", "#12488f"], fog: "#0d3b78", water: "#0d3b78", low: "#1a5aa8", mid: "#2164b8", high: "#2a70c4", rock: "#2a70c4", snow: "#cfe3ff", sun: "#ffffff", ambient: 0.8, sunIntensity: 1.2 },
};

export type TerrainMarker = { at: LonLat; label?: string; sub?: string; color?: string; appear?: number };

type Props = {
  dem: Dem;
  style: TerrainStyle;
  exaggeration: number;
  segments?: number;
  /** Metres; 0 = automatic from latitude. */
  snowline?: number;
  camera: CameraPose;
  sunAzimuth?: number;
  sunElevation?: number;
  fog?: number;
  trail?: { coords: LonLat[]; progress: number; color: string; widthKm: number } | null;
  markers?: TerrainMarker[];
  frame: number;
  children?: React.ReactNode;
};

const RAD = Math.PI / 180;

/** Local km (x east, y north) and height to three.js space (y up, -z north). */
export const toWorld = (dem: Dem, p: LonLat, exaggeration: number, lift = 0): THREE.Vector3 => {
  const [x, y] = dem.toLocal(p);
  return new THREE.Vector3(x, ((dem.elevation(p) + lift) / 1000) * exaggeration, -y);
};

export function terrainHeightAt(dem: Dem, x: number, z: number, exaggeration: number) {
  return (dem.elevation(dem.fromLocal(x, -z)) / 1000) * exaggeration;
}

function useTerrainGeometry(dem: Dem, style: TerrainStyle, exaggeration: number, segments: number, snowline: number) {
  return useMemo(() => {
    const seg = style === "lowpoly" ? Math.min(segments, 70) : segments;
    const r = dem.radiusKm;
    const pal = PALETTES[style];
    const n = seg + 1;
    const pos = new Float32Array(n * n * 3);
    const elev = new Float32Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = -r + (2 * r * i) / seg;
        const y = r - (2 * r * j) / seg;
        const e = dem.elevation(dem.fromLocal(x, y));
        const k = j * n + i;
        elev[k] = e;
        pos[k * 3] = x;
        pos[k * 3 + 1] = (Math.max(e, 0) / 1000) * exaggeration;
        pos[k * 3 + 2] = -y;
      }
    const idx: number[] = [];
    for (let j = 0; j < seg; j++)
      for (let i = 0; i < seg; i++) {
        const a = j * n + i;
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    let g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const normals = g.getAttribute("normal") as THREE.BufferAttribute;
    const snow = snowline > 0 ? snowline : Math.max(2600, 5600 - 75 * Math.max(0, Math.abs(dem.center[1]) - 22));
    const cols = new Float32Array(n * n * 3);
    const c = new THREE.Color();
    const cl = (h: string) => new THREE.Color(h);
    const [cw, cLow, cMid, cHigh, cRock, cSnow] = [pal.water, pal.low, pal.mid, pal.high, pal.rock, pal.snow].map(cl);
    const lo = Math.max(0, dem.min);
    for (let k = 0; k < n * n; k++) {
      const e = elev[k];
      const ny = normals.getY(k);
      if (e <= 0.5) c.copy(cw);
      else {
        const t = clamp((e - lo) / Math.max(1, snow - lo));
        if (t < 0.45) c.copy(cLow).lerp(cMid, t / 0.45);
        else c.copy(cMid).lerp(cHigh, (t - 0.45) / 0.55);
        if (ny < 0.72) c.lerp(cRock, clamp((0.72 - ny) / 0.25));
        const snowAmt = clamp((e - snow) / 400) * clamp((ny - 0.55) / 0.2);
        if (snowAmt > 0) c.lerp(cSnow, snowAmt);
        if (style === "paper") {
          // Contour bands every 200 m.
          const band = Math.abs(((e % 200) + 200) % 200 - 100) < 8 ? 0.82 : 1;
          c.multiplyScalar(band);
        }
      }
      cols[k * 3] = c.r;
      cols[k * 3 + 1] = c.g;
      cols[k * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    if (style === "lowpoly") {
      g = g.toNonIndexed();
      g.computeVertexNormals();
    }
    return g;
  }, [dem, style, exaggeration, segments, snowline]);
}

function useTrailGeometry(dem: Dem, coords: LonLat[] | null, exaggeration: number, widthKm: number) {
  return useMemo(() => {
    if (!coords || coords.length < 2) return null;
    // Resample evenly so the ribbon follows the ground closely.
    const pts: THREE.Vector3[] = [];
    for (let i = 1; i < coords.length; i++) {
      const a = dem.toLocal(coords[i - 1]);
      const b = dem.toLocal(coords[i]);
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n;
        const y = a[1] + ((b[1] - a[1]) * k) / n;
        const e = dem.elevation(dem.fromLocal(x, y));
        pts.push(new THREE.Vector3(x, (Math.max(e, 0) / 1000) * exaggeration + 0.02 * exaggeration, -y));
      }
    }
    const pos = new Float32Array(pts.length * 2 * 3);
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[Math.min(pts.length - 1, i + 1)];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = (-dz / len) * widthKm * 0.5;
      const nz = (dx / len) * widthKm * 0.5;
      pos.set([pts[i].x + nx, pts[i].y, pts[i].z + nz, pts[i].x - nx, pts[i].y, pts[i].z - nz], i * 6);
    }
    const idx: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return { g, pts };
  }, [dem, coords, exaggeration, widthKm]);
}

const Rig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...pose.position);
    cam.fov = pose.fov;
    cam.near = 0.05;
    cam.far = 2000;
    cam.lookAt(new THREE.Vector3(...pose.target));
    cam.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};

/** Projects a 3D point to screen pixels with the same camera the canvas uses. */
export function projectToScreen(pose: CameraPose, width: number, height: number, v: THREE.Vector3) {
  const cam = new THREE.PerspectiveCamera(pose.fov, width / height, 0.05, 2000);
  cam.position.set(...pose.position);
  cam.lookAt(new THREE.Vector3(...pose.target));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const p = v.clone().project(cam);
  return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height, visible: p.z < 1 && p.z > -1 };
}

export const TerrainView: React.FC<Props> = ({
  dem,
  style,
  exaggeration,
  segments = 256,
  snowline = 0,
  camera,
  sunAzimuth = 135,
  sunElevation = 28,
  fog = 0.5,
  trail,
  markers = [],
  frame,
  children,
}) => {
  const { width, height } = useVideoConfig();
  const pal = PALETTES[style];
  const geom = useTerrainGeometry(dem, style, exaggeration, segments, snowline);
  const trailGeo = useTrailGeometry(dem, trail?.coords ?? null, exaggeration, trail?.widthKm ?? 0.1);
  const r = dem.radiusKm;
  const sunDir = new THREE.Vector3(
    Math.sin(sunAzimuth * RAD) * Math.cos(sunElevation * RAD),
    Math.sin(sunElevation * RAD),
    -Math.cos(sunAzimuth * RAD) * Math.cos(sunElevation * RAD),
  );
  const sunPos = sunDir.clone().multiplyScalar(r * 3);
  const headIdx = trailGeo ? Math.round(clamp(trail!.progress) * (trailGeo.pts.length - 1)) : 0;
  if (trailGeo) trailGeo.g.setDrawRange(0, headIdx * 6);
  const head = trailGeo ? trailGeo.pts[headIdx] : null;

  const labels = markers
    .filter((m) => m.label && frame >= (m.appear ?? 0))
    .map((m, i) => {
      const v = toWorld(dem, m.at, exaggeration, 60);
      const s = projectToScreen(camera, width, height, v);
      const a = clamp((frame - (m.appear ?? 0)) / 15);
      if (!s.visible || s.x < -200 || s.x > width + 200) return null;
      const unit = height / 1080;
      return (
        <div key={i} style={{ position: "absolute", left: s.x, top: s.y, transform: "translate(-50%, -100%)", opacity: a, textAlign: "center", pointerEvents: "none" }}>
          <div
            style={{
              font: `700 ${34 * unit}px ${font("Oswald")}`,
              color: style === "paper" ? "#3b2612" : "#ffffff",
              textShadow: style === "paper" ? "0 0 8px #f6efdc" : "0 2px 12px rgba(0,0,0,0.7)",
              letterSpacing: 1,
              whiteSpace: "nowrap",
            }}
          >
            {m.label}
          </div>
          {m.sub ? (
            <div style={{ font: `500 ${22 * unit}px ${font("Inter")}`, color: style === "paper" ? "#5b3d1e" : "#e8eef5", textShadow: "0 2px 8px rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}>{m.sub}</div>
          ) : null}
          <div style={{ width: 2 * unit, height: 70 * unit * a, background: m.color ?? "#ffffff", margin: "6px auto 0", boxShadow: "0 0 6px rgba(0,0,0,0.5)" }} />
        </div>
      );
    });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 62%, ${pal.fog} 100%)` }}>
      <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} camera={{ fov: camera.fov, near: 0.05, far: 2000 }}>
        <Rig pose={camera} />
        <fog attach="fog" args={[pal.fog, r * (2.6 - fog * 1.8), r * (6 - fog * 3.5)]} />
        <hemisphereLight args={[pal.sky[1], pal.low, pal.ambient]} />
        <directionalLight
          position={sunPos.toArray()}
          intensity={pal.sunIntensity}
          color={pal.sun}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-r * 1.4}
          shadow-camera-right={r * 1.4}
          shadow-camera-top={r * 1.4}
          shadow-camera-bottom={-r * 1.4}
          shadow-camera-near={0.1}
          shadow-camera-far={r * 8}
          shadow-bias={-0.0004}
        />
        <mesh geometry={geom} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading={style === "lowpoly"} wireframe={style === "blueprint"} />
        </mesh>
        {style === "blueprint" ? (
          <mesh geometry={geom}>
            <meshBasicMaterial color="#0d3b78" polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
        ) : null}
        {trailGeo && trail ? (
          <>
            <mesh geometry={trailGeo.g}>
              <meshBasicMaterial color={trail.color} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
            </mesh>
            {head ? (
              <group position={head.toArray()}>
                <mesh position={[0, 0.05 * exaggeration, 0]}>
                  <sphereGeometry args={[Math.max(0.04, r * 0.012), 24, 24]} />
                  <meshBasicMaterial color={trail.color} />
                </mesh>
                <mesh position={[0, r * 0.06, 0]}>
                  <cylinderGeometry args={[r * 0.0015, r * 0.0015, r * 0.12, 8]} />
                  <meshBasicMaterial color={trail.color} transparent opacity={0.6} />
                </mesh>
              </group>
            ) : null}
          </>
        ) : null}
        {children}
      </ThreeCanvas>
      <AbsoluteFill style={{ pointerEvents: "none" }}>{labels}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------- camera moves ---------------- */

export const TERRAIN_MOVES = ["sweep", "orbit", "flyover", "reveal", "dolly-in"] as const;
export type TerrainMove = (typeof TERRAIN_MOVES)[number];

/** Deterministic drone moves around a target point (km, three.js space), kept above the ground. */
export function terrainCamera(
  dem: Dem,
  exaggeration: number,
  target: LonLat,
  move: TerrainMove,
  t: number,
  opts: { distanceKm: number; heightKm: number; headingDeg: number; fov?: number; turnDeg?: number },
): CameraPose {
  const tgt = toWorld(dem, target, exaggeration);
  const d = opts.distanceKm;
  const hd = opts.headingDeg * RAD;
  const e = t * t * (3 - 2 * t);
  let pos: THREE.Vector3;
  let look = tgt.clone();
  if (move === "orbit") {
    const a = hd + (opts.turnDeg ?? 120) * RAD * t;
    pos = new THREE.Vector3(tgt.x - Math.sin(a) * d, tgt.y + opts.heightKm, tgt.z + Math.cos(a) * d);
  } else if (move === "sweep") {
    // Pass the target sideways at low altitude while keeping it in frame.
    const side = new THREE.Vector3(Math.cos(hd), 0, Math.sin(hd));
    const back = new THREE.Vector3(-Math.sin(hd), 0, Math.cos(hd));
    pos = tgt.clone().add(back.multiplyScalar(d)).add(side.multiplyScalar((e - 0.5) * d * 1.4));
    pos.y = tgt.y * 0.55 + opts.heightKm;
    look = tgt.clone().add(new THREE.Vector3(0, -tgt.y * 0.15, 0));
  } else if (move === "flyover") {
    const dir = new THREE.Vector3(Math.sin(hd), 0, -Math.cos(hd));
    pos = tgt.clone().add(dir.clone().multiplyScalar((t - 0.6) * d * 2));
    pos.y = tgt.y + opts.heightKm;
    look = pos.clone().add(dir.multiplyScalar(d)).setY(tgt.y * 0.6);
  } else if (move === "reveal") {
    const back = new THREE.Vector3(-Math.sin(hd), 0, Math.cos(hd));
    pos = tgt.clone().add(back.multiplyScalar(d * (1.1 - 0.25 * e)));
    pos.y = tgt.y * (0.25 + 0.75 * e) + opts.heightKm * (0.4 + 0.6 * e);
    look = tgt.clone().setY(tgt.y * (0.6 + 0.4 * e));
  } else {
    const back = new THREE.Vector3(-Math.sin(hd), 0, Math.cos(hd));
    pos = tgt.clone().add(back.multiplyScalar(d * (1.6 - 0.9 * e)));
    pos.y = tgt.y + opts.heightKm * (1.3 - 0.6 * e);
  }
  // Terrain clearance.
  const ground = terrainHeightAt(dem, pos.x, pos.z, exaggeration);
  pos.y = Math.max(pos.y, ground + 0.25 * exaggeration);
  return { position: pos.toArray() as [number, number, number], target: look.toArray() as [number, number, number], fov: opts.fov ?? 50 };
}
