import { geoDistance, geoInterpolate } from "d3-geo";
import type { LonLat } from "./places";

export const EARTH_RADIUS_KM = 6371.0088;
const RAD = Math.PI / 180;

/** Great-circle (haversine) distance in km. */
export const distanceKm = (a: LonLat, b: LonLat) => geoDistance(a, b) * EARTH_RADIUS_KM;

/** Initial true bearing from a to b, degrees clockwise from north. */
export function bearing(a: LonLat, b: LonLat) {
  const [l1, p1] = [a[0] * RAD, a[1] * RAD];
  const [l2, p2] = [b[0] * RAD, b[1] * RAD];
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export const compassPoint = (deg: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];

/** Points along the great circle from a to b (inclusive). */
export function greatCircle(a: LonLat, b: LonLat, steps = 128): LonLat[] {
  const f = geoInterpolate(a, b);
  return Array.from({ length: steps + 1 }, (_, i) => f(i / steps) as LonLat);
}

/** Insert great-circle points so no segment is longer than maxKm. */
export function densify(coords: LonLat[], maxKm = 25): LonLat[] {
  if (coords.length < 2) return coords.slice();
  const out: LonLat[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = distanceKm(a, b);
    const n = Math.max(1, Math.ceil(d / maxKm));
    if (n === 1) out.push(b);
    else {
      const f = geoInterpolate(a, b);
      for (let k = 1; k <= n; k++) out.push(f(k / n) as LonLat);
    }
  }
  return out;
}

/** Measures a geographic polyline so positions can be taken by fraction of true distance. */
export class GeoPath {
  readonly coords: LonLat[];
  readonly cum: number[];
  readonly lengthKm: number;
  constructor(coords: LonLat[]) {
    this.coords = coords;
    this.cum = [0];
    for (let i = 1; i < coords.length; i++) this.cum.push(this.cum[i - 1] + distanceKm(coords[i - 1], coords[i]));
    this.lengthKm = this.cum[this.cum.length - 1] || 0;
  }
  private locate(t: number) {
    const target = Math.min(1, Math.max(0, t)) * this.lengthKm;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const seg = this.cum[hi] - this.cum[lo];
    return { i: lo, f: seg > 0 ? (target - this.cum[lo]) / seg : 0 };
  }
  at(t: number): LonLat {
    if (this.coords.length === 1) return this.coords[0];
    const { i, f } = this.locate(t);
    const a = this.coords[i];
    const b = this.coords[Math.min(i + 1, this.coords.length - 1)];
    return geoInterpolate(a, b)(f) as LonLat;
  }
  /** Coordinates from the start up to fraction t. */
  slice(t: number): LonLat[] {
    if (t <= 0) return [this.coords[0]];
    if (t >= 1) return this.coords;
    const { i } = this.locate(t);
    return [...this.coords.slice(0, i + 1), this.at(t)];
  }
  /** Coordinates between fractions t0 and t1. */
  between(t0: number, t1: number): LonLat[] {
    const a = this.locate(t0);
    const b = this.locate(t1);
    return [this.at(t0), ...this.coords.slice(a.i + 1, b.i + 1), this.at(t1)];
  }
  bearingAt(t: number) {
    const e = Math.min(0.002, 0.5 / Math.max(1, this.lengthKm));
    return bearing(this.at(Math.max(0, t - e)), this.at(Math.min(1, t + e)));
  }
}

/** Geographic bounding box [[w, s], [e, n]] that handles the antimeridian poorly but is fine for regional shots. */
export function bounds(points: LonLat[]): [LonLat, LonLat] {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const [x, y] of points) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/* ---------------- sun position (for real day/night lighting) ---------------- */

/** Sub-solar point [lon, lat] for a UTC date, accurate to ~0.1°. */
export function subsolarPoint(date: Date): LonLat {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  let lon = (ra / RAD - gmst * 15) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return [lon, decl / RAD];
}

/* ---------------- deterministic randomness ---------------- */

export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3);
export const easeOutBack = (t: number, s = 1.70158) => {
  const x = clamp(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
/** Elastic overshoot used for pop-ups. */
export const easeOutElastic = (t: number) => {
  const x = clamp(t);
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

export const formatKm = (km: number) =>
  km >= 100 ? `${Math.round(km).toLocaleString("en-IN")} km` : km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;

export function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}
