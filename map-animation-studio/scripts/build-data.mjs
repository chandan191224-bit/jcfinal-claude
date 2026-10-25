// Downloads the free source data (Natural Earth + NASA imagery) and builds the compact
// files the studio reads from public/data. Run with: npm run build-data
// Already-built files are committed, so you only need this to refresh or rebuild them.
import fs from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { quantize } from "topojson-client";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".data-cache");
const out = path.join(root, "public", "data");
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(out, { recursive: true });

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const TEX = "https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img";

const sources = {
  countriesInd: `${NE}/ne_10m_admin_0_countries_ind.geojson`,
  countriesWorld: `${NE}/ne_10m_admin_0_countries.geojson`,
  states: `${NE}/ne_10m_admin_1_states_provinces.geojson`,
  places: `${NE}/ne_10m_populated_places_simple.geojson`,
  rivers: `${NE}/ne_10m_rivers_lake_centerlines.geojson`,
  lakes: `${NE}/ne_10m_lakes.geojson`,
  roads: `${NE}/ne_10m_roads.geojson`,
  rail: `${NE}/ne_10m_railroads.geojson`,
};
const textures = ["earth-blue-marble.jpg", "earth-night.jpg", "earth-topology.png", "earth-dark.jpg"];

async function download(url, file) {
  if (fs.existsSync(file)) return;
  console.log("downloading", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const readGeo = (key) => JSON.parse(fs.readFileSync(path.join(cache, `${key}.geojson`), "utf8"));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function write(name, data) {
  const file = path.join(out, name);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(name.padEnd(28), (fs.statSync(file).size / 1024).toFixed(0).padStart(6), "KB");
}

// Topology with simplification. `keep` is the fraction of points kept (by visual weight).
function topo(features, objectName, keep, quant = 1e5) {
  let t = topology({ [objectName]: { type: "FeatureCollection", features } });
  if (keep < 1) {
    t = presimplify(t);
    t = simplify(t, quantile(t, keep));
  }
  return quantize(t, quant);
}

function countries(key, prefix) {
  const fc = readGeo(key);
  const feats = fc.features.map((f) => {
    const p = f.properties;
    const iso = p.ISO_A3_EH !== "-99" ? p.ISO_A3_EH : p.ADM0_A3;
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: {
        name: p.NAME,
        long: p.NAME_LONG,
        en: p.NAME_EN,
        iso,
        a3: p.ADM0_A3,
        continent: p.CONTINENT,
        lx: round(p.LABEL_X, 3),
        ly: round(p.LABEL_Y, 3),
        pop: p.POP_EST,
      },
    };
  });
  write(`${prefix}-hi.json`, topo(feats, "countries", 0.45));
  write(`${prefix}-mid.json`, topo(feats, "countries", 0.12, 5e4));
  write(`${prefix}-lo.json`, topo(feats, "countries", 0.025, 2e4));
}

function states() {
  const fc = readGeo("states");
  const feats = fc.features.map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: {
      name: f.properties.name_en || f.properties.name,
      a3: f.properties.adm0_a3,
      country: f.properties.admin,
      code: f.properties.iso_3166_2,
    },
  }));
  write("states.json", topo(feats, "states", 0.45, 2e5));
}

function places() {
  const fc = readGeo("places");
  const rows = fc.features
    .map((f) => {
      const p = f.properties;
      const cap = p.adm0cap ? 2 : /Admin-1 capital/i.test(p.featurecla) ? 1 : 0;
      return [p.name, p.nameascii, p.adm1name || "", p.adm0name, p.adm0_a3, round(p.latitude, 4), round(p.longitude, 4), p.pop_max, cap, p.scalerank];
    })
    .sort((a, b) => b[7] - a[7]);
  write("places.json", {
    fields: ["name", "ascii", "region", "country", "a3", "lat", "lon", "pop", "capital", "rank"],
    rows,
  });
}

function lines(key, name, objectName, keepProps, keep, filter = () => true, quant = 2e5) {
  const fc = readGeo(key);
  const feats = fc.features.filter((f) => f.geometry && filter(f.properties)).map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: keepProps(f.properties),
  }));
  write(name, topo(feats, objectName, keep, quant));
}

for (const [key, url] of Object.entries(sources)) await download(url, path.join(cache, `${key}.geojson`));
for (const t of textures) {
  await download(`${TEX}/${t}`, path.join(cache, t));
  fs.mkdirSync(path.join(root, "public", "textures"), { recursive: true });
  fs.copyFileSync(path.join(cache, t), path.join(root, "public", "textures", t));
}

countries("countriesInd", "countries-ind");
countries("countriesWorld", "countries-world");
states();
places();
lines("rivers", "rivers.json", "rivers", (p) => ({ name: p.name_en || p.name, rank: p.scalerank }), 0.35);
lines("lakes", "lakes.json", "lakes", (p) => ({ name: p.name_en || p.name, rank: p.scalerank }), 0.3);
lines(
  "roads",
  "roads.json",
  "roads",
  (p) => ({ t: p.expressway ? 2 : /Major/i.test(p.type) ? 1 : 0 }),
  0.4,
  (p) => !/Ferry/i.test(p.featurecla),
);
lines("rail", "rail.json", "rail", () => ({}), 0.4);
console.log("done");
