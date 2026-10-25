import {
  geoEquirectangular,
  geoInterpolate,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoDistance,
  type GeoProjection,
} from "d3-geo";
import { interpolateZoom as zoomInterp } from "d3-interpolate";

// The rho() factory exists at runtime but is missing from the type definitions.
const interpolateZoom = zoomInterp as typeof zoomInterp & { rho: (r: number) => typeof zoomInterp };
import type { LonLat } from "./places";
import { clamp, easeInOutCubic, lerp } from "./geo";

export type ProjectionKind = "globe" | "mercator" | "flat" | "natural";

/**
 * A map camera. `zoom` is log2 of magnification: 0 shows the whole world, each +1 doubles the
 * scale (roughly matching web-map zoom levels minus ~1.5 for a 1080p frame).
 */
export type Camera = { lon: number; lat: number; zoom: number; bearing: number; pitch: number };

export const cam = (lon: number, lat: number, zoom: number, bearing = 0, pitch = 0): Camera => ({ lon, lat, zoom, bearing, pitch });

/** Base scale (zoom 0) that fits the whole world in the frame for each projection. */
export function baseScale(kind: ProjectionKind, width: number, height: number) {
  if (kind === "globe") return Math.min(width, height) * 0.42;
  if (kind === "mercator") return Math.min(width / (2 * Math.PI), height / 5.2);
  if (kind === "natural") return Math.min(width / 5.6, height / 2.9);
  return Math.min(width / (2 * Math.PI), height / Math.PI);
}

export function makeProjection(kind: ProjectionKind, c: Camera, width: number, height: number): GeoProjection {
  const k = baseScale(kind, width, height) * Math.pow(2, c.zoom);
  if (kind === "globe") {
    return geoOrthographic()
      .rotate([-c.lon, -c.lat, c.bearing])
      .scale(k)
      .translate([width / 2, height / 2])
      .clipAngle(90)
      .precision(0.3);
  }
  const p = kind === "mercator" ? geoMercator() : kind === "natural" ? geoNaturalEarth1() : geoEquirectangular();
  // Rotate longitude so the camera centre is the projection centre; this keeps the antimeridian
  // away from the camera and lets routes cross the Pacific cleanly.
  return p
    .rotate([-c.lon, 0, 0])
    .center([0, c.lat])
    .scale(k)
    .translate([width / 2, height / 2])
    .angle(-c.bearing)
    .precision(0.3);
}

/** Pixels per degree of longitude at the camera centre (used to pick level of detail). */
export function pixelsPerDegree(kind: ProjectionKind, c: Camera, width: number, height: number) {
  const k = baseScale(kind, width, height) * Math.pow(2, c.zoom);
  const lat = (c.lat * Math.PI) / 180;
  if (kind === "mercator") return (k * Math.PI) / 180;
  return ((k * Math.PI) / 180) * (kind === "globe" ? Math.cos(lat) || 1 : 1);
}

/** Camera that frames all points with padding (0..1 of the frame kept clear on each side). */
export function fitCamera(kind: ProjectionKind, points: LonLat[], width: number, height: number, padding = 0.18, maxZoom = 14): Camera {
  if (!points.length) return cam(0, 20, 0);
  // Centre: spherical centroid of the points.
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of points) {
    const l = (lon * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    x += Math.cos(p) * Math.cos(l);
    y += Math.cos(p) * Math.sin(l);
    z += Math.sin(p);
  }
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  const c = cam(lon, lat, 0);
  const p0 = makeProjection(kind, c, width, height);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of points) {
    // Points on the far side of a globe cannot be framed; use angular distance instead.
    const q = p0(pt);
    if (!q || !isFinite(q[0])) continue;
    minX = Math.min(minX, q[0]);
    maxX = Math.max(maxX, q[0]);
    minY = Math.min(minY, q[1]);
    maxY = Math.max(maxY, q[1]);
  }
  if (kind === "globe") {
    const maxAngle = Math.max(...points.map((p) => geoDistance(p, [lon, lat])));
    if (maxAngle > 1.2) return { ...c, zoom: -0.1 };
  }
  const w = Math.max(maxX - minX, 2);
  const h = Math.max(maxY - minY, 2);
  const avail = 1 - padding * 2;
  const s = Math.min((width * avail) / w, (height * avail) / h);
  const zoom = clamp(Math.log2(s), -0.5, maxZoom);
  if (kind !== "globe" && isFinite(minX)) {
    // Centre on the projected bounding box, not the centroid (they differ on Mercator).
    const mid = p0.invert!([(minX + maxX) / 2, (minY + maxY) / 2]);
    if (mid && isFinite(mid[0])) return { ...c, lon: mid[0], lat: mid[1], zoom };
  }
  return { ...c, zoom };
}

