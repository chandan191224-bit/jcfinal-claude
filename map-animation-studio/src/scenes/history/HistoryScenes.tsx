import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { GeoProjection } from "d3-geo";
import { MapView, MapOverlay, findCountry, useMap, type CanvasPainter } from "../../map/MapView";
import { highlightDefaults, useAreaHighlights, type HighlightSpec } from "../../map/useAreaHighlights";
import { routeGeometry, routeHead, routePathD, project3D } from "../../map/routeGeometry";
import { base, zProjection } from "../../lib/schema";
import { THEMES, type Theme } from "../../lib/themes";
import { fitCamera, type Camera } from "../../lib/camera";
import { clamp, easeInOutCubic, easeOutCubic, greatCircle, lerp } from "../../lib/geo";
import { parseCoords, type LonLat } from "../../lib/places";
import { usePlaces } from "../../lib/useTrip";
import { Finish } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { font } from "../../lib/fonts";

/* ---------------- shared ---------------- */

/** "lat, lon; lat, lon; ..." → coordinates. */
const parseLine = (s: string): LonLat[] =>
  s
    .split(";")
    .map((x) => parseCoords(x.trim()))
    .filter((x): x is LonLat => !!x);

function resample(line: LonLat[], n: number): LonLat[] {
  if (line.length < 2) return Array.from({ length: n }, () => line[0] ?? [0, 0]);
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const L = cum[cum.length - 1];
  return Array.from({ length: n }, (_, k) => {
    const d = (k / (n - 1)) * L;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    return [lerp(line[i - 1][0], line[i][0], f), lerp(line[i - 1][1], line[i][1], f)] as LonLat;
  });
}

