// Map Animation Studio desktop app (Electron).
// Serves the editor and its map data from the app's own files through the app:// scheme, so it
// behaves like a normal website (storage, video encoding, fetch) without any server or browser.
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");

const WEB = path.join(__dirname, "web");
const ICON = path.join(__dirname, "icon.png");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, codeCache: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

// Exporting needs WebGL. When a computer's graphics driver is blocked or missing, let Chromium use
// its built-in software renderer instead of failing (the studio only ever shows its own pages).
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

/** app://studio/<path> → file in the app's web folder, with Range support for media. */
async function serve(request) {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.normalize(path.join(WEB, rel));
  if (!file.startsWith(WEB)) return new Response("Forbidden", { status: 403 });
  let st;
  try {
    st = await fsp.stat(file);
    if (!st.isFile()) throw new Error("dir");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${st.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
      status: 206,
      headers: { "content-type": type, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes" },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { "content-type": type, "content-length": String(st.size), "accept-ranges": "bytes" } });
}

/* ---------------- saving exports ---------------- */

const ffmpegPath = () => {
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [path.join(process.resourcesPath ?? "", "ffmpeg", exe), path.join(__dirname, "..", "ffmpeg", exe)];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
};

const runFfmpeg = (args, onLine) =>
  new Promise((resolve, reject) => {
    const bin = ffmpegPath();
    if (!bin) return reject(new Error("ffmpeg is missing from this installation"));
    const dir = path.dirname(bin);
    const p = spawn(bin, args, { windowsHide: true, env: { ...process.env, LD_LIBRARY_PATH: dir, DYLD_LIBRARY_PATH: dir } });
    let tail = "";
    p.stderr.on("data", (d) => {
      tail = (tail + d.toString()).slice(-4000);
      onLine?.(d.toString());
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${tail.split("\n").slice(-6).join("\n")}`))));
  });

let mainWindow = null;

ipcMain.handle("save-video", async (event, { data, name, transcode, durationSec }) => {
  const ext = transcode ? "mp4" : path.extname(name).slice(1) || "mp4";
  const base = name.replace(/\.[^.]+$/, "");
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save video",
    defaultPath: path.join(app.getPath("videos"), `${base}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (canceled || !filePath) return null;
  const buf = Buffer.from(data);
  if (!transcode) {
    await fsp.writeFile(filePath, buf);
    return filePath;
  }
  // The browser engine could only make WebM here: re-encode to a high-quality H.264 MP4.
  const tmp = path.join(os.tmpdir(), `map-studio-${Date.now()}.webm`);
  await fsp.writeFile(tmp, buf);
  try {
    await runFfmpeg(
      ["-y", "-i", tmp, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", filePath],
      (line) => {
        const m = /time=(\d+):(\d+):([\d.]+)/.exec(line);
        if (m && durationSec) event.sender.send("transcode-progress", Math.min(1, (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / durationSec));
      },
    );
  } finally {
    fsp.rm(tmp, { force: true }).catch(() => {});
  }
  return filePath;
});

ipcMain.handle("reveal", (_e, p) => shell.showItemInFolder(p));
ipcMain.handle("can-transcode", () => Boolean(ffmpegPath()));
ipcMain.handle("version", () => app.getVersion());

/* ---------------- window ---------------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#101318",
    title: "Map Animation Studio",
    icon: ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  // Links (e.g. help pages) open in the normal browser, never inside the studio.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.loadURL("app://studio/index.html");
}

const menu = () =>
  Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "quit", label: "Exit" }] },
    { label: "Edit", submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "toggleDevTools" }],
    },
    { label: "Help", submenu: [{ label: `Map Animation Studio ${app.getVersion()}`, enabled: false }] },
  ]);

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  protocol.handle("app", serve);
  // Exports and project files are written through the save dialog; any other download asks too.
  session.defaultSession.on("will-download", (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath("downloads"), item.getFilename()) });
  });
  Menu.setApplicationMenu(menu());
  createWindow();
});

app.on("window-all-closed", () => app.quit());

// Used to check a build: starts, renders, and (optionally) exports a 1-second video unattended.
if (process.env.MAP_STUDIO_SMOKE_EXPORT) {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: process.env.MAP_STUDIO_SMOKE_EXPORT });
  app.whenReady().then(() => {
    setTimeout(async () => {
      const js = `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const btn = (sel, text) => [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().startsWith(text));
        btn(".tabs button", "Project").click();
        await sleep(300);
        const len = [...document.querySelectorAll(".f")].find((f) => f.textContent.includes("Length (s)")).querySelector("input");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(len, "1");
        len.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(500);
        btn(".top .btn.pri", "Export").click();
        await sleep(500);
        btn(".dlg .btn.pri", "Export").click();
        for (let i = 0; i < 600; i++) {
          await sleep(1000);
          const t = document.querySelector(".dlg")?.innerText ?? "";
          if (/Saved to|failed|can't|Error|error/.test(t) && !/Rendering frame/.test(t)) return t;
        }
        return "timeout";
      })()`;
      const result = await mainWindow.webContents.executeJavaScript(js);
      console.log("SMOKE EXPORT:", result.replace(/\n/g, " | "));
      app.quit();
    }, 20000);
  });
}

// Used by the build to check that the packaged app starts and renders (no window shown).
if (process.env.MAP_STUDIO_SMOKE) {
  app.whenReady().then(() => {
    setTimeout(async () => {
      const img = await mainWindow.webContents.capturePage();
      fs.writeFileSync(process.env.MAP_STUDIO_SMOKE, img.toPNG());
      const errors = await mainWindow.webContents.executeJavaScript("JSON.stringify(window.__errors || [])");
      console.log("smoke errors:", errors);
      app.quit();
    }, Number(process.env.MAP_STUDIO_SMOKE_MS || 25000));
  });
}
