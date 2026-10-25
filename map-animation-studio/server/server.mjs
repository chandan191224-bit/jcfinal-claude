#!/usr/bin/env node
// Map Animation Studio: local server for the editor app.
// Serves the app, saves projects and media into this folder, and renders MP4s with Remotion.
//   node server/server.mjs          (or double-click "Start Map Studio.bat" on Windows)
// Options: --port=7272  --no-open  --built (serve the prebuilt app from `npm run build-app`)

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const MEDIA = path.join(PUBLIC, "media");
const PROJECTS = path.join(ROOT, "projects");
const OUT = path.join(ROOT, "out");
const DIST = path.join(ROOT, "app-dist");
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const PORT = Number(args.port ?? process.env.PORT ?? 7272);
const OPEN = !args["no-open"] && !process.env.NO_OPEN;
// Live mode compiles the app on the fly (always up to date). `--built` serves app-dist from `npm run build-app` instead.
const DEV = !args.built || !fs.existsSync(path.join(DIST, "index.html"));

for (const d of [MEDIA, PROJECTS, OUT]) fs.mkdirSync(d, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json",
  ".gpx": "application/gpx+xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/* ---------------- helpers ---------------- */

const send = (res, code, body, type = "application/json; charset=utf-8") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, code, error) => send(res, code, { error });

const readBody = (req, limit = 50e6) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const safeName = (name) =>
  path
    .basename(String(name || "file"))
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";

/** Resolves `rel` inside `base`, refusing anything that escapes it. */
const inside = (base, rel) => {
  const p = path.resolve(base, rel);
  return p === base || p.startsWith(base + path.sep) ? p : null;
};

const kindOf = (f) =>
  /\.(mp4|webm|mov|m4v|mkv)$/i.test(f) ? "video" : /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f) ? "image" : /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f) ? "audio" : "data";

async function serveFile(req, res, file) {
  let st;
  try {
    st = await fsp.stat(file);
    if (!st.isFile()) throw new Error("not a file");
  } catch {
    return false;
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { "content-range": `bytes */${st.size}` });
      res.end();
      return true;
    }
    res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes" });
    fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { "content-type": type, "content-length": st.size, "accept-ranges": "bytes", "cache-control": file.startsWith(DIST) ? "no-cache" : "max-age=60" });
  if (req.method === "HEAD") res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}

const openInBrowser = (url) => {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
};

const reveal = (target, isFile) => {
  if (process.platform === "win32") spawn("explorer", isFile ? [`/select,${target}`] : [target], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", isFile ? ["-R", target] : [target], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [isFile ? path.dirname(target) : target], { detached: true, stdio: "ignore" }).unref();
};

/* ---------------- rendering ---------------- */

const jobs = new Map();
let activeDownload = null; // the job waiting for the render browser download
let bundling = null; // Promise<string> (serve URL / bundle dir)
let renderChain = Promise.resolve();

const syncDir = async (from, to) => {
  // Media added after the renderer was prepared still has to reach it.
  await fsp.mkdir(to, { recursive: true });
  for (const e of await fsp.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) await syncDir(a, b);
    else {
      const sa = await fsp.stat(a);
      const sb = await fsp.stat(b).catch(() => null);
      if (!sb || sb.size !== sa.size || sb.mtimeMs < sa.mtimeMs) await fsp.copyFile(a, b);
    }
  }
};

async function getBundle(job) {
  if (!bundling) {
    bundling = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({
        entryPoint: path.join(ROOT, "src", "index.ts"),
        publicDir: PUBLIC,
        rspack: process.env.MAP_STUDIO_WEBPACK ? false : true,
        enableCaching: true,
        onProgress: (p) => {
          for (const j of jobs.values()) if (j.status === "bundling") j.progress = (p / 100) * 0.05;
        },
      });
    })().catch((e) => {
      bundling = null;
      throw e;
    });
  }
  job.status = "bundling";
  const dir = await bundling;
  for (const sub of ["media", "areas", "projects", "terrain"]) {
    const from = path.join(PUBLIC, sub);
    if (fs.existsSync(from)) await syncDir(from, path.join(dir, "public", sub));
  }
  return dir;
}

