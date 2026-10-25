import React, { useMemo } from "react";
import { z } from "zod";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { geoPath } from "d3-geo";
import type { Shape } from "./useAreaHighlights";
import { useMap } from "./MapView";
import { WavingFlag } from "../ui/Flag";
import { isVideoFile, resolveMedia } from "../lib/media";
import { clamp, easeOutCubic } from "../lib/geo";
import { font } from "../lib/fonts";

/** Media shown inside a country, state or area, clipped exactly to its border. */
export const zRegionMedia = z.object({
  target: z.string().describe('Country, state ("Kerala"), place for a radius, or "file:areas/x.geojson"'),
  level: z.enum(["auto", "country", "state", "radius"]),
  radiusKm: z.number().min(0).max(5000),
  media: z.string().describe('"flag" = the country\'s flag, "flag:jp" = a specific flag, or an image/video in public/'),
  fit: z.enum(["cover", "contain", "stretch"]),
  wave: z.boolean().describe("Wave the picture like a flag"),
  opacity: z.number().min(0).max(1),
  reveal: z.enum(["fade", "iris", "wipe", "rise", "none"]),
  outline: z.string().describe('Border colour, or "" for none'),
  label: z.string(),
  startSec: z.number().min(0),
  endSec: z.number().min(0).describe("0 = stays"),
});
export type RegionMediaSpec = z.infer<typeof zRegionMedia>;

export const regionMediaDefaults = (r: Partial<RegionMediaSpec> & { target: string }): RegionMediaSpec => ({
  level: "auto",
  radiusKm: 0,
  media: "flag",
  fit: "cover",
  wave: true,
  opacity: 1,
  reveal: "iris",
  outline: "#ffffff",
  label: "",
  startSec: 0,
  endSec: 0,
  ...r,
});


/** Resolves the picture to show: flags come from the area's ISO code. */
function mediaSource(spec: RegionMediaSpec, shape: Shape) {
  const m = spec.media.trim();
  if (m === "flag" || m.startsWith("flag:")) {
    const code =
      m.startsWith("flag:")
        ? m.slice(5).trim().toLowerCase()
        : "properties" in shape.feature && shape.feature.properties
          ? String((shape.feature.properties as { iso2?: string }).iso2 ?? "")
          : "";
    return code ? { src: staticFile(`flags/${code}.svg`), video: false, aspect: 4 / 3 } : null;
  }
  if (!m) return null;
  return { src: resolveMedia(m), video: isVideoFile(m), aspect: 0 };
}

export const RegionFill: React.FC<{ spec: RegionMediaSpec; shape: Shape; alpha?: number }> = ({ spec, shape, alpha = 1 }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const { fps, height: frameH } = useVideoConfig();
  const start = Math.round(spec.startSec * fps);
  const end = spec.endSec > 0 ? Math.round(spec.endSec * fps) : Infinity;
  const geo = useMemo(() => {
    const path = geoPath(m.projection);
    const d = path(shape.feature as never) ?? "";
    const [[x0, y0], [x1, y1]] = path.bounds(shape.feature as never);
    const [lx, ly] = path.centroid(shape.feature as never);
    return { d, x0, y0, x1, y1, lx: isFinite(lx) ? lx : (x0 + x1) / 2, ly: isFinite(ly) ? ly : (y0 + y1) / 2 };
  }, [m.projection, shape.feature]);
  const t = frame - start;
  if (t < 0 || frame > end + 12 || !geo.d || !isFinite(geo.x0)) return null;
  const a = easeOutCubic(clamp(t / 20)) * (end === Infinity ? 1 : clamp((end - frame) / 12));
  const src = mediaSource(spec, shape);
  const bw = Math.max(2, geo.x1 - geo.x0);
  const bh = Math.max(2, geo.y1 - geo.y0);
  // Size of the picture inside the area's bounding box.
  let w = bw;
  let h = bh;
  if (src && spec.fit !== "stretch" && src.aspect) {
    const r = src.aspect;
    if ((spec.fit === "cover") === bw / bh > r) h = bw / r;
    else w = bh * r;
  }
  if (src && spec.wave) {
    w *= 1.08;
    h *= 1.12;
  }
  const cx = (geo.x0 + geo.x1) / 2;
  const cy = (geo.y0 + geo.y1) / 2;
  const R = Math.hypot(bw, bh) / 2;
  const reveal =
    spec.reveal === "iris"
      ? `circle(${R * a}px at ${cx}px ${cy}px)`
      : spec.reveal === "wipe"
        ? `inset(0 ${(1 - a) * 100}% 0 0)`
        : undefined;
  const rise = spec.reveal === "rise" ? (1 - a) * 40 : 0;
  const opacity = (spec.reveal === "fade" || spec.reveal === "rise" ? a : Math.min(1, a * 3)) * spec.opacity * alpha;
  const content = !src ? (
    <div style={{ width: bw, height: bh, background: "linear-gradient(135deg,#3a6b5a,#c9a46a)" }} />
  ) : src.video ? (
    <Video src={src.src} muted objectFit="fill" style={{ width: w, height: h }} />
  ) : spec.wave ? (
    <WavingFlag src={src.src} width={w} height={h} amplitude={0.035} />
  ) : (
    <Img src={src.src} style={{ width: w, height: h, objectFit: "fill" }} />
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, clipPath: `path(evenodd, "${geo.d}")`, opacity, translate: `0 ${rise}px` }}>
        <div style={{ position: "absolute", inset: 0, clipPath: reveal }}>
          <div style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h }}>{content}</div>
          {/* Soft inner shading keeps the area readable as land. */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.25) 100%)" }} />
        </div>
      </div>
      {spec.outline ? (
        <svg width={m.width} height={m.height} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: opacity, translate: `0 ${rise}px` }}>
          <path d={geo.d} fill="none" stroke={spec.outline} strokeWidth={Math.max(2, Math.min(5, R / 120))} strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.6))" }} />
        </svg>
      ) : null}
      {spec.label ? (
        <div
          style={{
            position: "absolute",
            left: geo.lx,
            top: geo.ly,
            translate: "-50% -50%",
            opacity,
            padding: "6px 18px",
            borderRadius: 8,
            background: "rgba(10,12,16,0.8)",
            color: "white",
            font: `700 ${frameH * 0.032}px ${font(m.theme.titleFont)}`,
            letterSpacing: 1,
            whiteSpace: "nowrap",
          }}
        >
          {spec.label === "auto" ? shape.name : spec.label}
        </div>
      ) : null}
    </>
  );
};
