import React from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { TravelScene } from "../TravelScene";
import { base, zColorOrAuto, zProjection, zRouteMode } from "../../lib/schema";
import { VehicleGlyph } from "../../map/icons";
import { clamp } from "../../lib/geo";
import { PaperTexture } from "../../fx/Finish";

export const parchmentSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(2),
  mode: zRouteMode,
  projection: zProjection,
  routeColor: zColorOrAuto,
  routeWidth: z.number().min(1).max(30),
  cameraMode: z.enum(["fit", "follow", "fly", "overview-follow"]),
  stopPauseSec: z.number().min(0).max(5),
  planeOverlay: z.boolean().describe("Big translucent plane flying over the map (the classic adventure-film look)"),
  burnEdges: z.boolean(),
  title: z.string(),
});

/** The plane superimposed over the map, travelling the route's direction. */
const PlaneOverlay: React.FC<{ progress: number }> = ({ progress }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (progress <= 0 || progress >= 1) return null;
  const sway = Math.sin(frame / 18) * 6;
  const a = clamp(progress / 0.08) * clamp((1 - progress) / 0.08);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.55 * a, mixBlendMode: "multiply" }}>
      <svg width={width} height={height}>
        <g transform={`translate(${width * 0.5},${height * 0.42 + sway}) rotate(-8) scale(${height / 260})`} style={{ filter: "blur(1.2px)" }}>
          <VehicleGlyph type="plane" color="#2b1d10" accent="#2b1d10" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export const ParchmentCrawl: React.FC<z.infer<typeof parchmentSchema>> = (p) => (
  <TravelScene
    {...p}
    theme={p.theme}
    vehicle="dot"
    routeStyle="ink"
    lift={0}
    pitch={0}
    introSec={1}
    outroSec={1.5}
    easing="linear"
    showDistance={false}
    showHud={false}
    arrivalCard={false}
    layers={{ graticule: true, rivers: true }}
    overlay={({ progress }) => (
      <>
        {p.planeOverlay ? <PlaneOverlay progress={progress} /> : null}
        {p.burnEdges ? <PaperTexture strength={0.8} antique burn creases /> : null}
      </>
    )}
  />
);
