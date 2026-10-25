import React, { useMemo } from "react";
import { Img, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { useMap } from "./MapView";
import { routeGeometry, routeHead, routePathD, project3D, type RouteGeometry } from "./routeGeometry";
import { VehicleGlyph, PinGlyph, type Vehicle } from "./icons";
import type { LonLat } from "../lib/places";
import { clamp, easeOutBack, easeOutCubic, easeOutElastic } from "../lib/geo";
import { font } from "../lib/fonts";
import { resolveMedia } from "../lib/media";

export const ROUTE_STYLES = ["solid", "glow", "dashed", "dotted", "particles", "ink", "neon", "double"] as const;
export type RouteStyle = (typeof ROUTE_STYLES)[number];

let uid = 0;
const useId = (p: string) => useMemo(() => `${p}${++uid}`, [p]);

export function useRouteGeometry(coords: LonLat[], lift = 0) {
  const m = useMap();
  return useMemo(() => routeGeometry(m, coords, lift), [m, coords, lift]);
}

type RouteProps = {
  coords: LonLat[];
  /** Fraction of the route drawn (true distance). */
  progress: number;
  /** Fraction where the visible tail starts (for comet-like trails). */
  tail?: number;
  color?: string;
  width?: number;
  style?: RouteStyle;
  lift?: number;
  /** Faint full route drawn underneath (the "plan"). */
  ghost?: boolean;
  /** Ground shadow for lifted flights. */
  shadow?: boolean;
  geometry?: RouteGeometry;
};

export const RouteLine: React.FC<RouteProps> = ({
  coords,
  progress,
  tail = 0,
  color,
  width = 6,
  style = "glow",
  lift = 0,
  ghost = true,
  shadow = true,
  geometry,
}) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const own = useRouteGeometry(coords, lift);
  const g = geometry ?? own;
  const ground = useRouteGeometry(coords, 0);
  const id = useId("route");
  const c = color ?? m.theme.route;
  const jump = m.width * 0.5;
  const p = clamp(progress);
  if (p <= 0 && !ghost) return null;
  const d = routePathD(g, clamp(tail), p, jump);
  const full = ghost ? routePathD(g, 0, 1, jump) : "";
  const shadowD = lift > 0 && shadow ? routePathD(ground, clamp(tail), p, jump) : "";
  const dash = style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `0 ${width * 2.2}` : undefined;

  return (
    <g>
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={width * 1.1} />
        </filter>
        <filter id={`${id}-ink`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale={width * 0.9} />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      {ghost && full ? (
        <path d={full} fill="none" stroke={c} strokeOpacity={0.22} strokeWidth={width * 0.6} strokeDasharray={`${width} ${width * 1.4}`} strokeLinecap="round" />
      ) : null}
      {shadowD ? <path d={shadowD} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={width * 0.7} strokeLinecap="round" strokeDasharray={`${width * 1.5} ${width}`} /> : null}
      {style === "glow" || style === "neon" ? (
        <path d={d} fill="none" stroke={style === "neon" ? c : m.theme.routeGlow} strokeWidth={width * (style === "neon" ? 2.4 : 3)} strokeLinecap="round" filter={`url(#${id}-glow)`} opacity={style === "neon" ? 0.9 : 1} />
      ) : null}
      {style === "double" ? <path d={d} fill="none" stroke="#ffffff" strokeWidth={width * 1.9} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {style === "ink" ? (
        <g filter={`url(#${id}-ink)`}>
          <path d={d} fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={width * 1.8} strokeLinecap="round" />
          <path d={d} fill="none" stroke={c} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${width * 3.2} ${width * 2}`} />
        </g>
      ) : style === "particles" ? (
        <Particles g={g} progress={p} tail={tail} color={c} width={width} frame={frame} jump={jump} />
      ) : (
        <path
          d={d}
          fill="none"
          stroke={style === "neon" ? "#ffffff" : c}
          strokeWidth={style === "neon" ? width * 0.55 : width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dash}
          strokeDashoffset={style === "dashed" ? -frame * width * 0.6 : 0}
        />
      )}
    </g>
  );
};

const Particles: React.FC<{ g: RouteGeometry; progress: number; tail: number; color: string; width: number; frame: number; jump: number }> = ({
  g,
  progress,
  tail,
  color,
  width,
  frame,
  jump,
}) => {
  const n = 60;
  const items = [];
  for (let i = 0; i < n; i++) {
    const t = tail + ((i / n + frame * 0.004) % 1) * (progress - tail);
    const h = routeHead(g, t);
    if (!h.on) continue;
    const r = width * (0.25 + 0.5 * ((i * 37) % 10) / 10);
    items.push(<circle key={i} cx={h.x} cy={h.y} r={r} fill={color} opacity={0.35 + 0.65 * ((t - tail) / Math.max(0.001, progress - tail))} />);
  }
  return (
    <g>
      <path d={routePathD(g, tail, progress, jump)} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={width * 0.5} />
      {items}
    </g>
  );
};

/** A vehicle riding the route at `progress`, rotated to the direction of travel. */
export const VehicleMarker: React.FC<{
  coords: LonLat[];
  progress: number;
  type: Vehicle;
  size?: number;
  color?: string;
  lift?: number;
  /** Keep icons upright for side-view vehicles: flips instead of rotating past vertical. */
  geometry?: RouteGeometry;
}> = ({ coords, progress, type, size = 64, color, lift = 0, geometry }) => {
  const m = useMap();
  const own = useRouteGeometry(coords, lift);
  const g = geometry ?? own;
  const h = routeHead(g, progress);
  if (!h.on) return null;
  const s = size / 100;
  // Larger when high above the ground on lifted routes.
  const altScale = lift > 0 ? 1 + 0.35 * Math.sin(Math.PI * clamp(progress)) * lift : 1;
  return (
    <g transform={`translate(${h.x},${h.y})`}>
      {lift > 0 ? (
        <ellipse rx={size * 0.3} ry={size * 0.12} cy={size * 0.45 * altScale} fill="rgba(0,0,0,0.25)" />
      ) : null}
      <g transform={`rotate(${h.angle}) scale(${s * altScale})`} style={{ filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.35))" }}>
        <VehicleGlyph type={type} color={color ?? m.theme.accent} />
      </g>
    </g>
  );
};

/** Point marker with optional drop, pulse rings and label. */
export const Pin: React.FC<{
  at: LonLat;
  label?: string;
  sublabel?: string;
  /** Frame (relative to the scene) at which the pin drops. */
  start?: number;
  color?: string;
  size?: number;
  pulse?: boolean;
  variant?: "pin" | "dot" | "target" | "flag";
  labelSide?: "right" | "left" | "top";
}> = ({ at, label, sublabel, start = 0, color, size = 56, pulse = true, variant = "pin", labelSide = "right" }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || !m.visible(at)) return null;
  const q = project3D(m, at);
  const c = color ?? m.theme.accent;
  const drop = easeOutBack(clamp(t / 14), 2.2);
  const y0 = (1 - drop) * -120;
  const lab = easeOutCubic(clamp((t - 8) / 14));
  const rings = pulse
    ? [0, 1, 2].map((i) => {
        const k = ((t + i * 20) % 60) / 60;
        return <circle key={i} r={size * (0.2 + k * 1.6)} fill="none" stroke={c} strokeWidth={3} opacity={(1 - k) * 0.8} />;
      })
    : null;
  const lx = labelSide === "left" ? -size * 0.7 : labelSide === "top" ? 0 : size * 0.7;
  const ly = variant === "pin" ? -size * 0.7 : labelSide === "top" ? -size * 0.8 : 0;
  return (
    <g transform={`translate(${q.x},${q.y})`}>
      {rings}
      <ellipse rx={size * 0.22} ry={size * 0.08} fill="rgba(0,0,0,0.3)" opacity={drop} />
      <g transform={`translate(0,${y0})`} opacity={clamp(t / 4)}>
        {variant === "pin" ? <PinGlyph color={c} size={size} /> : null}
        {variant === "dot" ? <circle r={size * 0.22} fill={c} stroke="#fff" strokeWidth={size * 0.08} /> : null}
        {variant === "target" ? (
          <g stroke={c} strokeWidth={3} fill="none">
            <circle r={size * 0.35} />
            <circle r={size * 0.1} fill={c} />
            <path d={`M${-size * 0.6} 0 H${-size * 0.2} M${size * 0.2} 0 H${size * 0.6} M0 ${-size * 0.6} V${-size * 0.2} M0 ${size * 0.2} V${size * 0.6}`} />
          </g>
        ) : null}
        {variant === "flag" ? (
          <g>
            <line x1={0} y1={0} x2={0} y2={-size} stroke="#333" strokeWidth={3} />
            <path d={`M0 ${-size} L${size * 0.7} ${-size * 0.82} L0 ${-size * 0.62} Z`} fill={c} />
          </g>
        ) : null}
      </g>
      {label ? (
        <g opacity={lab} transform={`translate(${lx + (1 - lab) * 12 * (labelSide === "left" ? 1 : -1)},${ly})`}>
          <text
            x={0}
            y={0}
            textAnchor={labelSide === "left" ? "end" : labelSide === "top" ? "middle" : "start"}
            dominantBaseline="middle"
            style={{ font: `700 ${size * 0.55}px ${font(m.theme.titleFont)}`, paintOrder: "stroke", letterSpacing: 0.5 }}
            fill={m.theme.label}
            stroke={m.theme.labelHalo}
            strokeWidth={size * 0.12}
            strokeLinejoin="round"
          >
            {label}
          </text>
          {sublabel ? (
            <text
              x={0}
              y={size * 0.55}
              textAnchor={labelSide === "left" ? "end" : labelSide === "top" ? "middle" : "start"}
              dominantBaseline="middle"
              style={{ font: `500 ${size * 0.32}px ${font(m.theme.labelFont)}`, paintOrder: "stroke" }}
              fill={m.theme.label}
              stroke={m.theme.labelHalo}
              strokeWidth={size * 0.08}
              strokeLinejoin="round"
              opacity={0.85}
            >
              {sublabel}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  );
};

/** Expanding radar rings with a crosshair: the "target acquired" marker. */
export const RadarMarker: React.FC<{ at: LonLat; start?: number; color?: string; size?: number; label?: string }> = ({
  at,
  start = 0,
  color,
  size = 120,
  label,
}) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || !m.visible(at)) return null;
  const q = project3D(m, at);
  const c = color ?? m.theme.accent;
  const pop = easeOutElastic(clamp(t / 30));
  const sweep = (t * 6) % 360;
  return (
    <g transform={`translate(${q.x},${q.y})`}>
      {[0, 1, 2, 3].map((i) => {
        const k = ((t + i * 15) % 60) / 60;
        return <circle key={i} r={size * k} fill="none" stroke={c} strokeWidth={2.5} opacity={(1 - k) * 0.9} />;
      })}
      <g transform={`scale(${pop})`}>
        <circle r={size * 0.45} fill={c} opacity={0.08} />
        <path d={`M0 0 L${size * 0.45} 0 A${size * 0.45} ${size * 0.45} 0 0 0 ${size * 0.45 * Math.cos(-0.6)} ${size * 0.45 * Math.sin(-0.6)} Z`} fill={c} opacity={0.35} transform={`rotate(${sweep})`} />
        <circle r={size * 0.45} fill="none" stroke={c} strokeWidth={2} strokeDasharray="6 6" />
        <circle r={size * 0.08} fill={c} stroke="#fff" strokeWidth={3} />
        <path d={`M${-size * 0.6} 0 H${-size * 0.5} M${size * 0.5} 0 H${size * 0.6} M0 ${-size * 0.6} V${-size * 0.5} M0 ${size * 0.5} V${size * 0.6}`} stroke={c} strokeWidth={3} />
      </g>
      {label ? (
        <text
          y={-size * 0.62}
          textAnchor="middle"
          style={{ font: `700 ${size * 0.2}px ${font(m.theme.titleFont)}`, letterSpacing: 2, paintOrder: "stroke" }}
          fill={m.theme.label}
          stroke={m.theme.labelHalo}
          strokeWidth={5}
          opacity={clamp((t - 10) / 10)}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

/** Callout box linked to a map point, optionally with a photo or video preview. */
export const Callout: React.FC<{
  at: LonLat;
  title: string;
  text?: string;
  media?: string;
  start?: number;
  dx?: number;
  dy?: number;
  width?: number;
  color?: string;
}> = ({ at, title, text, media, start = 0, dx = 220, dy = -180, width = 420, color }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || !m.visible(at)) return null;
  const q = project3D(m, at);
  const c = color ?? m.theme.accent;
  const line = easeOutCubic(clamp(t / 12));
  const box = easeOutBack(clamp((t - 10) / 16));
  const bx = q.x + dx;
  const by = q.y + dy;
  const src = media ? resolveMedia(media) : null;
  const isVideo = !!media && /\.(mp4|webm|mov|m4v)$/i.test(media);
  const mediaH = src ? width * 0.56 : 0;
  const boxH = mediaH + (text ? 120 : 76);
  const ex = q.x + dx * line;
  const ey = q.y + dy * line;
  return (
    <g>
      <circle cx={q.x} cy={q.y} r={9} fill={c} stroke="#fff" strokeWidth={3} />
      <path d={`M${q.x} ${q.y} L${ex} ${ey}`} stroke={c} strokeWidth={3} />
      <foreignObject x={dx >= 0 ? bx : bx - width} y={by - boxH / 2} width={width} height={boxH} style={{ overflow: "visible" }}>
        <div
          style={{
            transform: `scale(${box})`,
            transformOrigin: dx >= 0 ? "left center" : "right center",
            opacity: clamp(box * 1.5),
            background: "rgba(12,16,22,0.88)",
            borderLeft: `6px solid ${c}`,
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            color: "white",
            fontFamily: font(m.theme.labelFont),
          }}
        >
          {src ? (
            <div style={{ width: "100%", height: mediaH, overflow: "hidden", background: "#000" }}>
              {isVideo ? (
                <Video src={src} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
              ) : (
                <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
          ) : null}
          <div style={{ padding: "14px 18px" }}>
            <div style={{ font: `700 30px ${font(m.theme.titleFont)}`, letterSpacing: 0.5 }}>{title}</div>
            {text ? <div style={{ font: `400 21px ${font(m.theme.labelFont)}`, opacity: 0.85, marginTop: 6, lineHeight: 1.3 }}>{text}</div> : null}
          </div>
        </div>
      </foreignObject>
    </g>
  );
};
