import React, { useMemo } from "react";
import * as THREE from "three";
import type { LandmarkModel } from "../lib/places";
import { seeded } from "../lib/geo";

/**
 * Stylised low-poly landmark miniatures (unit height ≈ 1). They are recognisable silhouettes,
 * not survey models; scale them per scene.
 */
export type ModelKind = LandmarkModel | "pin" | "house";

const M: React.FC<{ color: string; emissive?: string }> = ({ color, emissive }) => (
  <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} flatShading emissive={emissive ?? "#000000"} />
);

const Frustum: React.FC<{ r0: number; r1: number; h: number; y: number; color: string; sides?: number }> = ({ r0, r1, h, y, color, sides = 4 }) => (
  <mesh position={[0, y + h / 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
    <cylinderGeometry args={[r1, r0, h, sides]} />
    <M color={color} />
  </mesh>
);

const Box: React.FC<{ w: number; h: number; d: number; x?: number; y?: number; z?: number; color: string }> = ({ w, h, d, x = 0, y = 0, z = 0, color }) => (
  <mesh position={[x, y + h / 2, z]} castShadow receiveShadow>
    <boxGeometry args={[w, h, d]} />
    <M color={color} />
  </mesh>
);

const Dome: React.FC<{ r: number; y: number; color: string; onion?: boolean }> = ({ r, y, color, onion }) => {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const a = (t * Math.PI) / 2;
      let x = Math.cos(a) * r;
      if (onion) x *= 1 + 0.25 * Math.sin(t * Math.PI) - 0.3 * t * t;
      pts.push(new THREE.Vector2(Math.max(0.001, x), Math.sin(a) * r * (onion ? 1.35 : 1)));
    }
    pts.push(new THREE.Vector2(0.001, r * (onion ? 1.6 : 1.1)));
    return new THREE.LatheGeometry(pts, 24);
  }, [r, onion]);
  return (
    <mesh geometry={geo} position={[0, y, 0]} castShadow>
      <M color={color} />
    </mesh>
  );
};

