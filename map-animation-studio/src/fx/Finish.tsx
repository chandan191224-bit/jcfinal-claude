import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import type { Theme } from "../lib/themes";
import { clamp } from "../lib/geo";

/** Paper fibres, stains and fold creases drawn with SVG filters (resolution independent). */
export const PaperTexture: React.FC<{ strength?: number; antique?: boolean; creases?: boolean; burn?: boolean }> = ({
  strength = 1,
  antique = false,
  creases = true,
  burn = false,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height}>
        <defs>
          <filter id="paper-fibre" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="11" result="n" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.16  0 0 0 0.55 0" />
          </filter>
          <filter id="paper-stain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="4" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.12  0 0 0 1.4 -0.55" />
          </filter>
          <radialGradient id="paper-burn" cx="50%" cy="50%" r="72%">
            <stop offset="70%" stopColor="#3a1f08" stopOpacity="0" />
            <stop offset="93%" stopColor="#3a1f08" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#120801" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id="crease-v" x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="0.48" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.53" stopColor="#000" stopOpacity="0.06" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="crease-h" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="0.48" stopColor="#000" stopOpacity="0.14" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="0.53" stopColor="#000" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} filter="url(#paper-fibre)" opacity={0.35 * strength} style={{ mixBlendMode: "multiply" }} />
        {antique ? <rect width={width} height={height} filter="url(#paper-stain)" opacity={0.5 * strength} style={{ mixBlendMode: "multiply" }} /> : null}
        {creases
          ? [1, 2, 3].map((i) => (
              <rect key={`v${i}`} x={(width * i) / 4 - 30} y={0} width={60} height={height} fill="url(#crease-v)" opacity={strength} />
            ))
          : null}
        {creases ? <rect x={0} y={height / 2 - 30} width={width} height={60} fill="url(#crease-h)" opacity={strength} /> : null}
        {burn ? <rect width={width} height={height} fill="url(#paper-burn)" /> : null}
      </svg>
    </AbsoluteFill>
  );
};

/** Animated film grain; deterministic per frame. */
export const Grain: React.FC<{ amount?: number }> = ({ amount = 0.12 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: amount * 2.5 }}>
      <svg width={width} height={height}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 97} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ amount?: number; color?: string }> = ({ amount = 0.4, color = "0,0,0" }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, rgba(${color},0) 45%, rgba(${color},${amount}) 100%)`,
    }}
  />
);

export const Scanlines: React.FC<{ amount?: number }> = ({ amount = 0.12 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,${amount}) 0px, rgba(0,0,0,${amount}) 1px, transparent 2px, transparent 4px)`,
    }}
  />
);

/** Cinematic bars; `amount` 0..1 animates them in. */
export const Letterbox: React.FC<{ ratio?: number; amount?: number }> = ({ ratio = 2.39, amount = 1 }) => {
  const { width, height } = useVideoConfig();
  const bar = Math.max(0, (height - width / ratio) / 2) * clamp(amount);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
    </AbsoluteFill>
  );
};

/** Warm light leak sweeping across the frame. */
export const LightLeak: React.FC<{ start?: number; duration?: number; color?: string }> = ({ start = 0, duration = 40, color = "255,150,60" }) => {
  const frame = useCurrentFrame();
  const t = (frame - start) / duration;
  if (t < 0 || t > 1) return null;
  const x = interpolate(t, [0, 1], [-30, 130]);
  const a = Math.sin(Math.PI * t);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: a,
        background: `radial-gradient(circle at ${x}% 40%, rgba(${color},0.85) 0%, rgba(${color},0.35) 22%, rgba(${color},0) 48%), radial-gradient(circle at ${x - 20}% 80%, rgba(255,60,90,0.5) 0%, rgba(255,60,90,0) 35%)`,
      }}
    />
  );
};

/** Smooth hand-held / impact shake. Wrap content in it. */
export const CameraShake: React.FC<{ children: React.ReactNode; amount?: number; speed?: number; seed?: string }> = ({
  children,
  amount = 6,
  speed = 0.06,
  seed = "shake",
}) => {
  const frame = useCurrentFrame();
  const x = noise2D(seed + "x", frame * speed, 0) * amount;
  const y = noise2D(seed + "y", frame * speed, 0) * amount;
  const r = noise2D(seed + "r", frame * speed, 0) * amount * 0.04;
  return <AbsoluteFill style={{ translate: `${x}px ${y}px`, rotate: `${r}deg`, scale: amount > 0 ? 1 + amount / 900 : 1 }}>{children}</AbsoluteFill>;
};

/** Theme-appropriate finishing layers (paper, grain, scanlines, vignette). */
export const Finish: React.FC<{ theme: Theme; grain?: boolean }> = ({ theme, grain = true }) => (
  <>
    {theme.texture === "paper" ? <PaperTexture strength={0.7} /> : null}
    {theme.texture === "parchment" ? <PaperTexture strength={1} antique burn /> : null}
    {theme.texture === "scanlines" ? <Scanlines /> : null}
    {grain && (theme.texture === "grain" || theme.texture === "parchment") ? <Grain amount={0.08} /> : null}
    {theme.vignette > 0 ? <Vignette amount={theme.vignette} /> : null}
  </>
);
