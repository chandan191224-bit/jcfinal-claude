import { z } from "zod";
import { clamp, easeOutBack, easeOutElastic } from "./geo";

export const EASES = ["linear", "ease-in", "ease-out", "ease-in-out", "back", "elastic", "bounce", "hold"] as const;
export const zEase = z.enum(EASES);
export type Ease = (typeof EASES)[number];

const bounce = (x: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

export function ease(e: Ease, t: number) {
  const x = clamp(t);
  switch (e) {
    case "linear":
      return x;
    case "ease-in":
      return x * x * x;
    case "ease-out":
      return 1 - Math.pow(1 - x, 3);
    case "ease-in-out":
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case "back":
      return easeOutBack(x);
    case "elastic":
      return easeOutElastic(x);
    case "bounce":
      return bounce(x);
    case "hold":
      return x < 1 ? 0 : 1;
  }
}

/** One keyframe of a layer's transform. `t` is seconds from the layer's start. */
export const zKey = z.object({
  t: z.number().min(0).describe("Seconds from the layer start"),
  opacity: z.number().min(0).max(1),
  scale: z.number().min(0).max(20),
  x: z.number().describe("Pixels right"),
  y: z.number().describe("Pixels down"),
  rotate: z.number().describe("Degrees"),
  ease: zEase.describe("Easing used to arrive at this keyframe"),
});
export type Key = z.infer<typeof zKey>;
export type Transform = { opacity: number; scale: number; x: number; y: number; rotate: number };

export const IDENTITY: Transform = { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 };

/**
 * Transform at `t` seconds into a layer. With no keyframes the layer fades in and out over
 * `fade` seconds so nothing pops.
 */
export function evaluate(keys: Key[], t: number, duration: number, fade = 0.35): Transform {
  if (!keys.length) {
    const o = Math.min(clamp(t / fade), clamp((duration - t) / fade));
    return { ...IDENTITY, opacity: o };
  }
  const ks = [...keys].sort((a, b) => a.t - b.t);
  if (t <= ks[0].t) return pick(ks[0]);
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i].t) {
      const a = ks[i - 1];
      const b = ks[i];
      const k = ease(b.ease, (t - a.t) / Math.max(1e-6, b.t - a.t));
      return {
        opacity: clamp(a.opacity + (b.opacity - a.opacity) * k),
        scale: a.scale + (b.scale - a.scale) * k,
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        rotate: a.rotate + (b.rotate - a.rotate) * k,
      };
    }
  }
  return pick(ks[ks.length - 1]);
}

const pick = (k: Key): Transform => ({ opacity: k.opacity, scale: k.scale, x: k.x, y: k.y, rotate: k.rotate });

/** Builds keyframes for common presets, handy as starting points. */
export const presetKeys = (preset: "pop" | "slide-up" | "zoom-in" | "spin-in" | "fade", hold = 3): Key[] => {
  const k = (t: number, o: Partial<Key>): Key => ({ t, opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, ease: "ease-out", ...o });
  switch (preset) {
    case "pop":
      return [k(0, { opacity: 0, scale: 0.4 }), k(0.5, { ease: "back" }), k(hold, {}), k(hold + 0.4, { opacity: 0, scale: 0.8, ease: "ease-in" })];
    case "slide-up":
      return [k(0, { opacity: 0, y: 80 }), k(0.6, {}), k(hold, {}), k(hold + 0.4, { opacity: 0, y: -40, ease: "ease-in" })];
    case "zoom-in":
      return [k(0, { opacity: 0, scale: 3 }), k(0.7, { ease: "ease-out" }), k(hold, {})];
    case "spin-in":
      return [k(0, { opacity: 0, rotate: -180, scale: 0.2 }), k(0.8, { ease: "back" }), k(hold, {})];
    case "fade":
      return [k(0, { opacity: 0 }), k(0.5, {}), k(hold, {}), k(hold + 0.5, { opacity: 0 })];
  }
};
