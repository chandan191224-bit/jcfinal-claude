import { staticFile } from "remotion";
import { fetchJson, loadImage, loadOnce } from "./data";
import type { LonLat } from "./places";

/**
 * Real elevation from the free AWS Terrain Tiles (Terrarium encoding; SRTM/GMTED/ETOPO sources,
 * ~30 m resolution on land). Tiles saved with `npm run cache-terrain` are used offline first.
 */
const REMOTE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

export type Dem = {
  center: LonLat;
  radiusKm: number;
  /** Elevation in metres at a geographic point (bilinear). */
  elevation: (p: LonLat) => number;
  /** Local position in km (x east, y north) relative to the centre. */
  toLocal: (p: LonLat) => [number, number];
  fromLocal: (x: number, y: number) => LonLat;
  min: number;
  max: number;
  zoom: number;
};

const lon2x = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

type Manifest = { tiles: string[] };
const manifest = () =>
  loadOnce<Set<string>>("terrain-manifest", async () => {
    try {
      const m = await fetchJson<Manifest>("terrain/index.json");
      return new Set(m.tiles);
    } catch {
      return new Set();
    }
  });

/** Picks the most detailed zoom whose tile grid around the area stays within `maxAcross` tiles. */
export function demZoom(center: LonLat, radiusKm: number, maxAcross = 4) {
  for (let z = 14; z >= 3; z--) {
    const tileKm = (40075 * Math.cos((center[1] * Math.PI) / 180)) / 2 ** z;
    if (Math.ceil((2 * radiusKm) / tileKm) + 1 <= maxAcross) return z;
  }
  return 3;
}

export const tileList = (center: LonLat, radiusKm: number, maxAcross = 4) => {
  const z = demZoom(center, radiusKm, maxAcross);
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const x0 = Math.floor(lon2x(center[0] - dLon, z));
  const x1 = Math.floor(lon2x(center[0] + dLon, z));
  const y0 = Math.floor(lat2y(center[1] + dLat, z));
  const y1 = Math.floor(lat2y(center[1] - dLat, z));
  const tiles: [number, number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([z, x, y]);
  return { z, x0, y0, nx: x1 - x0 + 1, ny: y1 - y0 + 1, tiles };
};

export const loadDem = (center: LonLat, radiusKm: number) =>
  loadOnce<Dem>(`dem:${center.join(",")}:${radiusKm}`, async () => {
    const { z, x0, y0, nx, ny, tiles } = tileList(center, radiusKm);
    const cached = await manifest();
    const W = nx * 256;
    const H = ny * 256;
    const heights = new Float32Array(W * H);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    await Promise.all(
      tiles.map(async ([tz, tx, ty]) => {
        const key = `${tz}/${tx}/${ty}`;
        const src = cached.has(key) ? staticFile(`terrain/${key}.png`) : `${REMOTE}/${key}.png`;
        const img = await loadImage(src);
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, 256, 256).data;
        const ox = (tx - x0) * 256;
        const oy = (ty - y0) * 256;
        for (let j = 0; j < 256; j++)
          for (let i = 0; i < 256; i++) {
            const k = (j * 256 + i) * 4;
            heights[(oy + j) * W + ox + i] = d[k] * 256 + d[k + 1] + d[k + 2] / 256 - 32768;
          }
      }),
    );
    let min = Infinity;
    let max = -Infinity;
    for (const h of heights) {
      if (h < min) min = h;
      if (h > max) max = h;
    }
    const kmPerDegLat = 111.32;
    const kmPerDegLon = 111.32 * Math.cos((center[1] * Math.PI) / 180);
    const elevation = ([lon, lat]: LonLat) => {
      const px = (lon2x(lon, z) - x0) * 256 - 0.5;
      const py = (lat2y(lat, z) - y0) * 256 - 0.5;
      const xa = Math.max(0, Math.min(W - 1, Math.floor(px)));
      const ya = Math.max(0, Math.min(H - 1, Math.floor(py)));
      const xb = Math.min(W - 1, xa + 1);
      const yb = Math.min(H - 1, ya + 1);
      const fx = Math.max(0, Math.min(1, px - xa));
      const fy = Math.max(0, Math.min(1, py - ya));
      const a = heights[ya * W + xa] * (1 - fx) + heights[ya * W + xb] * fx;
      const b = heights[yb * W + xa] * (1 - fx) + heights[yb * W + xb] * fx;
      return a * (1 - fy) + b * fy;
    };
    return {
      center,
      radiusKm,
      elevation,
      toLocal: ([lon, lat]) => [(lon - center[0]) * kmPerDegLon, (lat - center[1]) * kmPerDegLat],
      fromLocal: (x, y) => [center[0] + x / kmPerDegLon, center[1] + y / kmPerDegLat],
      min,
      max,
      zoom: z,
    };
  });
