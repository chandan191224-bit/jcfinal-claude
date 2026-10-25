import { useMemo } from "react";
import * as THREE from "three";
import { geoMercator, type GeoProjection } from "d3-geo";
import { useWorld, type BorderView } from "../lib/data";
import { paintMap, useMapAssets, type MapLayers } from "../map/paint";
import type { Theme } from "../lib/themes";
import type { LonLat } from "../lib/places";

let paintCount = 0;

export type MapPlane = {
  texture: THREE.CanvasTexture | null;
  canvas: HTMLCanvasElement;
  projection: GeoProjection;
  size: number;
  /** Map coordinate → plane coordinate (x right, z toward the viewer), plane spans ±half. */
  toPlane: (p: LonLat) => [number, number];
  half: number;
};

/**
 * Paints a square Mercator map of the area around `points` into a texture for 3D scenes.
 * `extraPaint` draws dynamic things (routes) on top every frame.
 */
export function useMapTexture(opts: {
  points: LonLat[];
  theme: Theme;
  borders: BorderView;
  layers?: MapLayers;
  size?: number;
  padding?: number;
  half?: number;
  extraPaint?: (ctx: CanvasRenderingContext2D, projection: GeoProjection) => void;
  frameKey?: number;
}): MapPlane | null {
  const { points, theme, borders, layers = {}, size = 2048, padding = 0.18, half = 10, extraPaint, frameKey } = opts;
  const world = useWorld(borders);
  const assets = useMapAssets(theme, layers, undefined, null);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    return c;
  }, [size]);
  const base = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    return c;
  }, [size]);
  const projection = useMemo(() => {
    const pad = size * padding;
    const fc = { type: "MultiPoint" as const, coordinates: points.length ? points : [[0, 0] as LonLat] };
    const p = geoMercator().fitExtent(
      [
        [pad, pad],
        [size - pad, size - pad],
      ],
      fc,
    );
    if (points.length < 2) p.scale(size * 2);
    return p;
  }, [points, size, padding]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  const ready = !!world;
  // Static base map, painted once.
  const baseKey = useMemo(() => {
    if (!world) return 0;
    paintMap({
      ctx: base.getContext("2d", { willReadFrequently: true })!,
      width: size,
      height: size,
      projection,
      kind: "mercator",
      ppd: (projection.scale() * Math.PI) / 180,
      theme,
      world,
      assets,
      layers: { countryLabels: true, ...layers },
      highlights: [],
      rasterKind: theme.raster,
      sun: null,
      space: false,
    });
    return ++paintCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, projection, theme, size, assets.relief, assets.day, assets.states, assets.rivers, assets.roads]);
  // Composed synchronously during render so the 3D renderer always sees this frame's texture.
  useMemo(() => {
    if (!ready) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(base, 0, 0);
    if (extraPaint) extraPaint(ctx, projection);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, baseKey, frameKey, texture]);
  if (!ready) return null;
  return {
    texture,
    canvas,
    projection,
    size,
    half,
    toPlane: (p) => {
      const q = projection(p) ?? [size / 2, size / 2];
      return [(q[0] / size - 0.5) * 2 * half, (q[1] / size - 0.5) * 2 * half];
    },
  };
}
