// Builds "Map Animation Studio.html": the whole editor, the animation engine and all map data in
// ONE file that opens by double-click (file://), with no server and no install.
//   npm run build-html
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const tmp = path.join(root, ".html-build");
const outFile = path.join(root, "Map Animation Studio.html");

// 1. Bundle the app into one JS and one CSS file.
await build({
  configFile: path.join(root, "vite.config.ts"),
  base: "./",
  logLevel: "warn",
  build: {
    outDir: tmp,
    emptyOutDir: true,
    copyPublicDir: false,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 1e9,
    chunkSizeWarningLimit: 1e9,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

let html = fs.readFileSync(path.join(tmp, "index.html"), "utf8");
const assetsDir = path.join(tmp, "assets");
const files = fs.readdirSync(assetsDir);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`Expected one JS bundle, got ${js.join(", ")}`);

// 2. Inline the CSS and JS. "</script" inside the code would end the tag early, so escape it.
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+\.css"[^>]*>/g, "");
const style = css.map((f) => fs.readFileSync(path.join(assetsDir, f), "utf8")).join("\n");
html = html.replace("</head>", () => `<style>\n${style}\n</style>\n</head>`);
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/[^"]+\.js"[^>]*><\/script>/, "");
const code = fs.readFileSync(path.join(assetsDir, js[0]), "utf8").replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// 3. Pack map data, textures, flags, sounds and cached terrain: [u32 index length][JSON index][bytes], gzipped.
const pick = [];
const walk = (dir, rel = "") => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else pick.push(r);
  }
};
for (const d of ["data", "textures", "flags", "sfx", "terrain"]) walk(path.join(pub, d), d);
const keep = pick.filter((p) => /\.(json|svg|png|jpg|jpeg|wav|txt)$/i.test(p)).sort();
const index = [];
const parts = [];
let offset = 0;
for (const p of keep) {
  const buf = fs.readFileSync(path.join(pub, p));
  index.push({ p, o: offset, s: buf.length });
  parts.push(buf);
  offset += buf.length;
}
const head = Buffer.from(JSON.stringify(index), "utf8");
const len = Buffer.alloc(4);
len.writeUInt32LE(head.length, 0);
const packed = zlib.gzipSync(Buffer.concat([len, head, ...parts]), { level: 9 });
const b64 = packed.toString("base64");

// A function replacement: the code contains "$&", "$'" etc., which a string replacement would expand.
html = html.replace(
  "</body>",
  () => `<script id="map-assets" type="application/octet-stream">${b64}</script>\n<script type="module">\n${code}\n</script>\n</body>`,
);
fs.writeFileSync(outFile, html);
fs.rmSync(tmp, { recursive: true, force: true });
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
console.log(`✔ ${path.relative(root, outFile)}  ${mb(fs.statSync(outFile).size)}  (${keep.length} data files, ${mb(offset)} → ${mb(packed.length)} packed; code ${mb(code.length)})`);
