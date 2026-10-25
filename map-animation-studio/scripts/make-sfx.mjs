// Synthesises the studio's sound effects into public/sfx (original sounds, free to use anywhere).
// Run with: npm run make-sfx
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "public", "sfx");
fs.mkdirSync(out, { recursive: true });
const SR = 44100;

let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const white = () => rand() * 2 - 1;

function wav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * g)) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(out, `${name}.wav`), buf);
  console.log(name, (n / SR).toFixed(2) + "s");
}

// State-variable band-pass filter with a moving centre frequency.
function sweepNoise(dur, f0, f1, q, env) {
  const n = Math.round(dur * SR);
  const o = new Float32Array(n);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 * Math.pow(f1 / f0, t);
    const F = 2 * Math.sin((Math.PI * f) / SR);
    const high = white() - low - q * band;
    band += F * high;
    low += F * band;
    o[i] = band * env(t);
  }
  return o;
}

const bell = (a, b) => (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t)), a) * (b ?? 1);
const mix = (...arrs) => {
  const n = Math.max(...arrs.map((a) => a.length));
  const o = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) o[i] += a[i];
  return o;
};
const tone = (dur, f, env, type = "sine") => {
  const n = Math.round(dur * SR);
  const o = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const fr = typeof f === "function" ? f(t) : f;
    ph += (2 * Math.PI * fr) / SR;
    const s = type === "sine" ? Math.sin(ph) : type === "saw" ? ((ph / Math.PI) % 2) - 1 : Math.sign(Math.sin(ph));
    o[i] = s * env(t);
  }
  return o;
};

wav("whoosh", sweepNoise(1.1, 250, 2600, 0.6, (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 2)));
wav("whoosh-down", sweepNoise(1.0, 2600, 180, 0.6, (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.2)), 2)));
wav("swish", sweepNoise(0.35, 900, 5000, 0.45, bell(2)));
wav("zoom-in", mix(sweepNoise(1.6, 120, 4200, 0.5, (t) => Math.pow(t, 2.2) * (t < 0.92 ? 1 : (1 - t) / 0.08)), tone(1.6, (t) => 60 + 140 * t * t, (t) => 0.25 * t * (t < 0.92 ? 1 : (1 - t) / 0.08))));
wav("impact", mix(tone(1.2, (t) => 55 * Math.pow(0.4, t), (t) => Math.exp(-t * 6)), sweepNoise(1.2, 3000, 200, 0.9, (t) => Math.exp(-t * 14) * 0.8)));
wav("pop", tone(0.18, (t) => 900 - 500 * t, (t) => Math.exp(-t * 9) * Math.min(1, t * 60)));
wav("ping", mix(tone(1.4, 1320, (t) => Math.exp(-t * 4.5) * Math.min(1, t * 200)), tone(1.4, 2640, (t) => 0.25 * Math.exp(-t * 7))));
wav("beep", tone(0.12, 1760, (t) => (t < 0.9 ? 1 : (1 - t) * 10) * Math.min(1, t * 40), "square"));
wav(
  "typing",
  (() => {
    const n = Math.round(1.2 * SR);
    const o = new Float32Array(n);
    for (let k = 0; k < 14; k++) {
      const start = Math.round((k * 0.082 + rand() * 0.02) * SR);
      for (let i = 0; i < 900 && start + i < n; i++) o[start + i] += white() * Math.exp(-i / 120) * (0.6 + rand() * 0.4);
    }
    return o;
  })(),
);
wav("static", sweepNoise(1.5, 1800, 2200, 0.2, (t) => (0.4 + 0.6 * Math.abs(Math.sin(t * 37))) * bell(0.3)(t)));
wav("paper", sweepNoise(1.2, 3000, 1400, 0.3, (t) => Math.abs(Math.sin(t * 23)) * Math.abs(Math.sin(t * 7)) * bell(0.5)(t)));
wav("riser", mix(tone(3, (t) => 110 * Math.pow(4, t), (t) => t * t * 0.5, "saw"), sweepNoise(3, 300, 6000, 0.4, (t) => t * t)));
wav(
  "plane-flyby",
  (() => {
    const dur = 4;
    const n = Math.round(dur * SR);
    const o = new Float32Array(n);
    const noise = sweepNoise(dur, 400, 400, 0.15, () => 1);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const doppler = 1 + 0.12 * Math.tanh((0.5 - t) * 6);
      ph += (2 * Math.PI * 92 * doppler) / SR;
      const env = Math.exp(-Math.pow((t - 0.5) * 3.2, 2));
      o[i] = (Math.sin(ph) * 0.5 + Math.sin(ph * 2.01) * 0.3 + noise[i] * 0.9) * env;
    }
    return o;
  })(),
);
wav("engine", sweepNoise(4, 140, 160, 0.1, (t) => (0.8 + 0.2 * Math.sin(t * 90)) * Math.min(1, t * 8, (1 - t) * 8)));
wav("tick", tone(0.05, 2400, (t) => Math.exp(-t * 30)));
console.log("done");