const QUALITY = {
  max: { codec: "h264", ext: "mp4", crf: 12, x264Preset: "slow", pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "png", audioBitrate: "320k" },
  draft: { codec: "h264", ext: "mp4", crf: 22, x264Preset: "veryfast", pixelFormat: "yuv420p", colorSpace: "bt709", imageFormat: "jpeg", jpegQuality: 90, audioBitrate: "192k" },
  prores: { codec: "prores", ext: "mov", proResProfile: "4444", imageFormat: "png", audioCodec: "pcm-16" },
};

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const glFor = () => process.env.MAP_STUDIO_GL || (process.platform === "linux" ? "swangle" : "angle");

async function runRender(job) {
  const R = await import("@remotion/renderer");
  const serveUrl = await getBundle(job);
  if (job.cancelled) throw new Error("cancelled");
  job.status = "browser";
  const browserExecutable = process.env.MAP_STUDIO_BROWSER || null;
  activeDownload = job;
  try {
    await R.ensureBrowser({
      browserExecutable,
      onBrowserDownload: () => ({
        version: null,
        onProgress: ({ percent }) => {
          job.stage = `Downloading the render browser ${Math.round((percent > 1 ? percent / 100 : percent) * 100)}%`;
        },
      }),
    });
  } finally {
    activeDownload = null;
  }
  const q = QUALITY[job.quality] ?? QUALITY.max;
  let gl = glFor();
  const chromiumOptions = () => ({ gl, ignoreCertificateErrors: Boolean(process.env.MAP_STUDIO_IGNORE_CERT) });
  const attempt = async () => {
    const composition = await R.selectComposition({ serveUrl, id: "MapComposer", inputProps: job.props, chromiumOptions: chromiumOptions(), browserExecutable, timeoutInMilliseconds: 120000 });
    job.totalFrames = composition.durationInFrames;
    job.status = "rendering";
    job.stage = "Rendering frames…";
    const { cancelSignal, cancel } = R.makeCancelSignal();
    job.cancel = cancel;
    await R.renderMedia({
      composition,
      serveUrl,
      inputProps: job.props,
      outputLocation: job.output,
      codec: q.codec,
      crf: q.crf ?? null,
      x264Preset: q.x264Preset ?? null,
      pixelFormat: q.pixelFormat,
      colorSpace: q.colorSpace,
      imageFormat: q.imageFormat,
      jpegQuality: q.jpegQuality,
      proResProfile: q.proResProfile,
      audioBitrate: q.audioBitrate ?? null,
      audioCodec: q.audioCodec ?? null,
      chromiumOptions: chromiumOptions(),
      browserExecutable,
      timeoutInMilliseconds: 120000,
      overwrite: true,
      cancelSignal,
      onProgress: ({ progress, renderedFrames, encodedFrames, stitchStage }) => {
        job.progress = 0.05 + progress * 0.95;
        job.renderedFrames = renderedFrames;
        job.encodedFrames = encodedFrames;
        job.stage = stitchStage === "muxing" ? "Adding audio…" : renderedFrames >= job.totalFrames ? "Encoding…" : "Rendering frames…";
      },
    });
  };
  try {
    await attempt();
  } catch (e) {
    // Some Windows GPUs refuse ANGLE in headless mode; software WebGL always works.
    if (!job.cancelled && /webgl|gpu|gl context/i.test(String(e?.message)) && gl !== "swangle") {
      console.log(`  WebGL failed with --gl=${gl}, retrying with swangle`);
      gl = "swangle";
      await attempt();
    } else throw e;
  }
}

function startRender({ name, props, quality }) {
  const id = Math.random().toString(36).slice(2, 10);
  const q = QUALITY[quality] ? quality : "max";
  const file = `${safeName(String(name || "map").toLowerCase()).slice(0, 60)}-${stamp()}.${QUALITY[q].ext}`;
  const job = {
    id,
    status: "queued",
    progress: 0,
    stage: "",
    renderedFrames: 0,
    encodedFrames: 0,
    totalFrames: 0,
    output: path.join(OUT, file),
    url: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    quality: q,
    props,
    cancelled: false,
    cancel: null,
  };
  jobs.set(id, job);
  console.log(`▶ Export ${file} (${q})`);
  const run = async () => {
    if (job.cancelled) return;
    job.startedAt = Date.now();
    try {
      await runRender(job);
      if (job.status === "error") return; // failed from the safety net meanwhile
      job.status = "done";
      job.progress = 1;
      job.url = `/out/${encodeURIComponent(file)}`;
      console.log(`✔ Saved ${job.output} in ${((Date.now() - job.startedAt) / 1000).toFixed(0)} s`);
    } catch (e) {
      if (job.cancelled) {
        job.status = "cancelled";
        await fsp.rm(job.output, { force: true });
      } else {
        job.status = "error";
        job.error = explain(e);
        console.error(`✖ Export failed: ${e?.message}`);
      }
    }
    job.finishedAt = Date.now();
  };
  // `settle` lets the safety net release the queue if a job hangs after a crash in a library.
  renderChain = renderChain.then(() => new Promise((resolve) => {
    job.settle = resolve;
    run().finally(resolve);
  }));
  return job;
}