const DateTicker: React.FC<{ text: string; sub?: string; color: string; fontName: string; theme: Theme }> = ({ text, sub, color, fontName, theme }) => {
  const { height } = useVideoConfig();
  const u = height / 1080;
  return (
    <div style={{ position: "absolute", right: 90 * u, top: 70 * u, textAlign: "right", color: theme.label, textShadow: `0 2px 18px ${theme.labelHalo}, 0 0 4px ${theme.labelHalo}` }}>
      <div style={{ font: `700 ${96 * u}px ${font(fontName)}`, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{text}</div>
      <div style={{ height: 5 * u, background: color, marginTop: 8 * u }} />
      {sub ? <div style={{ font: `500 ${28 * u}px ${font("Inter")}`, marginTop: 10 * u, opacity: 0.9, maxWidth: 700 * u }}>{sub}</div> : null}
    </div>
  );
};

/* ---------------- Frontline shift ---------------- */

export const frontlineSchema = z.object({
  ...base,
  projection: zProjection,
  frame: z.array(z.string()).describe("Places/coordinates the camera frames"),
  clipTo: z.array(z.string()).describe("Countries the territory shading is limited to (empty = all land)"),
  sideA: z.object({ name: z.string(), color: z.string(), holds: z.enum(["north", "south", "east", "west"]) }),
  sideB: z.object({ name: z.string(), color: z.string() }),
  lines: z
    .array(z.object({ atSec: z.number(), points: z.string().describe('"lat, lon; lat, lon; ..." from one end of the front to the other'), label: z.string() }))
    .describe("Front line positions over time; the area between them animates"),
  arrows: z.array(
    z.object({
      path: z.string().describe('"lat, lon; lat, lon; ..." start → end'),
      startSec: z.number(),
      endSec: z.number(),
      side: z.enum(["A", "B"]),
      label: z.string(),
    }),
  ),
  title: z.string(),
});


export const FrontlineShift: React.FC<z.infer<typeof frontlineSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const framed = usePlaces(p.frame);
  const lines = useMemo(() => p.lines.map((l) => ({ at: l.atSec * fps, pts: resample(parseLine(l.points), 64), label: l.label })), [p.lines, fps]);
  const camera = useMemo<Camera | null>(() => (framed ? fitCamera(p.projection, framed.map((x) => [x.lon, x.lat] as LonLat), width, height, 0.1) : null), [framed, p.projection, width, height]);
  if (!camera || lines.length === 0) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;

  // Current front: interpolate between keyframes.
  let cur = lines[0].pts;
  let label = lines[0].label;
  for (let i = 1; i < lines.length; i++) {
    if (frame >= lines[i - 1].at) {
      const t = easeInOutCubic(clamp((frame - lines[i - 1].at) / Math.max(1, lines[i].at - lines[i - 1].at)));
      cur = lines[i - 1].pts.map((q, k) => [lerp(q[0], lines[i].pts[k][0], t), lerp(q[1], lines[i].pts[k][1], t)] as LonLat);
      if (t > 0.5) label = lines[i].label;
    }
  }
  // Territory polygons: the front line closed off far away on each side.
  const holds = p.sideA.holds;
  const ns = holds === "north" || holds === "south";
  const line = ns ? (cur[0][0] <= cur[cur.length - 1][0] ? cur : [...cur].reverse()) : cur[0][1] <= cur[cur.length - 1][1] ? cur : [...cur].reverse();
  const a = line[0];
  const b = line[line.length - 1];
  const far = 60;
  const side = (dir: 1 | -1): LonLat[] =>
    ns
      ? [...line, [b[0] + far, b[1]], [b[0] + far, b[1] + dir * far], [a[0] - far, a[1] + dir * far], [a[0] - far, a[1]]]
      : [...line, [b[0], b[1] + far], [b[0] + dir * far, b[1] + far], [a[0] + dir * far, a[1] - far], [a[0], a[1] - far]];
  const aDir = holds === "north" || holds === "east" ? 1 : -1;
  const polyA = side(aDir as 1 | -1);
  const polyB = side(-aDir as 1 | -1);
  const paint: CanvasPainter = (ctx, path, projection, world) => {
    const land = p.clipTo.length ? p.clipTo.map((c) => findCountry(world, c, "hi")).filter((f): f is NonNullable<typeof f> => !!f) : world.mid.countries;
    const fillPoly = (poly: LonLat[], color: string) => {
      ctx.save();
      ctx.beginPath();
      for (const f of land) path(f);
      ctx.clip();
      ctx.beginPath();
      drawPlanarPoly(ctx, projection, poly);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.42;
      ctx.fill();
      ctx.restore();
    };
    fillPoly(polyA, p.sideA.color);
    fillPoly(polyB, p.sideB.color);
  };
  const reveal = clamp(frame / 20);
  return (
    <AbsoluteFill>
      <MapView kind={p.projection} camera={{ ...camera, zoom: camera.zoom + 0.05 * (frame / (p.durationSec * fps)) }} theme={theme} borderView={p.borders} paint={paint} layers={{ countryLabels: true, rivers: true }}>
        <MapOverlay>
          <FrontLine pts={cur} color={theme.route} opacity={reveal} />
          {p.arrows.map((a, i) => (
            <MilitaryArrow key={i} path={parseLine(a.path)} start={a.startSec * fps} end={a.endSec * fps} color={a.side === "A" ? p.sideA.color : p.sideB.color} label={a.label} />
          ))}
        </MapOverlay>
      </MapView>
      <Finish theme={theme} />
      <Legend items={[{ name: p.sideA.name, color: p.sideA.color }, { name: p.sideB.name, color: p.sideB.color }]} title={p.title} fontName={theme.titleFont} />
      {label ? <DateTicker text={label} color={theme.accent} fontName={theme.titleFont} theme={theme} /> : null}
      {p.arrows.map((a, i) => (
        <Sfx key={i} name="whoosh-down" at={a.startSec * fps} volume={p.sfxVolume * 0.6} enabled={p.sfx} />
      ))}
      {lines.slice(1).map((l, i) => (
        <Sfx key={`l${i}`} name="impact" at={l.at - 4} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
      ))}
    </AbsoluteFill>
  );
};

/** Draws a polygon in projected space with straight screen edges (big, far-reaching helper polygons). */
function drawPlanarPoly(ctx: CanvasRenderingContext2D, projection: GeoProjection, poly: LonLat[]) {
  poly.forEach((p, i) => {
    const q = projection([Math.max(-179.9, Math.min(179.9, p[0])), Math.max(-85, Math.min(85, p[1]))]);
    if (!q) return;
    if (i === 0) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
  });
  ctx.closePath();
}

const FrontLine: React.FC<{ pts: LonLat[]; color: string; opacity: number }> = ({ pts, color, opacity }) => {
  const m = useMap();
  const scr = pts.map((p) => project3D(m, p));
  const d = scr.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join("");
  // Saw-tooth "teeth" along the line, like military maps.
  const teeth = scr.slice(1).map((q, i) => {
    const a = scr[i];
    const mx = (a.x + q.x) / 2;
    const my = (a.y + q.y) / 2;
    const dx = q.x - a.x;
    const dy = q.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    return `M${a.x + dx * 0.3},${a.y + dy * 0.3} L${mx - (dy / L) * 9},${my + (dx / L) * 9} L${a.x + dx * 0.7},${a.y + dy * 0.7}`;
  });
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={9} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" />
      <path d={teeth.join("")} fill="none" stroke={color} strokeWidth={3} />
    </g>
  );
};

