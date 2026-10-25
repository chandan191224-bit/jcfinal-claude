/*
 * Files the animation engine asks for with staticFile("data/…"), staticFile("flags/…"),
 * staticFile("media/…"), resolved to in-memory blob URLs.
 *
 * - The single-file build ("Map Animation Studio.html") carries all map data, textures, flags,
 *   sounds and cached terrain inside the page, gzipped. They are unpacked once at start-up.
 * - Your own photos, videos and audio live in the browser's IndexedDB, so they survive a
 *   restart without any server.
 * When nothing is registered (development server), staticFile falls back to normal URLs.
 */

const urls = new Map<string, string>();

type StaticEntry = { name: string; src: string; sizeInBytes: number; lastModified: number };
const sizes = new Map<string, number>();
/** Remotion's staticFile() returns the `src` of a matching entry in window.remotion_staticFiles. */
const sync = () => {
  (window as unknown as { remotion_staticFiles: StaticEntry[] }).remotion_staticFiles = [...urls].map(([name, src]) => ({ name, src, sizeInBytes: sizes.get(name) ?? 0, lastModified: 0 }));
};

const norm = (p: string) => p.replace(/^\/+/, "").replace(/^public\//, "");

export const assetNames = (prefix = "") => [...urls.keys()].filter((k) => k.startsWith(prefix));

export const assetUrl = (p: string): string | undefined => urls.get(norm(p)) ?? urls.get(decodeURIComponent(norm(p)));

export const registerAsset = (path: string, blob: Blob) => {
  const k = norm(path);
  const old = urls.get(k);
  if (old) URL.revokeObjectURL(old);
  urls.set(k, URL.createObjectURL(blob));
  sizes.set(k, blob.size);
  if (!batching) sync();
};

let batching = false;

export const unregisterAsset = (path: string) => {
  const k = norm(path);
  const old = urls.get(k);
  if (old) URL.revokeObjectURL(old);
  urls.delete(k);
  sync();
};

const MIME: Record<string, string> = {
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  txt: "text/plain",
};
export const mimeOf = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** True when this page is the single-file build. */
export const isStandalone = () => Boolean(document.getElementById("map-assets"));

/** Unpacks the data embedded in the single-file build. Archive: [u32 header length][JSON index][bytes]. */
export async function loadEmbeddedAssets(onProgress?: (msg: string) => void) {
  const el = document.getElementById("map-assets");
  if (!el) return 0;
  onProgress?.("Unpacking map data…");
  const b64 = (el.textContent ?? "").trim();
  const packed = await (await fetch(`data:application/octet-stream;base64,${b64}`)).blob();
  el.textContent = ""; // free the text copy
  const raw = await new Response(packed.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  const view = new DataView(raw);
  const headerLen = view.getUint32(0, true);
  const index = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 4, headerLen))) as { p: string; o: number; s: number }[];
  const base = 4 + headerLen;
  batching = true;
  for (const f of index) registerAsset(f.p, new Blob([new Uint8Array(raw, base + f.o, f.s)], { type: mimeOf(f.p) }));
  batching = false;
  sync();
  return index.length;
}

/* ---------------- IndexedDB: your media and projects ---------------- */

const DB = "map-animation-studio";
let dbp: Promise<IDBDatabase> | null = null;
const db = () =>
  (dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("media", { keyPath: "name" });
      r.result.createObjectStore("projects", { keyPath: "file" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));

const tx = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export type MediaItem = { path: string; name: string; size: number; kind: "image" | "video" | "audio" | "data"; mtime: number };
type MediaRow = { name: string; type: string; blob: Blob; mtime: number };

export const kindOf = (path: string): MediaItem["kind"] =>
  /\.(mp4|webm|mov|m4v|mkv)$/i.test(path) ? "video" : /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(path) ? "image" : /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(path) ? "audio" : "data";

const toItem = (r: MediaRow): MediaItem => ({ path: `media/${r.name}`, name: r.name, size: r.blob.size, kind: kindOf(r.name), mtime: r.mtime });

const safeName = (n: string) =>
  n
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "file";

export const media = {
  /** Registers every stored file so the engine can play it. Call once at start-up. */
  async restore() {
    const rows = await tx<MediaRow[]>("media", "readonly", (s) => s.getAll() as IDBRequest<MediaRow[]>);
    batching = true;
    for (const r of rows) registerAsset(`media/${r.name}`, r.blob);
    batching = false;
    sync();
    return rows.length;
  },
  async list(): Promise<MediaItem[]> {
    const rows = await tx<MediaRow[]>("media", "readonly", (s) => s.getAll() as IDBRequest<MediaRow[]>);
    return rows.map(toItem).sort((a, b) => b.mtime - a.mtime);
  },
  async add(file: File): Promise<MediaItem> {
    const existing = new Set((await media.list()).map((m) => m.name));
    let name = safeName(file.name);
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let i = 2; existing.has(name); i++) name = `${stem}-${i}${ext}`;
    const row: MediaRow = { name, type: file.type || mimeOf(name), blob: file, mtime: Date.now() };
    await tx("media", "readwrite", (s) => s.put(row));
    registerAsset(`media/${name}`, file);
    return toItem(row);
  },
  async remove(path: string) {
    const name = path.replace(/^media\//, "");
    await tx("media", "readwrite", (s) => s.delete(name));
    unregisterAsset(path);
  },
};

export type ProjectInfo = { file: string; name: string; mtime: number };
type ProjectRow = ProjectInfo & { data: unknown };

export const projects = {
  async list(): Promise<ProjectInfo[]> {
    const rows = await tx<ProjectRow[]>("projects", "readonly", (s) => s.getAll() as IDBRequest<ProjectRow[]>);
    return rows.map(({ file, name, mtime }) => ({ file, name, mtime })).sort((a, b) => b.mtime - a.mtime);
  },
  async save(file: string, name: string, data: unknown): Promise<ProjectInfo> {
    const row: ProjectRow = { file, name, mtime: Date.now(), data };
    await tx("projects", "readwrite", (s) => s.put(row));
    return { file, name, mtime: row.mtime };
  },
  async load(file: string) {
    const row = await tx<ProjectRow | undefined>("projects", "readonly", (s) => s.get(file) as IDBRequest<ProjectRow | undefined>);
    if (!row) throw new Error("Project not found");
    return row.data;
  },
  async remove(file: string) {
    await tx("projects", "readwrite", (s) => s.delete(file));
  },
};
