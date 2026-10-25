import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";

export const SFX = [
  "whoosh",
  "whoosh-down",
  "swish",
  "zoom-in",
  "impact",
  "pop",
  "ping",
  "beep",
  "typing",
  "static",
  "paper",
  "riser",
  "plane-flyby",
  "engine",
  "tick",
] as const;
export type SfxName = (typeof SFX)[number];

/**
 * One sound effect at a frame. Volumes default low: effects should sit under a voiceover.
 * `src` may also be any audio file in public/ or a URL.
 */
export const Sfx: React.FC<{ name?: SfxName; src?: string; at: number; volume?: number; enabled?: boolean }> = ({
  name,
  src,
  at,
  volume = 0.25,
  enabled = true,
}) => {
  if (!enabled || (!name && !src)) return null;
  return (
    <Sequence from={Math.max(0, Math.round(at))} layout="none" name={`SFX ${name ?? src}`}>
      <Audio src={src ? (src.startsWith("http") ? src : staticFile(src)) : staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