const explain = (e) => {
  const m = String(e?.message || e);
  if (/remotion\.media|chrome-headless|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN/.test(m) && /download|getaddrinfo|remotion\.media|ECONN|ETIMEDOUT/i.test(m))
    return `Could not download the render browser (${m}).\nCheck the internet connection and export again; it is downloaded only once (about 100 MB).`;
  return String(e?.stack || m).split("\n").slice(0, 12).join("\n");
};

const publicJob = (j) => ({
  id: j.id,
  status: j.status,
  progress: j.progress,
  stage: j.stage,
  renderedFrames: j.renderedFrames,
  encodedFrames: j.encodedFrames,
  totalFrames: j.totalFrames,
  output: j.output,
  url: j.url,
  error: j.error,
  startedAt: j.startedAt,
  finishedAt: j.finishedAt,
});

/* ---------------- API ---------------- */

async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (p === "/api/health") return send(res, 200, { ok: true, version: PKG.version, platform: process.platform });

  if (p === "/api/media" && m === "GET") {
    const files = (await fsp.readdir(MEDIA, { withFileTypes: true })).filter((e) => e.isFile() && !e.name.startsWith("."));
    const list = await Promise.all(
      files.map(async (e) => {
        const st = await fsp.stat(path.join(MEDIA, e.name));
        return { path: `media/${e.name}`, name: e.name, size: st.size, kind: kindOf(e.name), mtime: st.mtimeMs };
      }),
    );
    return send(res, 200, list.sort((a, b) => b.mtime - a.mtime));
  }
  if (p === "/api/media" && m === "POST") {
    let name = safeName(url.searchParams.get("name"));
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    for (let i = 2; fs.existsSync(path.join(MEDIA, name)); i++) name = `${stem}-${i}${ext}`;
    const dest = path.join(MEDIA, name);
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(dest);
      req.pipe(ws);
      ws.on("finish", resolve);
      ws.on("error", reject);
      req.on("error", reject);
    });
    const st = await fsp.stat(dest);
    console.log(`  + media/${name} (${(st.size / 1e6).toFixed(1)} MB)`);
    return send(res, 200, { path: `media/${name}`, name, size: st.size, kind: kindOf(name), mtime: st.mtimeMs });
  }
  if (p === "/api/media" && m === "DELETE") {
    const f = inside(PUBLIC, String(url.searchParams.get("path") || ""));
    if (!f || !f.startsWith(MEDIA + path.sep)) return fail(res, 400, "Only files in public/media can be deleted");
    await fsp.rm(f, { force: true });
    return send(res, 200, { ok: true });
  }

  if (p === "/api/flags") {
    const codes = (await fsp.readdir(path.join(PUBLIC, "flags"))).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
    return send(res, 200, codes);
  }

  if (p === "/api/projects" && m === "GET") {
    const files = (await fsp.readdir(PROJECTS)).filter((f) => f.endsWith(".json"));
    const list = await Promise.all(
      files.map(async (f) => {
        const full = path.join(PROJECTS, f);
        const st = await fsp.stat(full);
        let name = f.replace(/\.json$/, "");
        try {
          name = JSON.parse(await fsp.readFile(full, "utf8")).name || name;
        } catch {
          // unreadable: list it by file name
        }
        return { file: f, name, mtime: st.mtimeMs };
      }),
    );
    return send(res, 200, list.sort((a, b) => b.mtime - a.mtime));
  }
  const pm = /^\/api\/projects\/(.+)$/.exec(p);
  if (pm) {
    const file = safeName(decodeURIComponent(pm[1]));
    const full = path.join(PROJECTS, file.endsWith(".json") ? file : `${file}.json`);
    if (m === "GET") return (await serveFile(req, res, full)) ? undefined : fail(res, 404, "Project not found");
    if (m === "PUT") {
      const body = await readBody(req);
      JSON.parse(body.toString("utf8"));
      const tmp = `${full}.tmp`;
      await fsp.writeFile(tmp, body);
      await fsp.rename(tmp, full);
      return send(res, 200, { file: path.basename(full), name: JSON.parse(body.toString("utf8")).name ?? file, mtime: Date.now() });
    }
    if (m === "DELETE") {
      await fsp.rm(full, { force: true });
      return send(res, 200, { ok: true });
    }
  }

  if (p === "/api/render" && m === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8"));
    if (!body?.props || typeof body.props !== "object") return fail(res, 400, "Missing props");
    return send(res, 200, publicJob(startRender(body)));
  }
  const rm = /^\/api\/render\/([a-z0-9]+)(\/cancel)?$/.exec(p);
  if (rm) {
    const job = jobs.get(rm[1]);
    if (!job) return fail(res, 404, "No such export");
    if (rm[2] && m === "POST") {
      job.cancelled = true;
      job.cancel?.();
      if (job.status === "queued") job.status = "cancelled";
    }
    return send(res, 200, publicJob(job));
  }
  if (p === "/api/outputs") {
    const files = (await fsp.readdir(OUT)).filter((f) => /\.(mp4|mov|webm)$/i.test(f));
    const list = await Promise.all(
      files.map(async (f) => {
        const st = await fsp.stat(path.join(OUT, f));
        return { name: f, url: `/out/${encodeURIComponent(f)}`, size: st.size, mtime: st.mtimeMs };
      }),
    );
    return send(res, 200, list.sort((a, b) => b.mtime - a.mtime));
  }
  if (p === "/api/reveal" && m === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const f = body.name ? inside(OUT, safeName(body.name)) : null;
    if (f && fs.existsSync(f)) reveal(f, true);
    else reveal(OUT, false);
    return send(res, 200, { ok: true });
  }
  return fail(res, 404, "Unknown API");
}

