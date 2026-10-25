import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import { makeProjection, pixelsPerDegree, type Camera, type ProjectionKind } from "../lib/camera";
import { useWorld, type BorderView, type World } from "../lib/data";
import type { RasterKind, Theme } from "../lib/themes";
import type { LonLat } from "../lib/places";
import { paintMap, useMapAssets, type CanvasPainter, type Highlight, type MapLayers } from "./paint";
import type { ResolvedHighlight } from "./highlightStyles";

export type { Highlight, MapLabel, MapLayers, CanvasPainter } from "./paint";
export { matchCountry, findCountry } from "./paint";

export type MapCtx = {
  projection: GeoProjection;
  path: (o: GeoPermissibleObjects) => string;
  width: number;
  height: number;
  /** Offset of the visible frame inside the (taller, tilted) map plane. */
  offsetY: number;
  camera: Camera;
  kind: ProjectionKind;
  theme: Theme;
  world: World | null;
  /** True if the point faces the camera (always true on flat maps). */
  visible: (p: LonLat) => boolean;
};

const Ctx = createContext<MapCtx | null>(null);
export const useMap = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMap() must be used inside <MapView>");
  return c;
};

type Props = {
  kind: ProjectionKind;
  camera: Camera;
  theme: Theme;
  borderView?: BorderView;
  layers?: MapLayers;
  highlights?: Highlight[];
  /** Real sun position for day/night shading of satellite imagery. */
  sun?: LonLat | null;
  raster?: RasterKind;
  rasterOpacity?: number;
  /** Stars and atmosphere around a globe. */
  space?: boolean;
  /** Extra canvas drawing after land and before borders (territories, choropleths...). */
  paint?: CanvasPainter;
  /** Styled area highlights (see useAreaHighlights). */
  areas?: ResolvedHighlight[];
  /** Render size; defaults to the composition size. */
  size?: { width: number; height: number };
  children?: React.ReactNode;
};

const NO_LAYERS: MapLayers = {};
const NO_HIGHLIGHTS: Highlight[] = [];

export const MapView: React.FC<Props> = ({
  kind,
  camera,
  theme,
  borderView = "india",
  layers = NO_LAYERS,
  highlights = NO_HIGHLIGHTS,
  sun = null,
  raster,
  rasterOpacity,
  space = kind === "globe",
  paint,
  areas,
  size,
  children,
}) => {
  const video = useVideoConfig();
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const world = useWorld(borderView);
  const assets = useMapAssets(theme, layers, raster, sun);
  const rasterKind = raster ?? theme.raster;

  // Tilted cameras render a taller plane that leans back in 3D; the camera centre stays put.
  const tilt = Math.max(0, Math.min(70, camera.pitch));
  const planeH = tilt > 0 ? Math.round(height * (1 + tilt / 30)) : height;
  const offsetY = planeH - height;
  const projection = useMemo(() => {
    const p = makeProjection(kind, camera, width, planeH);
    const [tx, ty] = p.translate();
    return p.translate([tx, ty + (planeH - height) / 2]);
  }, [kind, camera, width, height, planeH]);

  const ref = useRef<HTMLCanvasElement>(null);
  const ppd = pixelsPerDegree(kind, camera, width, height);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !world) return;
    paintMap({
      ctx: canvas.getContext("2d")!,
      width,
      height: planeH,
      projection,
      kind,
      ppd,
      theme,
      world,
      assets,
      layers,
      highlights,
      rasterKind,
      rasterOpacity,
      sun,
      space,
      paint,
      areas,
    });
  });

  const ctxValue = useMemo<MapCtx>(() => {
    const svgPath = geoPath(projection);
    return {
      projection,
      path: (o) => svgPath(o) ?? "",
      width,
      height: planeH,
      offsetY,
      camera,
      kind,
      theme,
      world,
      visible: (p) => {
        const q = projection(p);
        if (!q) return false;
        if (kind !== "globe") return true;
        const back = projection.invert!(q);
        return !!back && Math.abs(back[0] - p[0]) < 1e-3 && Math.abs(back[1] - p[1]) < 1e-3;
      },
    };
  }, [projection, width, planeH, offsetY, camera, kind, theme, world]);

  const originY = planeH - height / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", width, height, backgroundColor: kind === "globe" ? theme.space : theme.oceanEdge }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -offsetY,
          width,
          height: planeH,
          transformOrigin: `${width / 2}px ${originY}px`,
          transform: tilt > 0 ? `perspective(${height * 1.4}px) rotateX(${tilt}deg)` : undefined,
        }}
      >
        <canvas ref={ref} width={width} height={planeH} style={{ position: "absolute", inset: 0 }} />
        <Ctx.Provider value={ctxValue}>{world ? children : null}</Ctx.Provider>
      </div>
    </AbsoluteFill>
  );
};

/** SVG layer that shares the map projection. Put routes, pins and labels inside. */
export const MapOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useMap();
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {children}
    </svg>
  );
};
