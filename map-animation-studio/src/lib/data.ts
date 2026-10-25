import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";

// Assets are fetched once per browser tab and shared by every scene.
const pending = new Map<string, Promise<unknown>>();
const ready = new Map<string, unknown>();

export function loadOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (!pending.has(key)) {
    const p = loader().then((v) => {
      ready.set(key, v);
      return v;
    });
    pending.set(key, p);
  }
  return pending.get(key) as Promise<T>;
}

export const peek = <T,>(key: string) => ready.get(key) as T | undefined;

/**
 * The editor app sets `window.__MAP_STUDIO_SOFT_ERRORS__` so a typo (an unknown place, a missing
 * file) leaves that one element out of the preview and shows a warning, instead of stopping the
 * whole preview. Renders keep failing loudly.
 */
const softErrors = () => typeof window !== "undefined" && (window as { __MAP_STUDIO_SOFT_ERRORS__?: boolean }).__MAP_STUDIO_SOFT_ERRORS__ === true;

const reportError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  window.dispatchEvent(new CustomEvent("map-studio-error", { detail: message }));
};

export const fetchJson = <T,>(file: string) =>
  loadOnce<T>(`json:${file}`, async () => {
    const res = await fetch(file.startsWith("http") ? file : staticFile(file));
    if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
    return (await res.json()) as T;
  });

export const loadImage = (src: string) =>
  loadOnce<HTMLImageElement>(`img:${src}`, () => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load image ${src}`));
      img.src = src.startsWith("http") || src.startsWith("data:") ? src : staticFile(src);
    });
  });

/**
 * Loads an async asset while holding the frame, so a render never captures a half-loaded map.
 * `key` must change whenever the loader would return something different.
 */
export function useAsset<T>(key: string | null, loader: () => Promise<T>, optional = false): T | null {
  const [value, setValue] = useState<T | null>(() => (key ? (peek<T>(key) ?? null) : null));
  const [loadedKey, setLoadedKey] = useState<string | null>(() => (key && peek(key) !== undefined ? key : null));
  // Hold the very first frame synchronously; later key changes (Studio edits) hold from the effect.
  const [firstHandle] = useState(() =>
    key && peek(key) === undefined
      ? { key, h: delayRender(`Loading ${key}`, { timeoutInMilliseconds: 120000 }), used: false }
      : null,
  );
  useEffect(() => {
    if (!key) {
      setValue(null);
      setLoadedKey(null);
      return;
    }
    const cached = peek<T>(key);
    if (cached !== undefined) {
      setValue(cached);
      setLoadedKey(key);
      if (firstHandle && firstHandle.key === key && !firstHandle.used) {
        firstHandle.used = true;
        continueRender(firstHandle.h);
      }
      return;
    }
    const reuse = firstHandle && firstHandle.key === key && !firstHandle.used;
    if (reuse) firstHandle.used = true;
    const handle = reuse ? firstHandle.h : delayRender(`Loading ${key}`, { timeoutInMilliseconds: 120000 });
    let alive = true;
    loadOnce(key, loader)
      .then((v) => {
        if (alive) {
          setValue(v);
          setLoadedKey(key);
        }
        continueRender(handle);
      })
      .catch((err) => {
        if (optional || softErrors()) {
          console.warn(err);
          pending.delete(key);
          if (!optional) reportError(err);
          continueRender(handle);
        } else {
          cancelRender(err);
        }
      });
    return () => {
      alive = false;
    };
    // The key fully describes the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return loadedKey === key ? value : null;
}

/* ---------------- world geometry ---------------- */

export type CountryProps = { name: string; long: string; en: string; iso: string; iso2: string; a3: string; continent: string; lx: number; ly: number; pop: number };
export type CountryFeature = Feature<Geometry, CountryProps>;
export type Lod = "lo" | "mid" | "hi";
export type WorldLayer = {
  countries: CountryFeature[];
  borders: MultiLineString;
  coast: MultiLineString;
};
export type World = Record<Lod, WorldLayer>;
export type BorderView = "india" | "world";

type CountryTopo = Topology<{ countries: GeometryCollection<CountryProps> }>;

function toLayer(t: CountryTopo): WorldLayer {
  const fc = feature(t, t.objects.countries) as FeatureCollection<Geometry, CountryProps>;
  return {
    countries: fc.features,
    borders: mesh(t, t.objects.countries, (a, b) => a !== b),
    coast: mesh(t, t.objects.countries, (a, b) => a === b),
  };
}

export const loadWorld = (view: BorderView) =>
  loadOnce<World>(`world:${view}`, async () => {
    const prefix = view === "india" ? "data/countries-ind" : "data/countries-world";
    const [lo, mid, hi] = await Promise.all(
      (["lo", "mid", "hi"] as const).map((l) => fetchJson<CountryTopo>(`${prefix}-${l}.json`)),
    );
    return { lo: toLayer(lo), mid: toLayer(mid), hi: toLayer(hi) };
  });

export const useWorld = (view: BorderView = "india") => useAsset(`world:${view}`, () => loadWorld(view));

export type StateProps = { name: string; a3: string; country: string; code: string };
export type StatesData = { features: Feature<Geometry, StateProps>[]; byCountry: Map<string, MultiLineString> };

export const loadStates = () =>
  loadOnce<StatesData>("states", async () => {
    const t = await fetchJson<Topology<{ states: GeometryCollection<StateProps> }>>("data/states.json");
    const fc = feature(t, t.objects.states) as FeatureCollection<Geometry, StateProps>;
    const byCountry = new Map<string, MultiLineString>();
    const a3s = new Set(fc.features.map((f) => f.properties.a3));
    for (const a3 of a3s) {
      byCountry.set(
        a3,
        mesh(t, t.objects.states, (a, b) => a !== b && (a.properties as StateProps).a3 === a3 && (b.properties as StateProps).a3 === a3),
      );
    }
    return { features: fc.features, byCountry };
  });

type LineTopo = Topology<{ [k: string]: GeometryCollection }>;
export type LineLayer = { all: MultiLineString; features: Feature<Geometry, Record<string, number | string>>[] };

export const loadLines = (name: "rivers" | "lakes" | "roads" | "rail") =>
  loadOnce<LineLayer>(`lines:${name}`, async () => {
    const t = await fetchJson<LineTopo>(`data/${name}.json`);
    const fc = feature(t, t.objects[name]) as FeatureCollection<Geometry, Record<string, number | string>>;
    const all: MultiLineString = { type: "MultiLineString", coordinates: [] };
    if (name !== "lakes") {
      for (const f of fc.features) {
        const g = f.geometry;
        if (g.type === "LineString") all.coordinates.push(g.coordinates);
        if (g.type === "MultiLineString") all.coordinates.push(...g.coordinates);
      }
    }
    return { all, features: fc.features };
  });

export const pickLod = (pixelsPerDegree: number): Lod => (pixelsPerDegree < 9 ? "lo" : pixelsPerDegree < 45 ? "mid" : "hi");
