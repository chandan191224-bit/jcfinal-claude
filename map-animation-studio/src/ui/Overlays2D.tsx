import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, compassPoint, easeOutBack, easeOutCubic, formatKm } from "../lib/geo";
import { formatDms, formatLatLon } from "../lib/places";
import { font } from "../lib/fonts";
import type { Theme } from "../lib/themes";

/* ---------------- GPS / flight HUD ---------------- */

export type HudData = {
  lat: number;
  lon: number;
  altitudeM?: number;
  speedKmh?: number;
  headingDeg?: number;
  distanceKm?: number;
  clock?: string;
  title?: string;
};

export const Hud: React.FC<{ data: HudData; color?: string; style?: "drone" | "flight" | "minimal"; appear?: number }> = ({
  data,
  color = "#7CFFB2",
  style = "drone",
  appear = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = easeOutCubic(clamp((frame - appear) / 15));
  const unit = height / 1080;
  const f = font("Share Tech Mono");
  const corner = 60 * unit;
  const pad = 70 * unit;
  const rec = Math.floor(frame / 15) % 2 === 0;
  const line = (label: string, value: string) => (
    <div style={{ display: "flex", gap: 18 * unit, justifyContent: "space-between" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
  const box = { position: "absolute" as const, width: corner, height: corner, borderColor: color, borderStyle: "solid", opacity: 0.85 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: a, color, font: `400 ${26 * unit}px ${f}`, textShadow: "0 0 8px rgba(0,0,0,0.8)" }}>
      {style !== "minimal" ? (
        <>
          <div style={{ ...box, left: pad, top: pad, borderWidth: `${3 * unit}px 0 0 ${3 * unit}px` }} />
          <div style={{ ...box, right: pad, top: pad, borderWidth: `${3 * unit}px ${3 * unit}px 0 0` }} />
          <div style={{ ...box, left: pad, bottom: pad, borderWidth: `0 0 ${3 * unit}px ${3 * unit}px` }} />
          <div style={{ ...box, right: pad, bottom: pad, borderWidth: `0 ${3 * unit}px ${3 * unit}px 0` }} />
          <div style={{ position: "absolute", left: width / 2 - 30 * unit, top: height / 2, width: 60 * unit, height: 2 * unit, background: color, opacity: 0.6 }} />
          <div style={{ position: "absolute", left: width / 2, top: height / 2 - 30 * unit, width: 2 * unit, height: 60 * unit, background: color, opacity: 0.6 }} />
        </>
      ) : null}
      <div style={{ position: "absolute", left: pad + 24 * unit, top: pad + 24 * unit, display: "flex", alignItems: "center", gap: 12 * unit }}>
        <div style={{ width: 18 * unit, height: 18 * unit, borderRadius: "50%", background: "#ff3b3b", opacity: rec ? 1 : 0.2 }} />
        <span>{style === "flight" ? "FLT TRACK" : "REC"}</span>
        {data.title ? <span style={{ marginLeft: 20 * unit, opacity: 0.85 }}>{data.title}</span> : null}
      </div>
      {data.clock ? <div style={{ position: "absolute", right: pad + 24 * unit, top: pad + 24 * unit }}>{data.clock}</div> : null}
      <div style={{ position: "absolute", left: pad + 24 * unit, bottom: pad + 24 * unit, width: 520 * unit, display: "grid", gap: 4 * unit }}>
        {line("LAT", formatDms(data.lat, data.lon).split("  ")[0])}
        {line("LON", formatDms(data.lat, data.lon).split("  ")[1])}
        {data.altitudeM !== undefined ? line("ALT", `${Math.round(data.altitudeM).toLocaleString("en-IN")} m  /  ${Math.round(data.altitudeM * 3.28084).toLocaleString("en-IN")} ft`) : null}
      </div>
      <div style={{ position: "absolute", right: pad + 24 * unit, bottom: pad + 24 * unit, width: 400 * unit, display: "grid", gap: 4 * unit }}>
        {data.speedKmh !== undefined ? line("SPD", `${Math.round(data.speedKmh)} km/h`) : null}
        {data.headingDeg !== undefined ? line("HDG", `${String(Math.round(data.headingDeg) % 360).padStart(3, "0")}° ${compassPoint(data.headingDeg)}`) : null}
        {data.distanceKm !== undefined ? line("DST", formatKm(data.distanceKm)) : null}
      </div>
      {data.headingDeg !== undefined && style !== "minimal" ? <HeadingTape heading={data.headingDeg} color={color} unit={unit} /> : null}
    </AbsoluteFill>
  );
};

const HeadingTape: React.FC<{ heading: number; color: string; unit: number }> = ({ heading, color, unit }) => {
  const { width } = useVideoConfig();
  const span = 90;
  const w = 600 * unit;
  const ticks = [];
  for (let d = Math.floor((heading - span / 2) / 5) * 5; d <= heading + span / 2; d += 5) {
    const x = ((d - heading) / span + 0.5) * w;
    const major = d % 15 === 0;
    const label = ((d % 360) + 360) % 360;
    ticks.push(
      <g key={d}>
        <line x1={x} x2={x} y1={0} y2={major ? 18 * unit : 9 * unit} stroke={color} strokeWidth={2 * unit} />
        {major ? (
          <text x={x} y={42 * unit} textAnchor="middle" fill={color} style={{ font: `400 ${20 * unit}px ${font("Share Tech Mono")}` }}>
            {label % 90 === 0 ? ["N", "E", "S", "W"][label / 90] : label}
          </text>
        ) : null}
      </g>,
    );
  }
  return (
    <svg width={w} height={60 * unit} style={{ position: "absolute", left: (width - w) / 2, top: 80 * unit, overflow: "hidden" }}>
      {ticks}
      <path d={`M${w / 2 - 10 * unit} ${56 * unit} L${w / 2} ${44 * unit} L${w / 2 + 10 * unit} ${56 * unit} Z`} fill={color} />
    </svg>
  );
};

/* ---------------- kinetic location card ---------------- */

export const LOCATION_CARD_STYLES = ["documentary", "vlog", "minimal", "tactical", "vintage", "neon"] as const;
export type LocationCardStyle = (typeof LOCATION_CARD_STYLES)[number];

export const LocationCard: React.FC<{
  name: string;
  subtitle?: string;
  lat?: number;
  lon?: number;
  start?: number;
  duration?: number;
  cardStyle?: LocationCardStyle;
  position?: "bottom-left" | "center" | "top-left" | "bottom-right";
  accent?: string;
}> = ({ name, subtitle, lat, lon, start = 0, duration = 150, cardStyle = "documentary", position = "bottom-left", accent = "#ffb347" }) => {
  const frame = useCurrentFrame() - start;
  const { width, height } = useVideoConfig();
  if (frame < 0 || frame > duration) return null;
  const unit = height / 1080;
  const out = clamp((duration - frame) / 12);
  const bar = easeOutCubic(clamp(frame / 14));
  const coords = lat !== undefined && lon !== undefined ? formatLatLon(lat, lon) : "";
  const typed = coords.slice(0, Math.floor(coords.length * clamp((frame - 18) / 26)));
  const letters = name.split("");
  const fam =
    cardStyle === "vintage" ? "IM Fell English SC" : cardStyle === "tactical" ? "Teko" : cardStyle === "neon" ? "Orbitron" : cardStyle === "vlog" ? "Poppins" : "Oswald";
  const big = (cardStyle === "tactical" ? 120 : cardStyle === "vlog" ? 96 : 104) * unit;
  const pos: React.CSSProperties =
    position === "center"
      ? { left: 0, right: 0, top: height * 0.38, textAlign: "center", alignItems: "center" }
      : position === "top-left"
        ? { left: 110 * unit, top: 110 * unit }
        : position === "bottom-right"
          ? { right: 110 * unit, bottom: 130 * unit, alignItems: "flex-end", textAlign: "right" }
          : { left: 110 * unit, bottom: 130 * unit };
  const color = cardStyle === "minimal" || cardStyle === "vintage" ? "#1e1b16" : "#ffffff";
  const panel =
    cardStyle === "vlog"
      ? { background: "rgba(255,255,255,0.92)", color: "#1d2733", padding: `${18 * unit}px ${34 * unit}px`, borderRadius: 22 * unit }
      : cardStyle === "minimal"
        ? { background: "rgba(255,255,255,0.9)", padding: `${16 * unit}px ${30 * unit}px`, borderRadius: 6 * unit }
        : cardStyle === "vintage"
          ? { background: "rgba(236,220,176,0.92)", padding: `${16 * unit}px ${30 * unit}px`, border: `${3 * unit}px double #5b3d1e` }
          : {};
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: out }}>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", gap: 10 * unit, ...pos, width: position === "center" ? width : undefined }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 8 * unit, ...panel, alignItems: pos.alignItems }}>
          {subtitle ? (
            <div
              style={{
                font: `600 ${30 * unit}px ${font(cardStyle === "vintage" ? "IM Fell English" : "Inter")}`,
                letterSpacing: 6 * unit,
                textTransform: "uppercase",
                color: cardStyle === "vlog" ? accent : cardStyle === "minimal" || cardStyle === "vintage" ? "#6b5a45" : accent,
                opacity: easeOutCubic(clamp((frame - 6) / 12)),
                translate: `0 ${(1 - easeOutCubic(clamp((frame - 6) / 12))) * 20}px`,
              }}
            >
              {subtitle}
            </div>
          ) : null}
          <div style={{ font: `700 ${big}px ${font(fam)}`, lineHeight: 1, color: cardStyle === "vlog" ? "#1d2733" : color, textShadow: color === "#ffffff" && !panel.background ? "0 6px 30px rgba(0,0,0,0.6)" : undefined, whiteSpace: "nowrap" }}>
            {letters.map((ch, i) => {
              const k = easeOutBack(clamp((frame - 4 - i * 1.6) / 14), 1.8);
              return (
                <span key={i} style={{ display: "inline-block", opacity: clamp(k * 2), translate: `0 ${(1 - k) * 60 * unit}px`, textShadow: cardStyle === "neon" ? `0 0 ${18 * unit}px ${accent}` : undefined }}>
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
          </div>
          <div style={{ height: 5 * unit, width: `${bar * 100}%`, background: accent, borderRadius: 3 }} />
          {coords ? (
            <div style={{ font: `500 ${26 * unit}px ${font("JetBrains Mono")}`, color: cardStyle === "vlog" ? "#51606d" : color, opacity: 0.9, minHeight: 32 * unit }}>{typed}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- counters, compass, scale bar, title ---------------- */

export const Counter: React.FC<{ value: number; label: string; theme: Theme; corner?: "top-right" | "top-left" | "bottom-right"; format?: (v: number) => string }> = ({
  value,
  label,
  theme,
  corner = "top-right",
  format = formatKm,
}) => {
  const { height } = useVideoConfig();
  const unit = height / 1080;
  const pos: React.CSSProperties =
    corner === "top-left" ? { left: 90 * unit, top: 80 * unit } : corner === "bottom-right" ? { right: 90 * unit, bottom: 90 * unit } : { right: 90 * unit, top: 80 * unit };
  return (
    <div style={{ position: "absolute", ...pos, textAlign: corner === "top-left" ? "left" : "right", color: theme.label, textShadow: `0 0 12px ${theme.labelHalo}` }}>
      <div style={{ font: `600 ${22 * unit}px ${font(theme.labelFont)}`, letterSpacing: 4 * unit, textTransform: "uppercase", opacity: 0.8 }}>{label}</div>
      <div style={{ font: `700 ${64 * unit}px ${font(theme.titleFont)}`, fontVariantNumeric: "tabular-nums" }}>{format(value)}</div>
    </div>
  );
};

export const CompassRose: React.FC<{ bearing: number; theme: Theme; size?: number; corner?: "bottom-right" | "top-right" | "bottom-left" }> = ({
  bearing,
  theme,
  size = 150,
  corner = "bottom-right",
}) => {
  const { height } = useVideoConfig();
  const unit = height / 1080;
  const s = size * unit;
  const pos: React.CSSProperties =
    corner === "top-right" ? { right: 70 * unit, top: 70 * unit } : corner === "bottom-left" ? { left: 70 * unit, bottom: 70 * unit } : { right: 70 * unit, bottom: 70 * unit };
  return (
    <svg width={s} height={s} viewBox="-100 -100 200 200" style={{ position: "absolute", ...pos }}>
      <g transform={`rotate(${-bearing})`}>
        <circle r="78" fill="none" stroke={theme.label} strokeWidth="2" opacity="0.6" />
        <circle r="70" fill="none" stroke={theme.label} strokeWidth="1" opacity="0.4" strokeDasharray="2 4" />
        <path d="M0 -92 L12 0 L0 92 L-12 0 Z" fill={theme.label} opacity="0.25" />
        <path d="M-92 0 L0 -12 L92 0 L0 12 Z" fill={theme.label} opacity="0.25" />
        <path d="M0 -92 L12 0 L-12 0 Z" fill={theme.accent} />
        <path d="M0 92 L12 0 L-12 0 Z" fill={theme.label} opacity="0.8" />
        <text y="-60" textAnchor="middle" dominantBaseline="middle" style={{ font: `700 26px ${font(theme.titleFont)}` }} fill={theme.label} stroke={theme.labelHalo} strokeWidth="4" paintOrder="stroke">
          N
        </text>
      </g>
    </svg>
  );
};

/** Scale bar sized from the true ground distance per pixel at the frame centre. */
export const ScaleBar: React.FC<{ kmPerPixel: number; theme: Theme }> = ({ kmPerPixel, theme }) => {
  const { height } = useVideoConfig();
  const unit = height / 1080;
  const target = 220 * unit * kmPerPixel;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const nice = [1, 2, 5, 10].map((m) => m * pow).filter((v) => v <= target).pop() ?? pow;
  const px = nice / kmPerPixel;
  if (!isFinite(px) || px <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 90 * unit, bottom: 70 * unit, color: theme.label, font: `600 ${20 * unit}px ${font(theme.labelFont)}`, textShadow: `0 0 8px ${theme.labelHalo}` }}>
      <div>{nice >= 1 ? `${nice.toLocaleString("en-IN")} km` : `${Math.round(nice * 1000)} m`}</div>
      <div style={{ width: px, height: 10 * unit, border: `${2 * unit}px solid ${theme.label}`, borderTop: "none", marginTop: 4 * unit }} />
    </div>
  );
};

export const TitleCard: React.FC<{ title: string; subtitle?: string; theme: Theme; start?: number; duration?: number }> = ({
  title,
  subtitle,
  theme,
  start = 0,
  duration = 90,
}) => {
  const frame = useCurrentFrame() - start;
  const { height } = useVideoConfig();
  if (frame < 0 || frame > duration) return null;
  const unit = height / 1080;
  const a = Math.min(easeOutCubic(clamp(frame / 15)), clamp((duration - frame) / 12));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 90 * unit, pointerEvents: "none", opacity: a }}>
      <div
        style={{
          font: `700 ${70 * unit}px ${font(theme.titleFont)}`,
          color: theme.label,
          textShadow: `0 0 18px ${theme.labelHalo}, 0 0 4px ${theme.labelHalo}`,
          letterSpacing: 2 * unit,
          translate: `0 ${interpolate(a, [0, 1], [-20, 0])}px`,
          textAlign: "center",
          maxWidth: "85%",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div style={{ font: `500 ${30 * unit}px ${font(theme.labelFont)}`, color: theme.label, opacity: 0.85, marginTop: 8 * unit, textShadow: `0 0 12px ${theme.labelHalo}` }}>
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
