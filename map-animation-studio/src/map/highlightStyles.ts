import { geoBounds, geoCentroid, geoCircle, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { clamp, easeOutBack, easeOutCubic } from "../lib/geo";
import { font } from "../lib/fonts";
import type { Theme } from "../lib/themes";

/**
 * Area highlight looks used in YouTube explainers and documentaries.
 * Every style animates in over `inFrames` from its start frame.
 */
export const HIGHLIGHT_STYLES = [
  "fill",
  "gradient",
  "glow",
  "neon",
  "outline-draw",
  "spotlight",
  "pop-out",
  "paper-cutout",
  "extrude",
  "hatch",
  "dots",
  "pulse",
  "marching-ants",
  "blink",
  "inner-glow",
  "ring",
] as const;
export type HighlightStyle = (typeof HIGHLIGHT_STYLES)[number];

export type ResolvedHighlight = {
  feature: Feature<Geometry> | GeoPermissibleObjects;
  style: HighlightStyle;
  color: string;
  /** Frames since this highlight started (negative = not yet). */
  t: number;
  /** Frames until it ends (Infinity = stays). */
  remaining: number;
  inFrames: number;
  label?: string;
  sublabel?: string;
  labelScale?: number;
  /** Extra opacity multiplier (keyframes). */
  alpha?: number;
};

const rgba = (hex: string, a: number) => {
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

let scratch: HTMLCanvasElement | null = null;
const copyOf = (src: HTMLCanvasElement) => {
  scratch = scratch ?? document.createElement("canvas");
  scratch.width = src.width;
  scratch.height = src.height;
  const c = scratch.getContext("2d")!;
  c.clearRect(0, 0, src.width, src.height);
  c.drawImage(src, 0, 0);
  return scratch;
};

let hatchCache: Record<string, CanvasPattern | null> = {};
function pattern(ctx: CanvasRenderingContext2D, kind: "hatch" | "dots", color: string) {
  const key = kind + color;
  if (hatchCache[key]) return hatchCache[key];
  const p = document.createElement("canvas");
  p.width = p.height = 18;
  const c = p.getContext("2d")!;
  c.strokeStyle = color;
  c.fillStyle = color;
  if (kind === "hatch") {
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-4, 22);
    c.lineTo(22, -4);
    c.moveTo(-4, 4);
    c.lineTo(4, -4);
    c.moveTo(14, 22);
    c.lineTo(22, 14);
    c.stroke();
  } else {
    c.beginPath();
    c.arc(9, 9, 3, 0, Math.PI * 2);
    c.fill();
  }
  hatchCache[key] = ctx.createPattern(p, "repeat");
  if (Object.keys(hatchCache).length > 40) hatchCache = {};
  return hatchCache[key];
}

/** Draws all highlights on top of a finished map canvas. */
export function drawHighlights(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  list: ResolvedHighlight[],
  theme: Theme,
  width: number,
  height: number,
) {
  const path = geoPath(projection, ctx);
  const measure = geoPath(projection);
  for (const h of list) {
    if (h.t < 0) continue;
    const ain = clamp(h.t / Math.max(1, h.inFrames));
    const aout = Number.isFinite(h.remaining) ? clamp(h.remaining / 12) : 1;
    const a = easeOutCubic(ain) * aout * (h.alpha ?? 1);
    if (a <= 0) continue;
    const f = h.feature;
    const c = h.color;
    const bounds = measure.bounds(f);
    const [[x0, y0], [x1, y1]] = bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const size = Math.max(x1 - x0, y1 - y0);
    const lw = Math.max(2, Math.min(6, size / 120));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const shape = () => {
      ctx.beginPath();
      path(f);
    };
    switch (h.style) {
      case "fill":
        shape();
        ctx.fillStyle = rgba(c, 0.6 * a);
        ctx.fill();
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "gradient": {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, rgba(c, 0.85 * a));
        g.addColorStop(1, rgba(c, 0.25 * a));
        shape();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      }
      case "glow":
        shape();
        ctx.fillStyle = rgba(c, 0.3 * a);
        ctx.fill();
        ctx.shadowColor = c;
        ctx.shadowBlur = 28;
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw * 1.2;
        ctx.stroke();
        ctx.stroke();
        break;
      case "neon": {
        // Flicker on, then steady.
        const flick = h.t < h.inFrames ? (Math.floor(h.t / 2) % 3 === 1 ? 0.25 : 1) : 1;
        shape();
        ctx.fillStyle = rgba(c, 0.12 * a * flick);
        ctx.fill();
        ctx.shadowColor = c;
        ctx.shadowBlur = 40;
        ctx.strokeStyle = rgba(c, 0.9 * a * flick);
        ctx.lineWidth = lw * 2.6;
        ctx.stroke();
        ctx.shadowBlur = 12;
        ctx.lineWidth = lw * 1.2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * a * flick})`;
        ctx.lineWidth = lw * 0.5;
        ctx.stroke();
        break;
      }
      case "outline-draw": {
        const L = measure.measure(f) || 1;
        const drawT = clamp(h.t / Math.max(1, h.inFrames * 2));
        shape();
        ctx.fillStyle = rgba(c, 0.35 * clamp((drawT - 0.8) / 0.2) * aout);
        ctx.fill();
        ctx.setLineDash([L * easeOutCubic(drawT), L]);
        ctx.shadowColor = c;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = rgba(c, aout);
        ctx.lineWidth = lw * 1.3;
        ctx.stroke();
        break;
      }
      case "spotlight":
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        path(f);
        ctx.fillStyle = `rgba(0,0,0,${0.62 * a})`;
        ctx.fill("evenodd");
        shape();
        ctx.shadowColor = "rgba(255,255,255,0.8)";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "pop-out":
      case "paper-cutout":
      case "extrude": {
        // Lift the real map pixels of the area off the page.
        const src = copyOf(ctx.canvas);
        const k = h.style === "pop-out" ? easeOutBack(ain, 2) * aout : a;
        const lift = (h.style === "extrude" ? 26 : 18) * k * Math.max(0.6, Math.min(2, size / 400));
        const scale = 1 + (h.style === "pop-out" ? 0.06 : 0.03) * k;
        const rot = h.style === "paper-cutout" ? -1.5 * k : 0;
        // Dark surroundings so the lifted area reads first.
        ctx.fillStyle = `rgba(0,0,0,${0.35 * a})`;
        ctx.fillRect(0, 0, width, height);
        const place = () => {
          ctx.translate(cx, cy);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy - lift);
        };
        // Shadow.
        ctx.save();
        ctx.translate(lift * 0.5, lift * 0.9);
        ctx.filter = `blur(${Math.max(4, lift * 0.6)}px)`;
        shape();
        ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
        ctx.fill();
        ctx.restore();
        if (h.style === "extrude") {
          // Side walls: stacked copies stepping up.
          for (let s = 0; s < lift; s += 2) {
            ctx.save();
            ctx.translate(0, -s);
            shape();
            ctx.fillStyle = rgba(c, 0.95);
            ctx.filter = "brightness(0.55)";
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.save();
        place();
        if (h.style === "paper-cutout") {
          shape();
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 14;
          ctx.stroke();
        }
        shape();
        ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        place();
        ctx.drawImage(src, 0, 0);
        shape();
        ctx.fillStyle = rgba(c, 0.18 * a);
        ctx.fill();
        ctx.restore();
        ctx.save();
        place();
        shape();
        ctx.strokeStyle = h.style === "paper-cutout" ? "rgba(90,70,40,0.6)" : rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "hatch":
      case "dots":
        shape();
        ctx.globalAlpha = a;
        ctx.fillStyle = pattern(ctx, h.style, c) ?? rgba(c, 0.4);
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "pulse": {
        shape();
        ctx.fillStyle = rgba(c, 0.35 * a);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const k = ((h.t + i * 14) % 42) / 42;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1 + k * 0.25, 1 + k * 0.25);
          ctx.translate(-cx, -cy);
          shape();
          ctx.strokeStyle = rgba(c, (1 - k) * 0.8 * a);
          ctx.lineWidth = lw / (1 + k * 0.25);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "marching-ants":
        shape();
        ctx.fillStyle = rgba(c, 0.2 * a);
        ctx.fill();
        ctx.setLineDash([lw * 3, lw * 2.5]);
        ctx.lineDashOffset = -h.t * 1.5;
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "blink": {
        const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((h.t / 18) * Math.PI));
        shape();
        ctx.fillStyle = rgba(c, 0.65 * a * b);
        ctx.fill();
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      }
      case "inner-glow":
        shape();
        ctx.clip();
        ctx.shadowColor = c;
        ctx.shadowBlur = 40;
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw * 6;
        shape();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      case "ring": {
        shape();
        ctx.fillStyle = rgba(c, 0.15 * a);
        ctx.fill();
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
    if (h.label) drawAreaLabel(ctx, projection, f, h.label, h.sublabel, theme, a, h.style, h.labelScale ?? 1, cx, cy);
  }
}

function drawAreaLabel(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  f: GeoPermissibleObjects,
  text: string,
  sub: string | undefined,
  theme: Theme,
  a: number,
  style: HighlightStyle,
  scale: number,
  cx: number,
  cy: number,
) {
  const c = projection(geoCentroid(f as never)) ?? [cx, cy];
  const lifted = style === "pop-out" || style === "paper-cutout" || style === "extrude";
  const x = c[0];
  const y = c[1] - (lifted ? 20 : 0);
  const size = 40 * scale;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `700 ${size}px ${font(theme.titleFont)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text.toUpperCase()).width;
  ctx.fillStyle = "rgba(10,12,16,0.78)";
  const padX = size * 0.45;
  const boxH = size * (sub ? 2.2 : 1.45);
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - padX, y - size * 0.72, w + padX * 2, boxH, size * 0.25);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text.toUpperCase(), x, y);
  if (sub) {
    ctx.font = `500 ${size * 0.5}px ${font(theme.labelFont)}`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(sub, x, y + size * 0.85);
  }
  ctx.restore();
}

/** Circle of a real ground radius around a point, as a polygon. */
export const radiusCircle = (center: [number, number], radiusKm: number) => geoCircle().center(center).radius((radiusKm / 6371.0088) * (180 / Math.PI)).precision(1)();

export const featureBounds = (f: GeoPermissibleObjects) => geoBounds(f as never);
