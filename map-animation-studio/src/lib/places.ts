import { fetchJson, loadOnce } from "./data";

export type LonLat = [number, number];

export type Place = {
  name: string;
  lon: number;
  lat: number;
  region: string;
  country: string;
  a3: string;
  pop: number;
  kind: "city" | "landmark" | "coords";
  /** 2 = national capital, 1 = state/province capital. */
  capital?: number;
  /** Landmark model used by the 3D pop-up scenes. */
  model?: LandmarkModel;
};

export type LandmarkModel =
  | "tower"
  | "dome"
  | "arena"
  | "statue"
  | "clocktower"
  | "skyscraper"
  | "arch"
  | "pyramid"
  | "temple"
  | "mountain"
  | "bridge"
  | "wall";

// Surveyed coordinates of well-known landmarks (WGS84).
const LANDMARKS: [string, number, number, string, string, LandmarkModel][] = [
  ["Eiffel Tower", 48.8584, 2.2945, "Paris", "France", "tower"],
  ["Taj Mahal", 27.1751, 78.0421, "Agra", "India", "dome"],
  ["Colosseum", 41.8902, 12.4922, "Rome", "Italy", "arena"],
  ["Statue of Liberty", 40.6892, -74.0445, "New York", "United States of America", "statue"],
  ["Big Ben", 51.5007, -0.1246, "London", "United Kingdom", "clocktower"],
  ["Burj Khalifa", 25.1972, 55.2744, "Dubai", "United Arab Emirates", "skyscraper"],
  ["India Gate", 28.6129, 77.2295, "New Delhi", "India", "arch"],
  ["Gateway of India", 18.922, 72.8347, "Mumbai", "India", "arch"],
  ["Great Pyramid of Giza", 29.9792, 31.1342, "Giza", "Egypt", "pyramid"],
  ["Mount Everest", 27.9881, 86.925, "Khumbu", "Nepal", "mountain"],
  ["K2", 35.8825, 76.5133, "Gilgit-Baltistan", "Pakistan", "mountain"],
  ["Kangchenjunga", 27.7025, 88.1475, "Sikkim", "India", "mountain"],
  ["Nanda Devi", 30.3757, 79.9707, "Uttarakhand", "India", "mountain"],
  ["Mount Kailash", 31.0675, 81.3119, "Tibet", "China", "mountain"],
  ["Matterhorn", 45.9763, 7.6586, "Zermatt", "Switzerland", "mountain"],
  ["Mount Fuji", 35.3606, 138.7274, "Shizuoka", "Japan", "mountain"],
  ["Mount Kilimanjaro", -3.0674, 37.3556, "Kilimanjaro", "Tanzania", "mountain"],
  ["Grand Canyon", 36.1069, -112.1129, "Arizona", "United States of America", "mountain"],
  ["Sydney Opera House", -33.8568, 151.2153, "Sydney", "Australia", "dome"],
  ["Christ the Redeemer", -22.9519, -43.2105, "Rio de Janeiro", "Brazil", "statue"],
  ["Machu Picchu", -13.1631, -72.545, "Cusco", "Peru", "temple"],
  ["Golden Gate Bridge", 37.8199, -122.4783, "San Francisco", "United States of America", "bridge"],
  ["Kedarnath Temple", 30.7352, 79.0669, "Uttarakhand", "India", "temple"],
  ["Golden Temple", 31.62, 74.8765, "Amritsar", "India", "temple"],
  ["Red Fort", 28.6562, 77.241, "New Delhi", "India", "wall"],
  ["Qutub Minar", 28.5245, 77.1855, "New Delhi", "India", "tower"],
  ["Statue of Unity", 21.838, 73.7191, "Gujarat", "India", "statue"],
  ["Charminar", 17.3616, 78.4747, "Hyderabad", "India", "arch"],
  ["Hawa Mahal", 26.9239, 75.8267, "Jaipur", "India", "temple"],
  ["Victoria Memorial", 22.5448, 88.3426, "Kolkata", "India", "dome"],
  ["Konark Sun Temple", 19.8876, 86.0945, "Odisha", "India", "temple"],
  ["Meenakshi Temple", 9.9195, 78.1193, "Madurai", "India", "temple"],
  ["Great Wall of China", 40.3588, 116.02, "Badaling", "China", "wall"],
  ["Petra", 30.3285, 35.4444, "Ma'an", "Jordan", "temple"],
  ["Angkor Wat", 13.4125, 103.867, "Siem Reap", "Cambodia", "temple"],
  ["Leaning Tower of Pisa", 43.723, 10.3966, "Pisa", "Italy", "tower"],
  ["Sagrada Familia", 41.4036, 2.1744, "Barcelona", "Spain", "temple"],
  ["Kremlin", 55.752, 37.6175, "Moscow", "Russia", "wall"],
  ["Forbidden City", 39.9163, 116.3972, "Beijing", "China", "temple"],
  ["Kaaba", 21.4225, 39.8262, "Mecca", "Saudi Arabia", "temple"],
  ["Empire State Building", 40.7484, -73.9857, "New York", "United States of America", "skyscraper"],
  ["Tower Bridge", 51.5055, -0.0754, "London", "United Kingdom", "bridge"],
  ["Brandenburg Gate", 52.5163, 13.3777, "Berlin", "Germany", "arch"],
  ["Arc de Triomphe", 48.8738, 2.295, "Paris", "France", "arch"],
  ["Burj Al Arab", 25.1412, 55.1853, "Dubai", "United Arab Emirates", "skyscraper"],
  ["Petronas Towers", 3.1579, 101.7116, "Kuala Lumpur", "Malaysia", "skyscraper"],
  ["Marina Bay Sands", 1.2834, 103.8607, "Singapore", "Singapore", "skyscraper"],
  ["Ram Mandir", 26.7956, 82.1943, "Ayodhya", "India", "temple"],
  ["Lotus Temple", 28.5535, 77.2588, "New Delhi", "India", "dome"],
  ["Golconda Fort", 17.3833, 78.4011, "Hyderabad", "India", "wall"],
];

