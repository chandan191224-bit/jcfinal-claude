// Highest-quality render of one composition to out/<id>.mp4
//
//   npm run render -- FlightPath                 1080p H.264 (CRF 12, lossless PNG frames)
//   npm run render -- FlightPath --4k            3840x2160
//   npm run render -- FlightPath --shorts        1080x1920 vertical
//   npm run render -- FlightPath --prores        ProRes 4444 .mov for Premiere / DaVinci grading
//   npm run render -- FlightPath --props=my.json  props file (same fields as the Studio panel)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
if (!id) {
  console.error("Usage: npm run render -- <CompositionId> [--4k] [--shorts] [--square] [--prores] [--props=file.json]");
  process.exit(1);
}
const has = (f) => args.includes(f);
let props = {};
const propsArg = args.find((a) => a.startsWith("--props="));
if (propsArg) props = JSON.parse(fs.readFileSync(propsArg.slice(8), "utf8"));
if (has("--4k")) props.format = "16:9 4K";
if (has("--shorts")) props.format = "9:16 Shorts/Reels";
if (has("--square")) props.format = "1:1 Square";
const prores = has("--prores");
const suffix = props.format ? `-${props.format.split(" ")[0].replace(":", "x")}` : "";
const out = path.join("out", `${id}${suffix}.${prores ? "mov" : "mp4"}`);
const cli = [
  "remotion",
  "render",
  id,
  out,
  ...(Object.keys(props).length ? [`--props=${JSON.stringify(props)}`] : []),
  ...(prores ? ["--codec=prores", "--prores-profile=4444"] : []),
  ...args.filter((a) => a.startsWith("--") && !["--4k", "--shorts", "--square", "--prores"].includes(a) && !a.startsWith("--props=")),
];
console.log("npx", cli.join(" "));
const r = spawnSync("npx", cli, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
