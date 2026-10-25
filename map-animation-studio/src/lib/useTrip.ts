import { useMemo } from "react";
import { loadOnce, useAsset } from "./data";
import { loadGazetteer, resolveOrThrow, type LonLat, type Place } from "./places";
import { buildRoute, parseTrack, type RouteMode } from "./routing";
import { GeoPath } from "./geo";
import { staticFile } from "remotion";

export type Trip = {
  stops: Place[];
  coords: LonLat[];
  /** Elevation per coordinate when the route came from a GPX/GeoJSON track with heights. */
  ele: (number | null)[] | null;
  path: GeoPath;
  note: string;
};

/**
 * Resolves place names to coordinates and builds the route between them.
 * `trackFile` (GPX or GeoJSON in public/) overrides routing with an exact recorded path.
 */
export function useTrip(stops: string[], mode: RouteMode, trackFile = ""): Trip | null {
  const key = `trip:${mode}:${trackFile}:${stops.join("|")}`;
  const raw = useAsset(key, () =>
    loadOnce(key, async () => {
      const g = await loadGazetteer();
      const places = stops.filter((s) => s.trim()).map((s) => resolveOrThrow(g, s));
      if (trackFile) {
        const text = await (await fetch(trackFile.startsWith("http") ? trackFile : staticFile(trackFile))).text();
        const t = parseTrack(text);
        if (t.coords.length < 2) throw new Error(`No track points found in ${trackFile}`);
        const named = places.length ? places : [];
        return { places: named, coords: t.coords, ele: t.ele.some((e) => e !== null) ? t.ele : null, note: `Track: ${trackFile}` };
      }
      const r = await buildRoute(
        places.map((p) => [p.lon, p.lat] as LonLat),
        mode,
      );
      return { places, coords: r.coords, ele: null, note: r.note };
    }),
  );
  return useMemo(() => {
    if (!raw) return null;
    const stopsOut = raw.places.length
      ? raw.places
      : [
          { name: "Start", lon: raw.coords[0][0], lat: raw.coords[0][1], region: "", country: "", a3: "", pop: 0, kind: "coords" as const },
          { name: "Finish", lon: raw.coords[raw.coords.length - 1][0], lat: raw.coords[raw.coords.length - 1][1], region: "", country: "", a3: "", pop: 0, kind: "coords" as const },
        ];
    return { stops: stopsOut, coords: raw.coords, ele: raw.ele, path: new GeoPath(raw.coords), note: raw.note };
  }, [raw]);
}

/** Resolves a list of place names (no routing). */
export function usePlaces(names: string[]): Place[] | null {
  const key = `places:${names.join("|")}`;
  return useAsset(key, async () => {
    const g = await loadGazetteer();
    return names.filter((n) => n.trim()).map((n) => resolveOrThrow(g, n));
  });
}

