import { useMemo } from "react";
import { z } from "zod";
import { staticFile } from "remotion";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { loadOnce, loadStates, useAsset, useWorld, type BorderView, type World } from "../lib/data";
import { loadGazetteer } from "../lib/places";
import { HIGHLIGHT_STYLES, radiusCircle, type ResolvedHighlight } from "./highlightStyles";
import { countryLabel, findCountry } from "./paint";
import type { Theme } from "../lib/themes";

export const zHighlight = z.object({
  target: z
    .string()
    .describe('Country ("India", "IND"), state ("Kerala" or "Punjab, Pakistan"), a place for radius rings, or "file:areas/my.geojson"'),
  level: z.enum(["auto", "country", "state", "radius"]),
  radiusKm: z.number().min(0).max(5000).describe("For level = radius"),
  style: z.enum(HIGHLIGHT_STYLES),
  color: z.string().describe('CSS colour or "auto"'),
  startSec: z.number().min(0),
  endSec: z.number().min(0).describe("0 = stays until the end"),
  label: z.string().describe('"auto" = area name, "" = no label'),
  sublabel: z.string(),
});
export type HighlightSpec = z.infer<typeof zHighlight>;

export const highlightDefaults = (h: Partial<HighlightSpec> & { target: string }): HighlightSpec => ({
  level: "auto",
  radiusKm: 0,
  style: "glow",
  color: "auto",
  startSec: 0,
  endSec: 0,
  label: "auto",
  sublabel: "",
  ...h,
});

export type Shape = { feature: Feature<Geometry> | FeatureCollection; name: string };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

type ShapeQuery = { target: string; level: HighlightSpec["level"]; radiusKm: number };

async function resolveShape(spec: ShapeQuery, world: World): Promise<Shape> {
  const t = spec.target.trim();
  if (t.startsWith("file:")) {
    const file = t.slice(5).trim();
    const res = await fetch(file.startsWith("http") ? file : staticFile(file));
    if (!res.ok) throw new Error(`Could not load ${file}`);
    const gj = (await res.json()) as FeatureCollection | Feature<Geometry>;
    const name = gj.type === "Feature" ? String(gj.properties?.name ?? file) : String(gj.features[0]?.properties?.name ?? file);
    return { feature: gj, name };
  }
  if (spec.level === "radius") {
    const g = await loadGazetteer();
    const p = g.find(t);
    if (!p) throw new Error(`Place not found for radius highlight: "${t}"`);
    return { feature: { type: "Feature", properties: {}, geometry: radiusCircle([p.lon, p.lat], spec.radiusKm || 100) }, name: p.name };
  }
  if (spec.level !== "state") {
    const c = findCountry(world, t, "hi");
    if (c) return { feature: c, name: countryLabel(c) };
    if (spec.level === "country") throw new Error(`Country not found: "${t}"`);
  }
  const states = await loadStates();
  const [name, country] = t.split(",").map(norm);
  const matches = states.features.filter(
    (f) => norm(f.properties.name) === name && (!country || norm(f.properties.country).includes(country) || norm(f.properties.a3) === country),
  );
  if (!matches.length) throw new Error(`No country or state named "${t}". For states in other countries use "State, Country".`);
  // Prefer India when a state name exists in several countries.
  const pick = matches.find((f) => f.properties.a3 === "IND") ?? matches[0];
  return { feature: pick, name: pick.properties.name };
}

/** Resolves highlight specs into drawable shapes and per-frame timing. */
export function useAreaHighlights(specs: HighlightSpec[], frame: number, fps: number, theme: Theme, borders: BorderView = "india"): ResolvedHighlight[] {
  const world = useWorld(borders);
  const key = world ? `areas:${borders}:${JSON.stringify(specs.map((s) => [s.target, s.level, s.radiusKm]))}` : null;
  const shapes = useAsset(key, () => loadOnce(key!, () => Promise.all(specs.map((s) => resolveShape(s, world!)))));
  return useMemo(() => {
    if (!shapes) return [];
    return specs.map((s, i) => {
      const start = Math.round(s.startSec * fps);
      const end = s.endSec > 0 ? Math.round(s.endSec * fps) : Infinity;
      return {
        feature: shapes[i].feature,
        style: s.style,
        color: !s.color || s.color === "auto" ? theme.accent : s.color,
        t: frame - start,
        remaining: end - frame,
        inFrames: 18,
        label: s.label === "auto" ? shapes[i].name : s.label || undefined,
        sublabel: s.sublabel || undefined,
      };
    });
  }, [shapes, specs, frame, fps, theme]);
}

/** Geographic shapes for any list of targets (highlights, region media, framing). */
export function useAreaShapes(specs: ShapeQuery[], borders: BorderView = "india") {
  const world = useWorld(borders);
  const key = world ? `areas:${borders}:${JSON.stringify(specs.map((s) => [s.target, s.level, s.radiusKm]))}` : null;
  return useAsset(key, () => loadOnce(key!, () => Promise.all(specs.map((s) => resolveShape(s, world!)))));
}
