import type { GeoProjection } from "d3-geo";
import { loadImage, loadOnce } from "./data";
import type { LonLat } from "./places";

export type Texture = { w: number; h: number; data: Uint8ClampedArray };

const TEXTURE_FILES = {
  day: "textures/earth-blue-marble.jpg",
  night: "textures/earth-night.jpg",
  topo: "textures/earth-topology.png",
  dark: "textures/earth-dark.jpg",
} as const;
export type TextureName = keyof typeof TEXTURE_FILES;

export const loadTexture = (name: TextureName) =>
  loadOnce<Texture>(`tex:${name}`, async () => {
    const img = await loadImage(TEXTURE_FILES[name]);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
  });

/** Hillshade (light from the north-west) computed from the global elevation texture. */
export const loadRelief = () =>
  loadOnce<Texture>("tex:relief", async () => {
    const topo = await loadTexture("topo");
    const { w, h, data } = topo;
    const out = new Uint8ClampedArray(w * h * 4);
    const z = (x: number, y: number) => data[((Math.min(h - 1, Math.max(0, y)) * w + ((x + w) % w)) * 4)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dzdx = (z(x + 1, y) - z(x - 1, y)) / 2;
        const dzdy = (z(x, y + 1) - z(x, y - 1)) / 2;
        // Lambertian shade, light azimuth 315°, altitude 45°.
        const nx = -dzdx * 0.09;
        const ny = -dzdy * 0.09;
        const len = Math.hypot(nx, ny, 1);
        const shade = (nx * -0.5 + ny * -0.5 + 0.7071) / len / 0.7071;
        const v = Math.max(0, Math.min(255, 255 * (0.55 + 0.45 * shade)));
        const i = (y * w + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = v;
        out[i + 3] = 255;
      }
    }
    return { w, h, data: out };
  });

function sample(t: Texture, lon: number, lat: number, out: number[]) {
  // Bilinear lookup in an equirectangular texture.
  const fx = ((lon + 180) / 360) * t.w - 0.5;
  const fy = ((90 - lat) / 180) * t.h - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.max(0, Math.min(t.h - 1, Math.floor(fy)));
  const y1 = Math.min(t.h - 1, y0 + 1);
  const ax = fx - x0;
  const ay = Math.max(0, Math.min(1, fy - y0));
  const xa = ((x0 % t.w) + t.w) % t.w;
  const xb = (xa + 1) % t.w;
  const d = t.data;
  const i00 = (y0 * t.w + xa) * 4;
  const i10 = (y0 * t.w + xb) * 4;
  const i01 = (y1 * t.w + xa) * 4;
  const i11 = (y1 * t.w + xb) * 4;
  for (let c = 0; c < 3; c++) {
    const top = d[i00 + c] * (1 - ax) + d[i10 + c] * ax;
    const bot = d[i01 + c] * (1 - ax) + d[i11 + c] * ax;
    out[c] = top * (1 - ay) + bot * ay;
  }
}

const RAD = Math.PI / 180;

export type RasterOptions = {
  day?: Texture;
  night?: Texture;
  /** Sub-solar point. When set, the day texture is lit by the real sun and the dark side shows night lights. */
  sun?: LonLat | null;
  /** Multiplies colours, e.g. for a darker documentary look. */
  brightness?: number;
  saturation?: number;
  step?: number;
};

let scratch: HTMLCanvasElement | null = null;

/** Reprojects an equirectangular texture into any d3 projection, pixel by pixel. */
export function drawRaster(ctx: CanvasRenderingContext2D, projection: GeoProjection, width: number, height: number, o: RasterOptions) {
  const step = o.step ?? 2;
  const w = Math.ceil(width / step);
  const h = Math.ceil(height / step);
  scratch = scratch ?? document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const sctx = scratch.getContext("2d")!;
  const img = sctx.createImageData(w, h);
  const px = img.data;
  const day = o.day;
  const night = o.night;
  const sun = o.sun;
  const sv = sun
    ? [Math.cos(sun[1] * RAD) * Math.cos(sun[0] * RAD), Math.cos(sun[1] * RAD) * Math.sin(sun[0] * RAD), Math.sin(sun[1] * RAD)]
    : null;
  const bright = o.brightness ?? 1;
  const sat = o.saturation ?? 1;
  const c1 = [0, 0, 0];
  const c2 = [0, 0, 0];
  const inv = projection.invert!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = inv([(x + 0.5) * step, (y + 0.5) * step]);
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
      const [lon, lat] = p;
      // Orthographic invert also answers for points outside the disc; verify by projecting back.
      const back = projection(p);
      if (!back || Math.abs(back[0] - (x + 0.5) * step) > step * 2 || Math.abs(back[1] - (y + 0.5) * step) > step * 2) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      if (day) {
        sample(day, lon, lat, c1);
        [r, g, b] = c1;
      }
      if (sv && night) {
        const cl = Math.cos(lat * RAD);
        const dot = cl * Math.cos(lon * RAD) * sv[0] + cl * Math.sin(lon * RAD) * sv[1] + Math.sin(lat * RAD) * sv[2];
        // Civil-twilight band about 6° wide.
        const dayAmt = Math.max(0, Math.min(1, (dot + 0.05) / 0.12));
        sample(night, lon, lat, c2);
        const lit = 0.35 + 0.75 * Math.max(0, dot);
        r = r * lit * dayAmt + (c2[0] * 1.1 + r * 0.05) * (1 - dayAmt);
        g = g * lit * dayAmt + (c2[1] * 1.0 + g * 0.05) * (1 - dayAmt);
        b = b * lit * dayAmt + (c2[2] * 0.8 + b * 0.07) * (1 - dayAmt);
      } else if (!day && night) {
        sample(night, lon, lat, c2);
        [r, g, b] = c2;
      }
      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat;
        g = l + (g - l) * sat;
        b = l + (b - l) * sat;
      }
      const i = (y * w + x) * 4;
      px[i] = r * bright;
      px[i + 1] = g * bright;
      px[i + 2] = b * bright;
      px[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scratch, 0, 0, w * step, h * step);
  ctx.restore();
}
