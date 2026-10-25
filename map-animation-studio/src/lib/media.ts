import { staticFile } from "remotion";

/** Accepts a URL or a path inside public/ (e.g. "media/drone.mp4"). */
export const resolveMedia = (src: string) =>
  /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src.replace(/^\/?public\//, "").replace(/^\//, ""));

export const isVideoFile = (src: string) => /\.(mp4|webm|mov|m4v|mkv)$/i.test(src);
