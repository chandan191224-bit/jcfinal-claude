import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { MapView } from "../../map/MapView";
import { HIGHLIGHT_STYLES } from "../../map/highlightStyles";
import { highlightDefaults, useAreaHighlights, useAreaShapes, type HighlightSpec } from "../../map/useAreaHighlights";
import { shapePoints } from "../highlights/MapHighlights";
import { base, zProjection } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { cam, fitCamera, flyTo, type Camera } from "../../lib/camera";
import { clamp } from "../../lib/geo";
import { CameraShake, Finish } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";

export const earthZoomSchema = z.object({
  ...base,
  projection: zProjection,
  steps: z.array(
    z.object({
      target: z.string(),
      level: z.enum(["auto", "country", "state", "radius"]),
      radiusKm: z.number().min(0).max(3000),
      style: z.enum(HIGHLIGHT_STYLES),
      color: z.string(),
      label: z.string(),
    }),
  ),
  beatTimesSec: z.array(z.number()).describe("Arrival time of each step, e.g. the beats of your music; empty = evenly spaced"),
  music: z.string().describe("Optional music file in public/ (beats above should match it)"),
  musicVolume: z.number().min(0).max(1),
  rampSec: z.number().min(0.3).max(3).describe("Length of each zoom move"),
  shake: z.boolean().describe("Impact shake on arrival"),
  flash: z.boolean().describe("White flash on arrival"),
});

/** Speed ramp: slow start, very fast middle, soft landing (the classic "Earth zoom"). */
const ramp = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2;
};

export const EarthZoomChain: React.FC<z.infer<typeof earthZoomSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const n = p.steps.length;
  const arrivals = useMemo(
    () =>
      p.steps.map((_, i) =>
        p.beatTimesSec[i] !== undefined ? Math.round(p.beatTimesSec[i] * fps) : Math.round(((i + 1) / (n + 0.6)) * durationInFrames),
      ),
    [p.steps, p.beatTimesSec, fps, n, durationInFrames],
  );
  const specs: HighlightSpec[] = useMemo(
    () =>
      p.steps.map((s, i) =>
        highlightDefaults({
          target: s.target,
          level: s.level,
          radiusKm: s.radiusKm,
          style: s.style,
          color: s.color,
          label: s.label,
          startSec: arrivals[i] / fps,
          endSec: i < n - 1 ? arrivals[i + 1] / fps - p.rampSec * 0.6 : 0,
        }),
      ),
    [p.steps, arrivals, fps, n, p.rampSec],
  );
  const areas = useAreaHighlights(specs, frame, fps, theme, p.borders);
  const shapes = useAreaShapes(specs, p.borders);
  const cams = useMemo<Camera[] | null>(
    () => (shapes ? shapes.map((s) => fitCamera(p.projection, shapePoints(s.feature), width, height, 0.22, 8)) : null),
    [shapes, p.projection, width, height],
  );
  if (!cams || !cams.length) return <AbsoluteFill style={{ background: theme.space }} />;
  const first = cams[0];
  const start = p.projection === "globe" ? cam(first.lon - 60, first.lat * 0.4, -0.5) : { ...first, zoom: first.zoom - 2.5 };
  const rampF = Math.round(p.rampSec * fps);
  let camera = start;
  let seg = -1;
  for (let i = 0; i < n; i++) if (frame >= arrivals[i] - rampF) seg = i;
  if (seg >= 0) {
    const from = seg === 0 ? start : cams[seg - 1];
    const t = (frame - (arrivals[seg] - rampF)) / rampF;
    camera = flyTo(from, cams[seg], ramp(t), p.projection, 1.2);
    if (t >= 1) camera = { ...cams[seg], zoom: cams[seg].zoom + 0.08 * clamp((frame - arrivals[seg]) / (fps * 3)) };
  }
  const lastHit = arrivals.filter((a) => frame >= a).pop() ?? -999;
  const since = frame - lastHit;
  const flash = p.flash ? Math.max(0, 1 - since / 6) * 0.7 : 0;
  const shakeAmt = p.shake ? Math.max(0, 10 * (1 - since / 12)) : 0;
  return (
    <AbsoluteFill style={{ background: theme.space }}>
      <CameraShake amount={shakeAmt} speed={0.9}>
        <MapView kind={p.projection} camera={camera} theme={theme} borderView={p.borders} areas={areas} layers={{ countryLabels: true, states: "all", graticule: p.projection === "globe" }} />
      </CameraShake>
      <Finish theme={theme} />
      {flash > 0 ? <AbsoluteFill style={{ background: "white", opacity: flash }} /> : null}
      {p.music ? <Audio src={p.music.startsWith("http") ? p.music : staticFile(p.music)} volume={p.musicVolume} /> : null}
      {arrivals.map((a, i) => (
        <React.Fragment key={i}>
          <Sfx name="whoosh" at={a - rampF * 0.85} volume={p.sfxVolume} enabled={p.sfx} />
          <Sfx name="impact" at={a - 1} volume={p.sfxVolume * 0.7} enabled={p.sfx} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
