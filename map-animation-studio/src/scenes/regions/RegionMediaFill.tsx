import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MapView } from "../../map/MapView";
import { RegionFill, zRegionMedia } from "../../map/RegionFill";
import { useAreaShapes } from "../../map/useAreaHighlights";
import { shapePoints } from "../highlights/MapHighlights";
import { base, zProjection } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { cameraAt, fitCamera, type Keyframe } from "../../lib/camera";
import { Finish } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { TitleCard } from "../../ui/Overlays2D";

export const regionMediaSchema = z.object({
  ...base,
  projection: zProjection,
  cameraMode: z.enum(["fit-all", "tour"]),
  regions: z.array(zRegionMedia),
  countryLabels: z.boolean(),
  title: z.string(),
  subtitle: z.string(),
});

/** Flags, photos or video playing inside countries/states, clipped exactly to their borders. */
export const RegionMediaFill: React.FC<z.infer<typeof regionMediaSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const shapes = useAreaShapes(p.regions, p.borders);
  const keys = useMemo<Keyframe[] | null>(() => {
    if (!shapes) return null;
    const all = fitCamera(p.projection, shapes.flatMap((s) => shapePoints(s.feature)), width, height, 0.12, 9);
    if (p.cameraMode === "fit-all") return [{ at: 0, camera: all }];
    const k: Keyframe[] = [{ at: 0, camera: { ...all, zoom: all.zoom - 0.3 } }];
    p.regions.forEach((r, i) => {
      const at = Math.max(k[k.length - 1].at + 10, Math.round(r.startSec * fps));
      const c = fitCamera(p.projection, shapePoints(shapes[i].feature), width, height, 0.2, 9);
      k.push({ at, camera: c });
      const next = p.regions[i + 1];
      if (next) k.push({ at: Math.max(at + 1, Math.round(next.startSec * fps) - Math.round(fps * 1.2)), camera: c, ease: "linear" });
    });
    return k;
  }, [shapes, p.projection, p.cameraMode, p.regions, width, height, fps]);
  if (!shapes || !keys) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;
  const camera = cameraAt(keys, frame, p.projection);
  return (
    <AbsoluteFill>
      <MapView kind={p.projection} camera={p.cameraMode === "fit-all" ? { ...camera, zoom: camera.zoom + 0.08 * (frame / (p.durationSec * fps)) } : camera} theme={theme} borderView={p.borders} layers={{ countryLabels: p.countryLabels, graticule: p.projection === "globe" }}>
        {p.regions.map((r, i) => (
          <RegionFill key={i} spec={r} shape={shapes[i]} />
        ))}
      </MapView>
      <Finish theme={theme} />
      {p.title ? <TitleCard title={p.title} subtitle={p.subtitle} theme={theme} duration={p.durationSec * fps} /> : null}
      {p.regions.map((r, i) => (
        <Sfx key={i} name="swish" at={Math.round(r.startSec * fps)} volume={p.sfxVolume} enabled={p.sfx} />
      ))}
    </AbsoluteFill>
  );
};