/* ---------------- fly-to (van Wijk & Nuij optimal zoom/pan) ---------------- */

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (clamp(lat, -85, 85) * Math.PI) / 360)) / (2 * Math.PI);
const invMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y * 2 * Math.PI)) - 90;

/**
 * Smooth "zoom out, travel, zoom in" camera move between two cameras, the motion Google Earth uses.
 * On a globe the centre travels along the great circle; on flat maps it travels in Mercator space.
 * `curve` > 1 zooms out more during the move.
 */
export function flyTo(a: Camera, b: Camera, t: number, kind: ProjectionKind, curve = 1.42): Camera {
  const e = clamp(t);
  // Width of view in world units: 1 / 2^zoom.
  const wa = Math.pow(2, -a.zoom);
  const wb = Math.pow(2, -b.zoom);
  let lon: number;
  let lat: number;
  let zoom: number;
  if (kind === "globe") {
    const dist = geoDistance([a.lon, a.lat], [b.lon, b.lat]) / Math.PI; // 0..1 of half a turn
    const zi = interpolateZoom.rho(curve)([0, 0, wa], [dist * 1.6, 0, wb]);
    const [u, , w] = zi(e);
    const f = dist > 0 ? u / (dist * 1.6) : e;
    [lon, lat] = geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(clamp(f));
    zoom = -Math.log2(w);
  } else {
    let dLon = b.lon - a.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const ax = a.lon / 360;
    const bx = (a.lon + dLon) / 360;
    const zi = interpolateZoom.rho(curve)([ax, mercY(a.lat), wa], [bx, mercY(b.lat), wb]);
    const [x, y, w] = zi(e);
    lon = x * 360;
    lat = invMercY(y);
    zoom = -Math.log2(w);
  }
  let db = b.bearing - a.bearing;
  if (db > 180) db -= 360;
  if (db < -180) db += 360;
  return { lon, lat, zoom, bearing: a.bearing + db * e, pitch: lerp(a.pitch, b.pitch, e) };
}

export type Keyframe = { at: number; camera: Camera; ease?: "fly" | "smooth" | "linear" };

/** Camera along a list of keyframes (`at` in frames). Segments use fly-to unless told otherwise. */
export function cameraAt(keys: Keyframe[], frame: number, kind: ProjectionKind): Camera {
  if (!keys.length) return cam(0, 20, 0);
  if (frame <= keys[0].at) return keys[0].camera;
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1];
    const k1 = keys[i];
    if (frame <= k1.at) {
      const raw = (frame - k0.at) / Math.max(1, k1.at - k0.at);
      const mode = k1.ease ?? "fly";
      if (mode === "linear") return mixCamera(k0.camera, k1.camera, raw);
      if (mode === "smooth") return mixCamera(k0.camera, k1.camera, easeInOutCubic(raw));
      return flyTo(k0.camera, k1.camera, easeInOutCubic(raw), kind);
    }
  }
  return keys[keys.length - 1].camera;
}

export function mixCamera(a: Camera, b: Camera, t: number): Camera {
  let dLon = b.lon - a.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return {
    lon: a.lon + dLon * t,
    lat: lerp(a.lat, b.lat, t),
    zoom: lerp(a.zoom, b.zoom, t),
    bearing: lerp(a.bearing, b.bearing, t),
    pitch: lerp(a.pitch, b.pitch, t),
  };
}

/** Converts a web-map zoom level (as in Google Maps) to this camera's zoom for a frame size. */
export const fromWebZoom = (webZoom: number, height: number) => webZoom - Math.log2((baseScale("mercator", height * 16 / 9, height) * 2 * Math.PI) / 256);