export const LandmarkMesh: React.FC<{ kind: ModelKind; color?: string; accent?: string }> = ({ kind, color = "#f1e7d0", accent = "#d7263d" }) => {
  switch (kind) {
    case "tower":
      return (
        <group>
          <Frustum r0={0.36} r1={0.2} h={0.28} y={0} color="#8a6e4b" />
          <Frustum r0={0.2} r1={0.11} h={0.3} y={0.28} color="#8a6e4b" />
          <Frustum r0={0.11} r1={0.04} h={0.38} y={0.58} color="#8a6e4b" />
          <Frustum r0={0.03} r1={0.005} h={0.1} y={0.96} color="#6d553a" />
        </group>
      );
    case "dome":
      return (
        <group>
          <Box w={0.9} h={0.08} d={0.9} color="#e9e2d6" />
          <Box w={0.55} h={0.35} d={0.55} y={0.08} color={color} />
          <mesh position={[0, 0.43, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.08, 20]} />
            <M color={color} />
          </mesh>
          <Dome r={0.22} y={0.5} color={color} onion />
          {[
            [-0.4, -0.4],
            [0.4, -0.4],
            [-0.4, 0.4],
            [0.4, 0.4],
          ].map(([x, z], i) => (
            <group key={i} position={[x, 0.08, z]}>
              <mesh position={[0, 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.04, 0.5, 8]} />
                <M color={color} />
              </mesh>
              <Dome r={0.045} y={0.5} color={color} />
            </group>
          ))}
        </group>
      );
    case "arena": {
      const n = 28;
      return (
        <group>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            const h = i < n * 0.35 ? 0.32 : 0.45;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.48, h / 2, Math.sin(a) * 0.36]} rotation={[0, -a, 0]} castShadow>
                <boxGeometry args={[0.04, h, 0.1]} />
                <M color="#c9a77a" />
              </mesh>
            );
          })}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.36, 24]} />
            <M color="#b48a5a" />
          </mesh>
        </group>
      );
    }
    case "statue":
      return (
        <group>
          <Frustum r0={0.32} r1={0.24} h={0.3} y={0} color="#9b8f7d" />
          <mesh position={[0, 0.58, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.12, 0.56, 10]} />
            <M color={color === "#f1e7d0" ? "#5fa58f" : color} />
          </mesh>
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.06, 12, 12]} />
            <M color="#5fa58f" />
          </mesh>
          <mesh position={[0.1, 0.92, 0]} rotation={[0, 0, -0.35]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <M color="#5fa58f" />
          </mesh>
          <mesh position={[0.15, 1.08, 0]} castShadow>
            <coneGeometry args={[0.04, 0.08, 8]} />
            <M color="#ffd34d" emissive="#a06a00" />
          </mesh>
        </group>
      );
    case "clocktower":
      return (
        <group>
          <Box w={0.22} h={0.8} d={0.22} color="#c8a86b" />
          <Box w={0.26} h={0.16} d={0.26} y={0.62} color="#b8955a" />
          <mesh position={[0, 0.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.17, 0.26, 4]} />
            <M color="#4a5a5a" />
          </mesh>
          <mesh position={[0, 0.7, 0.132]}>
            <circleGeometry args={[0.06, 20]} />
            <M color="#f6f1e1" />
          </mesh>
        </group>
      );
    case "skyscraper":
      return (
        <group>
          {[0.26, 0.21, 0.16, 0.12, 0.08].map((r, i) => (
            <mesh key={i} position={[0, 0.1 + i * 0.17, 0]} castShadow>
              <cylinderGeometry args={[r * 0.8, r, 0.2, 6]} />
              <M color="#b9c7d6" />
            </mesh>
          ))}
          <mesh position={[0, 1.05, 0]} castShadow>
            <coneGeometry args={[0.03, 0.3, 6]} />
            <M color="#dbe4ee" />
          </mesh>
        </group>
      );
    case "arch":
      return (
        <group>
          <Box w={0.18} h={0.62} d={0.2} x={-0.22} color="#c58b5a" />
          <Box w={0.18} h={0.62} d={0.2} x={0.22} color="#c58b5a" />
          <Box w={0.66} h={0.18} d={0.22} y={0.62} color="#b97d4c" />
          <Box w={0.4} h={0.08} d={0.16} y={0.8} color="#b97d4c" />
        </group>
      );
    case "pyramid":
      return (
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
          <coneGeometry args={[0.6, 0.7, 4]} />
          <M color="#d8b67a" />
        </mesh>
      );
    case "temple":
      return (
        <group>
          <Box w={0.8} h={0.1} d={0.6} color="#d9c3a0" />
          <Box w={0.6} h={0.3} d={0.45} y={0.1} color="#e2c48f" />
          <mesh position={[0, 0.62, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.24, 0.45, 4]} />
            <M color="#d9a85e" />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <M color="#ffd34d" emissive="#8a5a00" />
          </mesh>
          <mesh position={[0, 1.0, 0.0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.004, 0.14, 0.004]} />
            <M color="#333" />
          </mesh>
          <mesh position={[0.04, 1.04, 0]}>
            <boxGeometry args={[0.08, 0.05, 0.004]} />
            <M color={accent} />
          </mesh>
        </group>
      );
    case "mountain":
      return (
        <group>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.6, 0.8, 7]} />
            <M color="#7d7468" />
          </mesh>
          <mesh position={[0, 0.66, 0]} castShadow>
            <coneGeometry args={[0.2, 0.28, 7]} />
            <M color="#ffffff" />
          </mesh>
        </group>
      );
    case "bridge":
      return (
        <group>
          <Box w={1.4} h={0.05} d={0.16} y={0.25} color="#c0392b" />
          <Box w={0.06} h={0.7} d={0.18} x={-0.35} color="#c0392b" />
          <Box w={0.06} h={0.7} d={0.18} x={0.35} color="#c0392b" />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.35 * 0.5 + 0, 0.5, 0]}>
              <torusGeometry args={[0.35, 0.006, 4, 24, Math.PI]} />
              <M color="#c0392b" />
            </mesh>
          ))}
        </group>
      );
    case "wall":
      return (
        <group>
          <Box w={1.1} h={0.28} d={0.14} color="#b0563b" />
          {Array.from({ length: 9 }, (_, i) => (
            <Box key={i} w={0.07} h={0.07} d={0.15} x={-0.5 + i * 0.125} y={0.28} color="#a14d34" />
          ))}
          <Box w={0.2} h={0.42} d={0.2} x={-0.55} color="#a14d34" />
          <Box w={0.2} h={0.42} d={0.2} x={0.55} color="#a14d34" />
        </group>
      );
    case "house":
      return (
        <group>
          <Box w={0.5} h={0.35} d={0.4} color="#f4e7cf" />
          <mesh position={[0, 0.48, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.42, 0.26, 4]} />
            <M color={accent} />
          </mesh>
        </group>
      );
    default:
      return (
        <group>
          <mesh position={[0, 0.25, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[0.16, 0.5, 20]} />
            <M color={accent} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <sphereGeometry args={[0.24, 24, 24]} />
            <M color={accent} />
          </mesh>
          <mesh position={[0, 0.64, 0.2]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <M color="#ffffff" />
          </mesh>
        </group>
      );
  }
};

/* ---------------- procedural city ---------------- */

export type CityBlock = { x: number; z: number; w: number; d: number; h: number; color: string; delay: number };

export function makeCity(seed: number, blocks = 9, spacing = 1, palette = ["#e8edf2", "#cfd9e3", "#b7c6d6", "#f2d7b6", "#d7e6d4"]): CityBlock[] {
  const r = seeded(seed);
  const out: CityBlock[] = [];
  const half = ((blocks - 1) * spacing) / 2;
  for (let i = 0; i < blocks; i++)
    for (let j = 0; j < blocks; j++) {
      const bx = i * spacing - half;
      const bz = j * spacing - half;
      const dist = Math.hypot(bx, bz) / (half * 1.4);
      // 2x2 lots per block, taller downtown.
      for (let a = 0; a < 2; a++)
        for (let b = 0; b < 2; b++) {
          if (r() < 0.12) continue;
          const w = spacing * 0.36 * (0.75 + r() * 0.25);
          const d = spacing * 0.36 * (0.75 + r() * 0.25);
          const tall = Math.max(0.15, (1 - dist) * 2.6 * (0.35 + r() * 0.9) + r() * 0.2);
          out.push({
            x: bx + (a - 0.5) * spacing * 0.4,
            z: bz + (b - 0.5) * spacing * 0.4,
            w,
            d,
            h: tall,
            color: palette[Math.floor(r() * palette.length)],
            delay: dist * 0.8 + r() * 0.25,
          });
        }
    }
  return out;
}
