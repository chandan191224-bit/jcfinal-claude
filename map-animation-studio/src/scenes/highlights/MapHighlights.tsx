import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { MapView } from "../../map/MapView";
import { useAreaHighlights, useAreaShapes, zHighlight } from "../../map/useAreaHighlights";
import { base, zProjection } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { cameraAt, cam, fitCamera, type Camera, type Keyframe } from "../../lib/camera";
import type { LonLat } from "../../lib/places";
import { Finish } from "../../fx/Finish";
import { usePlaces } from "../../lib/useTrip";
import { Sfx } from "../../fx/Sfx";
import { TitleCard } from "../../ui/Overlays2D";

export const mapHighlightsSchema = z.object({
  ...base,
  projection: zProjection,
  cameraMode: z.enum(["tour", "fit-all", "fixed"]).describe("tour = fly to each highlight as it starts"),
  fixedCenter: z.string().describe('For fixed camera: place or "lat, lon"'),
  fixedZoom: z.number().min(-1).max(14),
  highlights: z.array(zHighlight),
  countryLabels: z.boolean(),
  stateBorders: z.boolean().describe("Draw state borders of highlighted countries"),
  title: z.string(),
  subtitle: z.string(),
});

/** Every coordinate of a shape, thinned, for camera framing. */
export function shapePoints(f: Feature<Geometry> | FeatureCollection): LonLat[] {
  const out: LonLat[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") out.push([c[0], c[1]] as LonLat);
    else if (Array.isArray(c)) (c as unknown[]).forEach(walk);
  };
  const geoms = f.type === "FeatureCollection" ? f.features.map((x) => x.geometry) : [f.geometry];
  for (const g of geoms) if (g && "coordinates" in g) walk(g.coordinates as Position[]);
  const step = Math.max(1, Math.floor(out.length / 400));
  return out.filter((_, i) => i % step === 0);
}

export const MapHighlights: React.FC<z.infer<typeof mapHighlightsSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const areas = useAreaHighlights(p.highlights, frame, fps, theme, p.borders);
  const shapes = useAreaShapes(p.highlights, p.borders);

  const keys = useMemo<Keyframe[] | null>(() => {
    if (!shapes) return null;
    const all = shapes.flatMap((s) => shapePoints(s.feature));
    const overview = fitCamera(p.projection, all, width, height, 0.12);
    if (p.cameraMode === "fit-all" || !shapes.length) return [{ at: 0, camera: overview }];
    if (p.cameraMode === "fixed") return [{ at: 0, camera: overview }];
    const k: Keyframe[] = [{ at: 0, camera: { ...overview, zoom: overview.zoom - 0.4 } }];
    // Arrive as each highlight starts, hold, and leave just in time for the next one.
    p.highlights.forEach((h, i) => {
      const c = fitCamera(p.projection, shapePoints(shapes[i].feature), width, height, 0.2, 9);
      const at = Math.max(k[k.length - 1].at + 10, Math.round(h.startSec * fps));
      const next = p.highlights[i + 1];
      k.push({ at, camera: c });
      if (next) {
        const gap = Math.round(next.startSec * fps) - at;
        const travel = Math.min(Math.round(1.6 * fps), Math.round(gap * 0.6));
        k.push({ at: Math.max(at + 1, at + gap - travel), camera: c, ease: "linear" });
      }
    });
    return k;
  }, [shapes, p.projection, p.cameraMode, p.highlights, width, height, fps]);

  const fixedPlace = usePlaces(p.cameraMode === "fixed" && p.fixedCenter ? [p.fixedCenter] : []);
  const fixed = fixedPlace && fixedPlace[0] ? cam(fixedPlace[0].lon, fixedPlace[0].lat, p.fixedZoom) : null;
  if (!keys) return <AbsoluteFill style={{ backgroundColor: theme.oceanEdge }} />;
  let camera: Camera = cameraAt(keys, frame, p.projection);
  if (p.cameraMode === "fixed" && fixed) camera = fixed;
  if (p.cameraMode === "fit-all") camera = { ...camera, zoom: camera.zoom + 0.1 * (frame / (p.durationSec * fps)) };

  const statesOf = p.stateBorders
    ? (shapes ?? []).map((s) => ("properties" in s.feature && s.feature.properties ? String((s.feature.properties as { a3?: string }).a3 ?? "") : "")).filter(Boolean)
    : undefined;

  return (
    <AbsoluteFill>
      <MapView
        kind={p.projection}
        camera={camera}
        theme={theme}
        borderView={p.borders}
        areas={areas}
        layers={{ countryLabels: p.countryLabels, states: statesOf && statesOf.length ? statesOf : undefined, graticule: p.projection === "globe" }}
      />
      <Finish theme={theme} />
      {p.title ? <TitleCard title={p.title} subtitle={p.subtitle} theme={theme} duration={p.durationSec * fps} /> : null}
      {p.highlights.map((h, i) => (
        <Sfx key={i} name={h.style === "pop-out" || h.style === "paper-cutout" || h.style === "extrude" ? "swish" : h.style === "neon" ? "static" : "pop"} at={Math.round(h.startSec * fps)} volume={p.sfxVolume} enabled={p.sfx} />
      ))}
      {keys.slice(1).map((k, i) => (
        <Sfx key={`w${i}`} name="whoosh" at={k.at - 24} volume={p.sfxVolume * 0.7} enabled={p.sfx && p.cameraMode === "tour"} />
      ))}
    </AbsoluteFill>
  );
};
