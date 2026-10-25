// Saves real elevation tiles for an area into public/terrain so 3D terrain renders offline.
//   npm run cache-terrain -- "27.9881, 86.925" 14     (lat, lon and radius in km)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [coords, radiusArg = "15"] = process.argv.slice(2);
if (!coords) {
  console.error('Usage: npm run cache-terrain -- "lat, lon" radiusKm');
  process.exit(1);
}
const [lat, lon] = coords.split(",").map(Number);
const radiusKm = Number(radiusArg);
const lon2x = (lo, z) => ((lo + 180) / 360) * 2 ** z;
const lat2y = (la, z) => {
  const r = (la * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
// Same zoom choice as src/lib/terrain.ts (at most 4 tiles across).
let z = 3;
for (let zz = 14; zz >= 3; zz--) {
  const tileKm = (40075 * Math.cos((lat * Math.PI) / 180)) / 2 ** zz;
  if (Math.ceil((2 * radiusKm) / tileKm) + 1 <= 4) {
    z = zz;
    break;
  }
}
const dLat = radiusKm / 111.32;
const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
const x0 = Math.floor(lon2x(lon - dLon, z));
const x1 = Math.floor(lon2x(lon + dLon, z));
const y0 = Math.floor(lat2y(lat + dLat, z));
const y1 = Math.floor(lat2y(lat - dLat, z));
const dir = path.join(root, "public", "terrain");
const indexFile = path.join(dir, "index.json");
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { tiles: [] };
for (let y = y0; y <= y1; y++)
  for (let x = x0; x <= x1; x++) {
    const key = `${z}/${x}/${y}`;
    const file = path.join(dir, `${key}.png`);
    if (!fs.existsSync(file)) {
      const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`);
      if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log("saved", key);
    }
    if (!index.tiles.includes(key)) index.tiles.push(key);
  }
fs.writeFileSync(indexFile, JSON.stringify(index));
console.log(`done: ${index.tiles.length} tiles cached`);
