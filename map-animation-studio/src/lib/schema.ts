import { z } from "zod";
import { THEME_NAMES } from "./themes";
import { VEHICLES } from "../map/icons";
import { ROUTE_STYLES } from "../map/overlays";

export const FORMATS = {
  "16:9 1080p": [1920, 1080],
  "16:9 4K": [3840, 2160],
  "9:16 Shorts/Reels": [1080, 1920],
  "1:1 Square": [1080, 1080],
  "4:5 Portrait": [1080, 1350],
} as const;
export type FormatName = keyof typeof FORMATS;

export const zFormat = z.enum(Object.keys(FORMATS) as [FormatName, ...FormatName[]]).describe("Frame size");
export const zTheme = z.enum(THEME_NAMES).describe("Map look");
export const zBorders = z
  .enum(["india", "world"])
  .describe("Border view: 'india' shows boundaries as officially recognised by India (Survey of India); 'world' uses Natural Earth de facto lines");
export const zProjection = z.enum(["globe", "mercator", "flat", "natural"]);
export const zVehicle = z.enum(VEHICLES);
export const zRouteStyle = z.enum(ROUTE_STYLES);
export const zRouteMode = z
  .enum(["road", "rail", "flight", "sea", "straight", "street"])
  .describe("road/rail snap to real highways/railways; street uses OpenStreetMap (needs internet)");
/** Colour as CSS string; "auto" uses the theme's colour. */
export const zColorOrAuto = z.string().describe('CSS colour or "auto" for the theme colour');

export const base = {
  format: zFormat,
  durationSec: z.number().min(1).max(600).describe("Length of the clip in seconds"),
  theme: zTheme,
  borders: zBorders,
  sfx: z.boolean().describe("Sound effects"),
  sfxVolume: z.number().min(0).max(1).step(0.05),
};

export const auto = (v: string, fallback: string) => (!v || v === "auto" ? fallback : v);

/** Sets frame size and duration from the `format` and `durationSec` props. */
export const sizeFromProps = <T extends { format: FormatName; durationSec: number }>({ props }: { props: T }) => {
  const [width, height] = FORMATS[props.format] ?? FORMATS["16:9 1080p"];
  return { width, height, durationInFrames: Math.max(1, Math.round(props.durationSec * 30)), fps: 30 };
};
