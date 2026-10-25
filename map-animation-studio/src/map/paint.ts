import { geoGraticule10, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { ProjectionKind } from "../lib/camera";
import {
  loadLines,
  loadStates,
  pickLod,
  useAsset,
  type CountryFeature,
  type LineLayer,
  type StatesData,
  type World,
} from "../lib/data";
import { drawRaster, loadRelief, loadTexture, type Texture } from "../lib/raster";
import type { RasterKind, Theme } from "../lib/themes";
import type { LonLat } from "../lib/places";
import { seeded } from "../lib/geo";
import { font } from "../lib/fonts";
import { drawHighlights, type ResolvedHighlight } from "./highlightStyles";

export type Highlight = {
  /** Country name, ISO3 code ("IND") or Natural Earth code. */
  country: string;
  fill?: string;
  stroke?: string;
  /** 0..1 fade-in of the fill. */
  amount?: number;
  /** 0..1 how much the rest of the world is dimmed. */
  dim?: number;
  glow?: boolean;
};

export type MapLabel = { text: string; lon: number; lat: number; size?: number; kind?: "city" | "capital" | "region" | "water" };

export type MapLayers = {
  graticule?: boolean;
  /** ISO3 codes whose state/province borders are drawn, or "all". */
  states?: string[] | "all";
  rivers?: boolean;
  lakes?: boolean;
  roads?: boolean;
  rail?: boolean;
  countryLabels?: boolean;
  labels?: MapLabel[];
};

export type CanvasPainter = (ctx: CanvasRenderingContext2D, path: ReturnType<typeof geoPath>, projection: GeoProjection, world: World) => void;

export type MapAssets = {
  day: Texture | null;
  night: Texture | null;
  dark: Texture | null;
  relief: Texture | null;
  states: StatesData | null;
  rivers: LineLayer | null;
  lakes: LineLayer | null;
  roads: LineLayer | null;
  rail: LineLayer | null;
};

/** Loads the imagery and line layers a map needs (holding the render until they are ready). */
export function useMapAssets(theme: Theme, layers: MapLayers, raster: RasterKind | undefined, sun: LonLat | null): MapAssets {
  const rasterKind = raster ?? theme.raster;
  const needDay = rasterKind === "satellite";
  const needNight = rasterKind === "night" || (rasterKind === "satellite" && !!sun);
  return {
    day: useAsset<Texture>(needDay ? "tex:day" : null, () => loadTexture("day")),
    night: useAsset<Texture>(needNight ? "tex:night" : null, () => loadTexture("night")),
    dark: useAsset<Texture>(rasterKind === "dark" ? "tex:dark" : null, () => loadTexture("dark")),
    relief: useAsset<Texture>(rasterKind === "relief" ? "tex:relief" : null, loadRelief),
    states: useAsset<StatesData>(layers.states ? "states" : null, loadStates),
    rivers: useAsset<LineLayer>(layers.rivers ? "lines:rivers" : null, () => loadLines("rivers")),
    lakes: useAsset<LineLayer>(layers.lakes ? "lines:lakes" : null, () => loadLines("lakes")),
    roads: useAsset<LineLayer>(layers.roads ? "lines:roads" : null, () => loadLines("roads")),
    rail: useAsset<LineLayer>(layers.rail ? "lines:rail" : null, () => loadLines("rail")),
  };
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "USA",
  us: "USA",
  america: "USA",
  "united states of america": "USA",
  uk: "GBR",
  britain: "GBR",
  "great britain": "GBR",
  england: "GBR",
  uae: "ARE",
  emirates: "ARE",
  burma: "MMR",
  "south korea": "KOR",
  korea: "KOR",
  "north korea": "PRK",
  "czech republic": "CZE",
  "ivory coast": "CIV",
  holland: "NLD",
  "drc": "COD",
  "congo": "COG",
  turkey: "TUR",
  turkiye: "TUR",
  "east timor": "TLS",
  swaziland: "SWZ",
  eswatini: "SWZ",
  macedonia: "MKD",
  "vatican": "VAT",
  palestine: "PSX",
  bharat: "IND",
  hindustan: "IND",
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Exact code or name match (short, long or English name). */
export const matchCountry = (f: CountryFeature, q: string) => {
  const s = norm(q);
  const p = f.properties;
  const alias = COUNTRY_ALIASES[s];
  if (alias) return p.a3 === alias || p.iso === alias;
  return norm(p.a3) === s || norm(p.name) === s || norm(p.en ?? "") === s || norm(p.long ?? "") === s || norm(p.iso) === s;
};

/** Finds a country, preferring Natural Earth codes over ISO codes (ISO codes repeat for territories). */
export function findCountry(world: World, q: string, lod: "lo" | "mid" | "hi" = "mid") {
  const list = world[lod].countries;
  const s = norm(q);
  const alias = COUNTRY_ALIASES[s];
  const code = (alias ?? q).toUpperCase();
  return list.find((f) => f.properties.a3 === code) ?? list.find((f) => matchCountry(f, q)) ?? null;
}

/** Short display name ("China", "South Korea"). */
export const countryLabel = (f: CountryFeature) => {
  const p = f.properties;
  return p.en && p.en.length < p.name.length ? p.en : p.name;
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const rankLimit = (ppd: number) => (ppd < 8 ? 3 : ppd < 20 ? 6 : ppd < 50 ? 8 : 12);

export type PaintOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  projection: GeoProjection;
  kind: ProjectionKind;
  /** Pixels per degree, for level of detail. */
  ppd: number;
  theme: Theme;
  world: World;
  assets: MapAssets;
  layers: MapLayers;
  highlights: Highlight[];
  rasterKind: RasterKind;
  rasterOpacity?: number;
  sun: LonLat | null;
  space: boolean;
  paint?: CanvasPainter;
  /** Styled area highlights drawn on top of everything. */
  areas?: ResolvedHighlight[];
};

/** Paints a complete map frame onto a 2D canvas. Used by <MapView> and by 3D map textures. */
export function paintMap(o: PaintOptions) {
  const { ctx, width, height, projection, kind, ppd, theme, world, layers, highlights, rasterKind, rasterOpacity, sun, space, paint, areas } = o;
  const { day, night, dark, relief, states, rivers, lakes, roads, rail } = o.assets;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const path = geoPath(projection, ctx);
  const lod = world[pickLod(ppd)];
  const sphere: GeoPermissibleObjects = { type: "Sphere" };
  const R = projection.scale();
  const [cx, cy] = projection.translate();

  // Space, stars and atmosphere.
  if (kind === "globe" && space) {
    ctx.fillStyle = theme.space;
    ctx.fillRect(0, 0, width, height);
    const rnd = seeded(7);
    for (let i = 0; i < 700; i++) {
      const x = rnd() * width;
      const y = rnd() * height;
      const s = rnd();
      ctx.fillStyle = `rgba(255,255,255,${0.15 + s * 0.6})`;
      ctx.fillRect(x, y, s > 0.97 ? 2 : 1, s > 0.97 ? 2 : 1);
    }
    if (R < Math.max(width, height) * 2) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.12);
      g.addColorStop(0, theme.atmosphere);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ocean.
  ctx.beginPath();
  if (kind === "globe") path(sphere);
  else ctx.rect(0, 0, width, height);
  const og = kind === "globe"
    ? ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
    : ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 1.6);
  og.addColorStop(0, theme.ocean);
  og.addColorStop(1, theme.oceanEdge);
  ctx.fillStyle = og;
  ctx.fill();

  // Imagery.
  const op = rasterOpacity ?? theme.rasterOpacity;
  if ((rasterKind === "satellite" && day) || (rasterKind === "night" && night) || (rasterKind === "dark" && dark)) {
    ctx.save();
    ctx.globalAlpha = op;
    drawRaster(ctx, projection, width, height, {
      day: rasterKind === "satellite" ? day! : rasterKind === "dark" ? dark! : undefined,
      night: night ?? undefined,
      sun: rasterKind === "satellite" ? sun : null,
      brightness: rasterKind === "night" ? 1.25 : 1,
    });
    ctx.restore();
  }

  // Graticule.
  if (layers.graticule) {
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = theme.graticule;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Land, with slight per-country variation.
  const dimAmt = Math.max(0, ...highlights.map((h) => (h.dim ?? 0) * (h.amount ?? 1)));
  ctx.beginPath();
  for (const f of lod.countries) if (hash(f.properties.a3) % 2 === 0) path(f);
  ctx.fillStyle = theme.land;
  ctx.fill();
  ctx.beginPath();
  for (const f of lod.countries) if (hash(f.properties.a3) % 2 === 1) path(f);
  ctx.fillStyle = theme.landAlt;
  ctx.fill();

  // Relief shading multiplies over land and sea.
  if (rasterKind === "relief" && relief) {
    ctx.save();
    ctx.globalAlpha = op;
    ctx.globalCompositeOperation = "multiply";
    drawRaster(ctx, projection, width, height, { day: relief, step: 2 });
    ctx.restore();
  }

  // Dim everything that is not highlighted.
  if (dimAmt > 0) {
    ctx.beginPath();
    if (kind === "globe") path(sphere);
    else ctx.rect(0, 0, width, height);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, dimAmt * 0.75)})`;
    ctx.fill();
  }

  if (paint) paint(ctx, path, projection, world);

  // Highlighted countries.
  for (const h of highlights) {
    const f = findCountry(world, h.country, pickLod(ppd));
    if (!f) continue;
    const a = h.amount ?? 1;
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    path(f);
    ctx.fillStyle = h.fill ?? theme.highlight;
    if (h.glow) {
      ctx.shadowColor = h.stroke ?? theme.highlightStroke;
      ctx.shadowBlur = 30;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = h.stroke ?? theme.highlightStroke;
    ctx.stroke();
    ctx.restore();
  }

  // Water.
  if (lakes) {
    ctx.beginPath();
    for (const f of lakes.features) if (Number(f.properties.rank) <= rankLimit(ppd)) path(f as Feature<Geometry>);
    ctx.fillStyle = theme.lake;
    ctx.fill();
  }
  if (rivers) {
    ctx.beginPath();
    for (const f of rivers.features) if (Number(f.properties.rank) <= rankLimit(ppd)) path(f as Feature<Geometry>);
    ctx.strokeStyle = theme.river;
    ctx.lineWidth = ppd > 40 ? 1.6 : 1;
    ctx.stroke();
  }
  if (roads) {
    ctx.beginPath();
    path(roads.all);
    ctx.strokeStyle = theme.road;
    ctx.lineWidth = ppd > 60 ? 2 : 1;
    ctx.stroke();
  }
  if (rail) {
    ctx.save();
    ctx.beginPath();
    path(rail.all);
    ctx.strokeStyle = theme.rail;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = ppd > 60 ? 1.6 : 1;
    ctx.stroke();
    ctx.restore();
  }

  // State borders.
  if (states && layers.states) {
    ctx.save();
    ctx.beginPath();
    const list = layers.states === "all" ? [...states.byCountry.keys()] : layers.states;
    for (const a3 of list) {
      const m = states.byCountry.get(a3.toUpperCase());
      if (m) path(m);
    }
    ctx.strokeStyle = theme.state;
    ctx.lineWidth = ppd > 30 ? 1.1 : 0.7;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.restore();
  }

  // Borders and coastline.
  ctx.save();
  ctx.beginPath();
  path(lod.borders);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = theme.borderWidth * (ppd > 40 ? 1.5 : 1);
  ctx.setLineDash(theme.borderDash);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  path(lod.coast);
  ctx.strokeStyle = theme.coast;
  ctx.lineWidth = theme.coastWidth;
  ctx.stroke();

  // Globe edge shading gives the sphere depth.
  if (kind === "globe") {
    const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.2, cx, cy, R);
    g.addColorStop(0, "rgba(255,255,255,0.06)");
    g.addColorStop(0.75, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.beginPath();
    path(sphere);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Labels.
  const visible = (p: LonLat) => {
    const q = projection(p);
    if (!q) return false;
    if (kind !== "globe") return true;
    const back = projection.invert!(q);
    return !!back && Math.abs(back[0] - p[0]) < 1e-3 && Math.abs(back[1] - p[1]) < 1e-3;
  };
  const drawLabel = (text: string, p: LonLat, size: number, style: "country" | "city" | "capital" | "region" | "water") => {
    if (!visible(p)) return;
    const q = projection(p)!;
    ctx.save();
    const fam = font(theme.labelFont);
    if (style === "country" || style === "region") {
      ctx.font = `600 ${size}px ${fam}`;
      ctx.letterSpacing = `${size * 0.18}px`;
      text = text.toUpperCase();
    } else if (style === "water") {
      ctx.font = `italic 400 ${size}px ${fam}`;
    } else ctx.font = `${style === "capital" ? 700 : 600} ${size}px ${fam}`;
    ctx.textAlign = style === "city" || style === "capital" ? "left" : "center";
    ctx.textBaseline = "middle";
    const dx = style === "city" || style === "capital" ? size * 0.6 : 0;
    ctx.lineWidth = Math.max(3, size * 0.22);
    ctx.strokeStyle = theme.labelHalo;
    ctx.lineJoin = "round";
    ctx.strokeText(text, q[0] + dx, q[1]);
    ctx.fillStyle = theme.label;
    ctx.fillText(text, q[0] + dx, q[1]);
    if (style === "city" || style === "capital") {
      ctx.beginPath();
      ctx.arc(q[0], q[1], size * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = theme.label;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.labelHalo;
      ctx.stroke();
      if (style === "capital") {
        ctx.beginPath();
        ctx.arc(q[0], q[1], size * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = theme.label;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  if (layers.countryLabels) {
    const minPop = ppd < 6 ? 6e7 : ppd < 12 ? 2e7 : ppd < 30 ? 4e6 : 0;
    const size = Math.max(13, Math.min(30, 9 + ppd * 0.35));
    const labelled = new Set(
      (areas ?? []).filter((a) => a.label && a.t >= 0).map((a) => ("properties" in a.feature && a.feature.properties ? (a.feature.properties as { a3?: string }).a3 : undefined)),
    );
    for (const f of world.mid.countries) {
      if (f.properties.pop < minPop || labelled.has(f.properties.a3)) continue;
      drawLabel(countryLabel(f), [f.properties.lx, f.properties.ly], size, "country");
    }
  }
  for (const l of layers.labels ?? []) drawLabel(l.text, [l.lon, l.lat], l.size ?? 26, l.kind ?? "city");
  if (areas && areas.length) drawHighlights(ctx, projection, areas, theme, width, height);
}
