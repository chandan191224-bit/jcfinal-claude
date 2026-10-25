// Builds the installable desktop app:
//   npm run build-desktop            → release/Map-Animation-Studio-Setup-<version>.exe (Windows installer)
//   npm run build-desktop -- --dir   → release/win-unpacked (no installer, for testing)
//   npm run build-desktop -- --linux → release/linux-unpacked (for testing on Linux)
// Works on Windows, macOS and Linux build machines (no Wine needed).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";
import * as ResEdit from "resedit";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Outside the project: electron-builder looks for node_modules in parent folders and would pack all
// of the project's development tools into the app.
const work = path.join(os.tmpdir(), "map-animation-studio-desktop-build");
const appDir = path.join(work, "app");
const args = new Set(process.argv.slice(2));
const linux = args.has("--linux");
const dirOnly = args.has("--dir");
const PRODUCT = "Map Animation Studio";

fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });

// 1. The editor and its map data → app/web
console.log("• Building the editor…");
await viteBuild({ configFile: path.join(root, "vite.config.ts"), base: "/", logLevel: "warn", build: { outDir: path.join(appDir, "web"), emptyOutDir: true, chunkSizeWarningLimit: 1e9 } });
fs.rmSync(path.join(appDir, "web", "media"), { recursive: true, force: true });

// 2. The Electron main process
for (const f of ["main.cjs", "preload.cjs", "icon.png"]) fs.copyFileSync(path.join(root, "desktop", f), path.join(appDir, f));
fs.writeFileSync(
  path.join(appDir, "package.json"),
  JSON.stringify({ name: "map-animation-studio", productName: PRODUCT, version: pkg.version, description: "Map and travel animations for YouTube videos", author: PRODUCT, main: "main.cjs" }, null, 2),
);

// electron-builder's two-package layout: an empty build project around the app.
fs.writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "map-animation-studio-build", version: pkg.version, private: true }, null, 2));

// 3. ffmpeg, for turning a WebM master into MP4 on computers whose encoder can't make H.264
const ffDir = path.join(work, "ffmpeg");
const compositor = linux ? "@remotion/compositor-linux-x64-gnu" : "@remotion/compositor-win32-x64-msvc";
if (!fs.existsSync(path.join(ffDir, linux ? "ffmpeg" : "ffmpeg.exe"))) {
  console.log(`• Fetching ffmpeg (${compositor})…`);
  const cache = path.join(work, "cache");
  fs.rmSync(ffDir, { recursive: true, force: true });
  fs.mkdirSync(cache, { recursive: true });
  const tgz = execFileSync("npm", ["pack", `${compositor}@${pkg.dependencies.remotion}`, "--silent"], { cwd: cache, encoding: "utf8", shell: process.platform === "win32" }).trim().split("\n").pop();
  const unpack = path.join(cache, "unpacked");
  fs.rmSync(unpack, { recursive: true, force: true });
  fs.mkdirSync(unpack, { recursive: true });
  execFileSync("tar", ["xzf", path.join(cache, tgz), "-C", unpack]);
  fs.mkdirSync(ffDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(unpack, "package"))) {
    if (/^(ffmpeg(\.exe)?|.*\.dll|lib.*\.so.*)$/.test(f)) fs.copyFileSync(path.join(unpack, "package", f), path.join(ffDir, f));
  }
  if (linux) fs.chmodSync(path.join(ffDir, "ffmpeg"), 0o755);
}

// 4. Package with electron-builder
const { build, Platform, Arch } = require("electron-builder");
const icon = path.join(root, "desktop", "icon.ico");

/** Puts the app icon and product name into the .exe (electron-builder would need Wine for this on Linux). */
const brandExe = (exe) => {
  const data = fs.readFileSync(exe);
  const ex = ResEdit.NtExecutable.from(data);
  const res = ResEdit.NtExecutableResource.from(ex);
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icon));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const target = groups[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    target ? target.id : 1,
    target ? target.lang : 1033,
    iconFile.icons.map((i) => i.data),
  );
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] ?? ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = pkg.version.split(".").map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues(
    { lang: 1033, codepage: 1200 },
    { ProductName: PRODUCT, FileDescription: PRODUCT, CompanyName: PRODUCT, InternalName: PRODUCT, OriginalFilename: `${PRODUCT}.exe`, LegalCopyright: `© ${new Date().getFullYear()}` },
  );
  vi.outputToResourceEntries(res.entries);
  res.outputResource(ex);
  fs.writeFileSync(exe, Buffer.from(ex.generate()));
};

console.log("• Packaging…");
process.chdir(work);
const out = await build({
  projectDir: work,
  targets: linux ? Platform.LINUX.createTarget(["dir"], Arch.x64) : Platform.WINDOWS.createTarget(dirOnly ? ["dir"] : ["nsis"], Arch.x64),
  config: {
    appId: "com.mapanimationstudio.app",
    productName: PRODUCT,
    copyright: `© ${new Date().getFullYear()} ${PRODUCT}`,
    electronVersion: pkg.devDependencies.electron.replace(/^[^\d]*/, ""),
    directories: { app: "app", output: path.join(root, "release") },
    asar: true,
    compression: "maximum",
    publish: null,
    electronLanguages: ["en-US", "en-GB", "hi"],
    npmRebuild: false,
    files: ["**/*", "!node_modules/**"],
    extraResources: [{ from: "ffmpeg", to: "ffmpeg" }],
    win: { target: "nsis", icon, signAndEditExecutable: false },
    linux: { target: "dir", icon: path.join(root, "desktop", "icon.png"), category: "Video" },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: "always",
      createStartMenuShortcut: true,
      shortcutName: PRODUCT,
      installerIcon: icon,
      uninstallerIcon: icon,
      installerHeaderIcon: icon,
      runAfterFinish: true,
      artifactName: "Map-Animation-Studio-Setup-${version}.${ext}",
      uninstallDisplayName: PRODUCT,
      include: path.join(root, "desktop", "installer.nsh"),
    },
    afterPack: async (ctx) => {
      if (ctx.electronPlatformName === "win32") brandExe(path.join(ctx.appOutDir, `${PRODUCT}.exe`));
    },
  },
});
for (const f of out) console.log(`✔ ${path.relative(root, f)}  ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
if (!out.length || dirOnly || linux) console.log(`✔ unpacked app in ${path.relative(root, path.join(root, "release"))}`);
