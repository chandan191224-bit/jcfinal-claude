import { geoRotation } from "d3-geo";
import type { MapCtx } from "./MapView";
import type { LonLat } from "../lib/places";
import { GeoPath, densify } from "../lib/geo";

export type ScreenPt = { x: number; y: number; on: boolean; f: number };

const RAD = Math.PI / 180;

/**
 * Projects a geographic point with an altitude (fraction of the earth radius on globes, or a
 * screen-space lift on flat maps) and says whether it is in front of the globe.
 */
export function project3D(m: MapCtx, p: LonLat, alt = 0): { x: number; y: number; on: boolean } {
  if (m.kind === "globe") {
    const rot = geoRotation(m.projection.rotate());
    const [l, ph] = rot(p);
    const R = m.projection.scale() * (1 + alt);
    const [cx, cy] = m.projection.translate();
    const x = R * Math.cos(ph * RAD) * Math.sin(l * RAD);
    const y = -R * Math.sin(ph * RAD);
    const z = Math.cos(ph * RAD) * Math.cos(l * RAD);
    // In front, or lifted far enough to peek over the horizon.
    const on = z > 0 || Math.hypot(x, y) > m.projection.scale();
    return { x: cx + x, y: cy + y, on };
  }
  const q = m.projection(p);
  if (!q) return { x: 0, y: 0, on: false };
  return { x: q[0], y: q[1], on: true };
}

export type RouteGeometry = {
  pts: ScreenPt[];
  measure: GeoPath;
};

/**
 * Screen polyline for a route. `lift` raises the middle of the route: on a globe it is altitude
 * (fraction of the radius at the peak, scaled with distance); on flat maps it bows the line upward.
 */
export function routeGeometry(m: MapCtx, coords: LonLat[], lift = 0, densifyKm = 20): RouteGeometry {
  const dense = densify(coords, densifyKm);
  const measure = new GeoPath(dense);
  if (dense.length < 2) return { pts: [], measure };
  const total = measure.lengthKm || 1;
  const pts: ScreenPt[] = [];
  if (m.kind === "globe") {
    const peak = lift * Math.min(0.5, total / 12000);
    dense.forEach((p, i) => {
      const f = measure.cum[i] / total;
      const q = project3D(m, p, peak * Math.sin(Math.PI * f));
      pts.push({ ...q, f });
    });
  } else {
    const a = project3D(m, dense[0]);
    const b = project3D(m, dense[dense.length - 1]);
    const chord = Math.hypot(b.x - a.x, b.y - a.y);
    // Bow toward the top of the screen, perpendicular to the chord.
    let nx = -(b.y - a.y) / (chord || 1);
    let ny = (b.x - a.x) / (chord || 1);
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    dense.forEach((p, i) => {
      const f = measure.cum[i] / total;
      const q = project3D(m, p);
      const h = lift * 0.22 * chord * Math.sin(Math.PI * f);
      pts.push({ x: q.x + nx * h, y: q.y + ny * h, on: q.on, f });
    });
  }
  return { pts, measure };
}

/** SVG path data for the part of the route between fractions t0 and t1 (true distance). */
export function routePathD(g: RouteGeometry, t0: number, t1: number, maxJump: number) {
  const { pts } = g;
  if (pts.length < 2) return "";
  let d = "";
  let pen = false;
  const at = (t: number) => {
    // Interpolated point at fraction t.
    let i = 1;
    while (i < pts.length - 1 && pts[i].f < t) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const k = b.f > a.f ? (t - a.f) / (b.f - a.f) : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, on: a.on && b.on, f: t };
  };
  const seq: ScreenPt[] = [at(t0), ...pts.filter((p) => p.f > t0 && p.f < t1), at(t1)];
  let prev: ScreenPt | null = null;
  for (const p of seq) {
    if (!p.on || (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > maxJump)) {
      pen = false;
      prev = p.on ? p : null;
      if (!p.on) continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
    prev = p;
  }
  return d;
}

/** Position and screen heading (degrees, 0 = pointing right) at fraction t. */
export function routeHead(g: RouteGeometry, t: number) {
  const { pts } = g;
  if (pts.length < 2) return { x: 0, y: 0, angle: 0, on: false };
  const find = (tt: number) => {
    let i = 1;
    while (i < pts.length - 1 && pts[i].f < tt) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const k = b.f > a.f ? (tt - a.f) / (b.f - a.f) : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, on: a.on || b.on };
  };
  const tc = Math.min(1, Math.max(0, t));
  const e = 0.004;
  const p = find(tc);
  const p0 = find(Math.max(0, tc - e));
  const p1 = find(Math.min(1, tc + e));
  const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
  return { x: p.x, y: p.y, angle, on: p.on };
}

/** Screen length of the route polyline (for dash timing). */
export function screenLength(g: RouteGeometry) {
  let L = 0;
  for (let i = 1; i < g.pts.length; i++) L += Math.hypot(g.pts[i].x - g.pts[i - 1].x, g.pts[i].y - g.pts[i - 1].y);
  return L;
}