// Common modern names that Natural Earth stores under a different spelling.
const ALIASES: Record<string, string> = {
  bangalore: "bengaluru",
  gurugram: "gurgaon",
  prayagraj: "allahabad",
  bombay: "mumbai",
  calcutta: "kolkata",
  madras: "chennai",
  visakhapatnam: "vishakhapatnam",
  vizag: "vishakhapatnam",
  trivandrum: "thiruvananthapuram",
  cochin: "kochi",
  mysore: "mysuru",
  kashi: "varanasi",
  banaras: "varanasi",
  "new york city": "new york",
  nyc: "new york",
  peking: "beijing",
  "saint petersburg": "st. petersburg",
  "st petersburg": "st. petersburg",
  saigon: "ho chi minh city",
  "ho chi minh": "ho chi minh city",
  kyiv: "kiev",
  odesa: "odessa",
};

// Well-known Indian towns that are below Natural Earth's population cut-off.
const EXTRA_TOWNS: [string, number, number, string][] = [
  ["Thane", 19.2183, 72.9781, "Maharashtra"],
  ["Navi Mumbai", 19.033, 73.0297, "Maharashtra"],
  ["Lonavala", 18.7546, 73.4062, "Maharashtra"],
  ["Mahabaleshwar", 17.9237, 73.6586, "Maharashtra"],
  ["Shirdi", 19.7645, 74.4769, "Maharashtra"],
  ["Ajanta Caves", 20.5519, 75.7033, "Maharashtra"],
  ["Ellora Caves", 20.0268, 75.1771, "Maharashtra"],
  ["Shimla", 31.1048, 77.1734, "Himachal Pradesh"],
  ["Manali", 32.2432, 77.1892, "Himachal Pradesh"],
  ["Ayodhya", 26.7922, 82.1998, "Uttar Pradesh"],
  ["Mathura", 27.4924, 77.6737, "Uttar Pradesh"],
  ["Vrindavan", 27.565, 77.6593, "Uttar Pradesh"],
  ["Noida", 28.5355, 77.391, "Uttar Pradesh"],
  ["Darjeeling", 27.041, 88.2663, "West Bengal"],
  ["Rishikesh", 30.0869, 78.2676, "Uttarakhand"],
  ["Haridwar", 29.9457, 78.1642, "Uttarakhand"],
  ["Mussoorie", 30.4598, 78.0644, "Uttarakhand"],
  ["Nainital", 29.3803, 79.4636, "Uttarakhand"],
  ["Kedarnath", 30.7346, 79.0669, "Uttarakhand"],
  ["Badrinath", 30.7433, 79.4938, "Uttarakhand"],
  ["Ooty", 11.4102, 76.695, "Tamil Nadu"],
  ["Kanyakumari", 8.0883, 77.5385, "Tamil Nadu"],
  ["Rameswaram", 9.2876, 79.3129, "Tamil Nadu"],
  ["Munnar", 10.0889, 77.0595, "Kerala"],
  ["Panaji", 15.4909, 73.8278, "Goa"],
  ["Puri", 19.8135, 85.8312, "Odisha"],
  ["Bodh Gaya", 24.6961, 84.9869, "Bihar"],
  ["Kargil", 34.5539, 76.1349, "Ladakh"],
  ["Tawang", 27.5861, 91.8594, "Arunachal Pradesh"],
  ["Pahalgam", 34.0161, 75.315, "Jammu and Kashmir"],
  ["Gulmarg", 34.0484, 74.3805, "Jammu and Kashmir"],
  ["Somnath", 20.888, 70.4012, "Gujarat"],
  ["Dwarka", 22.2394, 68.9678, "Gujarat"],
  ["Tirupati", 13.6288, 79.4192, "Andhra Pradesh"],
  ["Hampi", 15.335, 76.46, "Karnataka"],
  ["Khajuraho", 24.8318, 79.9199, "Madhya Pradesh"],
  ["Jaisalmer", 26.9157, 70.9083, "Rajasthan"],
  ["Pushkar", 26.4897, 74.5511, "Rajasthan"],
  ["Mount Abu", 24.5926, 72.7156, "Rajasthan"],
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

type PlacesFile = { fields: string[]; rows: [string, string, string, string, string, number, number, number, number, number][] };

export type Gazetteer = { find: (q: string) => Place | null; all: Place[] };

export const loadGazetteer = () =>
  loadOnce<Gazetteer>("gazetteer", async () => {
    const data = await fetchJson<PlacesFile>("data/places.json");
    const cities: Place[] = data.rows.map((r) => ({
      name: r[0],
      lat: r[5],
      lon: r[6],
      region: r[2],
      country: r[3],
      a3: r[4],
      pop: r[7],
      kind: "city" as const,
      capital: r[8],
    }));
    const landmarks: Place[] = LANDMARKS.map(([name, lat, lon, region, country, model]) => ({
      name,
      lat,
      lon,
      region,
      country,
      a3: "",
      pop: 0,
      kind: "landmark" as const,
      model,
    }));
    const byName = new Map<string, Place[]>();
    const add = (k: string, p: Place) => {
      const key = norm(k);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(p);
    };
    for (const p of landmarks) add(p.name, p);
    data.rows.forEach((r, i) => {
      add(r[0], cities[i]);
      if (r[1] && norm(r[1]) !== norm(r[0])) add(r[1], cities[i]);
    });
    for (const [name, lat, lon, region] of EXTRA_TOWNS) {
      if (byName.has(norm(name))) continue;
      const p: Place = { name, lat, lon, region, country: "India", a3: "IND", pop: 0, kind: "city" };
      cities.push(p);
      add(name, p);
    }
    const all = [...landmarks, ...cities];

    const find = (q: string): Place | null => {
      const coords = parseCoords(q);
      if (coords) return { name: q, lon: coords[0], lat: coords[1], region: "", country: "", a3: "", pop: 0, kind: "coords" };
      const [rawName, ...qualifiers] = q.split(",").map(norm);
      const name = ALIASES[rawName] ?? rawName;
      const qual = qualifiers.join(" ");
      const matches = (p: Place) =>
        !qual || norm(p.country).includes(qual) || norm(p.region).includes(qual) || norm(p.a3) === qual;
      const exact = (byName.get(name) ?? []).filter(matches);
      if (exact.length) return exact.sort((a, b) => b.pop - a.pop)[0];
      const loose = all.filter((p) => norm(p.name).startsWith(name) && matches(p));
      return loose.length ? loose.sort((a, b) => b.pop - a.pop)[0] : null;
    };
    return { find, all };
  });

/** "19.076, 72.877" (lat, lon) or "19.076N 72.877E". Returns [lon, lat]. */
export function parseCoords(q: string): LonLat | null {
  const m = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lon = parseFloat(m[3]);
  if (m[2] && m[2].toUpperCase() === "S") lat = -lat;
  if (m[4] && m[4].toUpperCase() === "W") lon = -lon;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

export function resolveOrThrow(g: Gazetteer, q: string): Place {
  const p = g.find(q);
  if (!p) throw new Error(`Place not found: "${q}". Use a city name, "City, Country", or coordinates like "19.07, 72.87".`);
  return p;
}

export const formatLatLon = (lat: number, lon: number, digits = 4) =>
  `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? "E" : "W"}`;

export function formatDms(lat: number, lon: number) {
  const f = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = ((a - d) * 60 - m) * 60;
    return `${d}°${String(m).padStart(2, "0")}′${s.toFixed(1).padStart(4, "0")}″${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, "N", "S")}  ${f(lon, "E", "W")}`;
}

/** "Capital of France", "Maharashtra, India", etc. */
export function placeSubtitle(p: Place) {
  if (p.capital === 2) return `Capital of ${p.country}`;
  if (p.kind === "landmark") return [p.region, p.country].filter(Boolean).join(", ");
  return [p.region, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
}