export const MilitaryArrow: React.FC<{ path: LonLat[]; start: number; end: number; color: string; label?: string; width?: number }> = ({ path, start, end, color, label, width = 26 }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const g = useMemo(() => routeGeometry(m, path, 0.35), [m, path]);
  if (path.length < 2 || frame < start) return null;
  const t = easeOutCubic(clamp((frame - start) / Math.max(1, end - start)));
  const fade = 1 - 0.65 * clamp((frame - end - 45) / 30);
  const head = routeHead(g, t);
  const body = routePathD(g, 0, Math.max(0.001, t - 0.02), m.width);
  const a = (head.angle * Math.PI) / 180;
  const hw = width * 1.25;
  const hl = width * 1.6;
  const tip = [head.x + Math.cos(a) * hl * 0.55, head.y + Math.sin(a) * hl * 0.55];
  const back = [head.x - Math.cos(a) * hl * 0.45, head.y - Math.sin(a) * hl * 0.45];
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const headD = `M${tip[0]},${tip[1]} L${back[0] + nx * hw},${back[1] + ny * hw} L${back[0] - nx * hw},${back[1] - ny * hw} Z`;
  return (
    <g opacity={fade}>
      <path d={body} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={width + 8} strokeLinecap="butt" strokeLinejoin="round" />
      <path d={body} fill="none" stroke={color} strokeWidth={width} strokeLinecap="butt" strokeLinejoin="round" opacity={0.92} />
      <path d={headD} fill={color} stroke="rgba(0,0,0,0.45)" strokeWidth={4} strokeLinejoin="round" />
      {label && t > 0.6 ? (
        <text x={head.x} y={head.y - width * 1.6} textAnchor="middle" fill="white" stroke="rgba(0,0,0,0.7)" strokeWidth={5} paintOrder="stroke" style={{ font: `700 ${width * 1.1}px ${font("Teko")}`, letterSpacing: 1 }} opacity={clamp((t - 0.6) / 0.3)}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

const Legend: React.FC<{ items: { name: string; color: string }[]; title?: string; fontName: string }> = ({ items, title, fontName }) => {
  const { height } = useVideoConfig();
  const u = height / 1080;
  return (
    <div style={{ position: "absolute", left: 90 * u, top: 70 * u, color: "white", textShadow: "0 3px 14px rgba(0,0,0,0.7)" }}>
      {title ? <div style={{ font: `700 ${64 * u}px ${font(fontName)}`, marginBottom: 14 * u }}>{title}</div> : null}
      {items.map((it) => (
        <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 14 * u, font: `600 ${28 * u}px ${font("Inter")}`, marginTop: 8 * u }}>
          <span style={{ width: 30 * u, height: 22 * u, background: it.color, border: "2px solid white", display: "inline-block" }} />
          {it.name}
        </div>
      ))}
    </div>
  );
};

/* ---------------- Empire / boundary expansion ---------------- */

export const expansionSchema = z.object({
  ...base,
  projection: zProjection,
  frame: z.array(z.string()).describe("Cities or coordinates at the edges of the area to frame"),
  steps: z.array(
    z.object({
      label: z.string().describe("Year or date shown on the ticker"),
      caption: z.string(),
      atSec: z.number(),
      action: z.enum(["add", "remove"]),
      regions: z.array(z.string()).describe("Countries, states, or file:areas/x.geojson"),
      color: z.string(),
    }),
  ),
  highlightNew: z.boolean().describe("Outline flash on newly added regions"),
  title: z.string(),
  note: z.string().describe("Small source/accuracy note"),
});

export const EmpireExpansion: React.FC<z.infer<typeof expansionSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const specs = useMemo(() => {
    const out: HighlightSpec[] = [];
    for (const st of p.steps) {
      if (st.action === "remove") {
        for (const r of st.regions) {
          const prev = [...out].reverse().find((s) => s.target === r && s.endSec === 0 && s.style === "fill");
          if (prev) prev.endSec = st.atSec + 0.6;
        }
        continue;
      }
      for (const r of st.regions) {
        out.push(highlightDefaults({ target: r, style: "fill", color: st.color, startSec: st.atSec, label: "" }));
        if (p.highlightNew) out.push(highlightDefaults({ target: r, style: "glow", color: "#ffffff", startSec: st.atSec, endSec: st.atSec + 1.4, label: "" }));
      }
    }
    return out;
  }, [p.steps, p.highlightNew]);
  const areas = useAreaHighlights(specs, frame, fps, theme, p.borders);
  const framed = usePlaces(p.frame);
  const camera = useMemo<Camera | null>(() => {
    if (!framed) return null;
    const pts = framed.map((x) => [x.lon, x.lat] as LonLat);
    return pts.length ? fitCamera(p.projection, pts, width, height, 0.08) : null;
  }, [framed, p.projection, width, height]);
  if (!camera) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;
  const current = [...p.steps].reverse().find((s) => frame >= s.atSec * fps) ?? p.steps[0];
  return (
    <AbsoluteFill>
      <MapView kind={p.projection} camera={camera} theme={theme} borderView={p.borders} areas={areas} layers={{ countryLabels: true }} />
      <Finish theme={theme} />
      {p.title ? (
        <div style={{ position: "absolute", left: 90, top: 70, font: `700 ${height * 0.06}px ${font(theme.titleFont)}`, color: theme.label, textShadow: `0 0 16px ${theme.labelHalo}` }}>{p.title}</div>
      ) : null}
      {current ? <DateTicker text={current.label} sub={current.caption} color={current.color} fontName={theme.titleFont} theme={theme} /> : null}
      {p.note ? <div style={{ position: "absolute", left: 90, bottom: 40, font: `400 ${height * 0.018}px ${font("Inter")}`, color: theme.label, opacity: 0.7 }}>{p.note}</div> : null}
      {p.steps.map((s, i) => (
        <Sfx key={i} name={s.action === "add" ? "pop" : "whoosh-down"} at={s.atSec * fps} volume={p.sfxVolume} enabled={p.sfx} />
      ))}
    </AbsoluteFill>
  );
};

/* ---------------- Particle stream routes (migration, trade, flights) ---------------- */

export const particleSchema = z.object({
  ...base,
  projection: zProjection,
  frame: z.array(z.string()).describe("Places the camera frames (empty = all flow ends)"),
  flows: z.array(z.object({ from: z.string(), to: z.string(), value: z.number().min(0), color: z.string(), label: z.string() })),
  unit: z.string().describe('Shown after values, e.g. "million people"'),
  arc: z.number().min(0).max(1.5).describe("Height of the arcs"),
  density: z.number().min(0.2).max(3),
  title: z.string(),
  note: z.string(),
});

const Stream: React.FC<{ from: LonLat; to: LonLat; weight: number; color: string; label: string; arc: number; density: number; delay: number }> = ({ from, to, weight, color, label, arc, density, delay }) => {
  const m = useMap();
  const frame = useCurrentFrame();
  const g = useMemo(() => routeGeometry(m, [from, to], arc), [m, from, to, arc]);
  const t = frame - delay;
  if (t < 0) return null;
  const grow = easeOutCubic(clamp(t / 40));
  const w = 2 + weight * 14;
  const n = Math.round((10 + weight * 70) * density);
  const dots = [];
  for (let i = 0; i < n; i++) {
    const f = ((i / n + t * 0.006 * (1 + (i % 3) * 0.15)) % 1) * grow;
    const h = routeHead(g, f);
    if (!h.on) continue;
    const jitter = ((i * 7919) % 11) / 11 - 0.5;
    const a = ((h.angle + 90) * Math.PI) / 180;
    dots.push(<circle key={i} cx={h.x + Math.cos(a) * jitter * w} cy={h.y + Math.sin(a) * jitter * w} r={1.6 + weight * 2.6} fill={color} opacity={0.85} />);
  }
  const end = routeHead(g, 1);
  return (
    <g>
      <path d={routePathD(g, 0, grow, m.width)} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={w} strokeLinecap="round" />
      <g style={{ filter: `drop-shadow(0 0 6px ${color})` }}>{dots}</g>
      {grow > 0.95 && label ? (
        <text x={end.x} y={end.y - 18} textAnchor="middle" fill="white" stroke="rgba(0,0,0,0.75)" strokeWidth={5} paintOrder="stroke" style={{ font: `700 24px ${font("Inter")}` }}>
          {label}
        </text>
      ) : null}
    </g>
  );
};

export const ParticleStreams: React.FC<z.infer<typeof particleSchema>> = (p) => {
  const { width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const names = useMemo(() => [...new Set(p.flows.flatMap((f) => [f.from, f.to]))], [p.flows]);
  const places = usePlaces([...names, ...p.frame]);
  const camera = useMemo<Camera | null>(() => {
    if (!places) return null;
    const framePl = p.frame.length ? places.slice(names.length) : places.slice(0, names.length);
    const pts = framePl.map((x) => [x.lon, x.lat] as LonLat);
    if (!p.frame.length)
      for (const f of p.flows) {
        const a = places[names.indexOf(f.from)];
        const b = places[names.indexOf(f.to)];
        pts.push(...greatCircle([a.lon, a.lat], [b.lon, b.lat], 8));
      }
    return fitCamera(p.projection, pts, width, height, 0.1);
  }, [places, names, p.frame, p.projection, width, height]);
  if (!places || !camera) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;
  const at = (n: string) => {
    const pl = places[names.indexOf(n)];
    return [pl.lon, pl.lat] as LonLat;
  };
  const max = Math.max(1, ...p.flows.map((f) => f.value));
  return (
    <AbsoluteFill>
      <MapView kind={p.projection} camera={camera} theme={theme} borderView={p.borders} layers={{ countryLabels: true, graticule: p.projection !== "mercator" }}>
        <MapOverlay>
          {p.flows.map((f, i) => (
            <Stream
              key={i}
              from={at(f.from)}
              to={at(f.to)}
              weight={f.value / max}
              color={f.color || theme.accent}
              label={f.label || `${f.value.toLocaleString("en-IN")} ${p.unit}`.trim()}
              arc={p.arc}
              density={p.density}
              delay={i * 8}
            />
          ))}
        </MapOverlay>
      </MapView>
      <Finish theme={theme} />
      {p.title ? (
        <div style={{ position: "absolute", left: 90, top: 70, font: `700 ${height * 0.055}px ${font(theme.titleFont)}`, color: theme.label, textShadow: `0 0 16px ${theme.labelHalo}` }}>{p.title}</div>
      ) : null}
      {p.note ? <div style={{ position: "absolute", left: 90, bottom: 40, font: `400 ${height * 0.018}px ${font("Inter")}`, color: theme.label, opacity: 0.7 }}>{p.note}</div> : null}
      <Sfx name="riser" at={0} volume={p.sfxVolume * 0.5} enabled={p.sfx} />
    </AbsoluteFill>
  );
};