/* ---------------- server ---------------- */

async function main() {
  // Already running (double-clicked twice)? Just open it.
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(800) });
    if (r.ok && (await r.json()).ok) {
      console.log(`Map Animation Studio is already running at http://localhost:${PORT}`);
      if (OPEN) openInBrowser(`http://localhost:${PORT}`);
      return;
    }
  } catch {
    // not running
  }

  let vite = null;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (url.pathname.startsWith("/out/")) {
        const f = inside(OUT, decodeURIComponent(url.pathname.slice(5)));
        if (f && (await serveFile(req, res, f))) return;
        return fail(res, 404, "Not found");
      }
      if (vite) return vite.middlewares(req, res, () => fail(res, 404, "Not found"));
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      for (const base of [DIST, PUBLIC]) {
        const f = inside(base, rel || "index.html");
        if (f && (await serveFile(req, res, f))) return;
      }
      await serveFile(req, res, path.join(DIST, "index.html"));
    } catch (e) {
      console.error(e);
      if (!res.headersSent) fail(res, 500, String(e?.message || e));
    }
  });
  server.requestTimeout = 0;
  if (DEV) {
    const { createServer } = await import("vite");
    vite = await createServer({
      configFile: path.join(ROOT, "vite.config.ts"),
      root: path.join(ROOT, "app"),
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
      logLevel: "warn",
    });
  }

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is busy. Start with another port: node server/server.mjs --port=${PORT + 10}`);
      process.exit(1);
    }
    throw e;
  });
  server.listen(PORT, "127.0.0.1", () => {
    const url = `http://localhost:${PORT}`;
    console.log("");
    console.log("  ┌─────────────────────────────────────────────┐");
    console.log("  │  Map Animation Studio is running             │");
    console.log(`  │  Open ${url.padEnd(38)}│`);
    console.log("  │  Keep this window open while you work.       │");
    console.log("  └─────────────────────────────────────────────┘");
    console.log(`  Projects: ${PROJECTS}`);
    console.log(`  Exports:  ${OUT}`);
    console.log(`  Media:    ${MEDIA}`);
    console.log(`  Mode:     ${DEV ? "live (Vite)" : "built app"} · ${os.cpus().length} CPU threads`);
    console.log("");
    if (OPEN) openInBrowser(url);
  });
}

// A failed download (no internet, firewall) must not take the editor down with it.
const failActive = (e) => {
  console.error(`✖ ${e?.message || e}`);
  const j = activeDownload ?? [...jobs.values()].find((x) => ["bundling", "browser", "rendering"].includes(x.status));
  if (j) {
    j.status = "error";
    j.error = explain(e);
    j.finishedAt = Date.now();
    j.settle?.();
  }
};
process.on("uncaughtException", failActive);
process.on("unhandledRejection", failActive);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
