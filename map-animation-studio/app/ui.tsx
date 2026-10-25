import React, { useEffect, useRef, useState } from "react";
import type { Group, LayerType } from "./model";

/* ---------- icons (24px stroke, lucide-style) ---------- */

const PATHS: Record<string, React.ReactNode> = {
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  export: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
  save: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>,
  play: <path d="M7 4v16l13-8z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>,
  start: <><path d="M6 5v14" /><path d="M19 5v14L9 12z" fill="currentColor" stroke="none" /></>,
  end: <><path d="M18 5v14" /><path d="M5 5v14l10-7z" fill="currentColor" stroke="none" /></>,
  prev: <path d="m15 6-6 6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  split: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  key: <path d="M12 3 21 12 12 21 3 12z" />,
  rec: <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  camera: <><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.5" /></>,
  upload: <path d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5 9-10" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  magnet: <path d="M6 3v9a6 6 0 0 0 12 0V3h-4v9a2 2 0 0 1-4 0V3zM6 7h4M14 7h4" />,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  pin: <><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  route: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" /></>,
  radar: <><circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="10" /></>,
  callout: <><path d="M4 4h16v11H9l-5 5z" /><path d="M8 9h8M8 12h5" /></>,
  arrow: <path d="M3 17c4-1 7-4 9-9l-3-1 7-4 1 8-3-2c-2 5-6 8-11 10z" />,
  label: <path d="M5 6h14M12 6v13M8 19h8" />,
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h6M7 14h10" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4c4-2 6 2 10 0s4-1 4-1v9s-1-1-4 1-6-2-10 0" /></>,
  counter: <><path d="M4 7h3v10M10 7h4a2 2 0 0 1 0 4h-3a2 2 0 0 0-2 2v4h7M19 7v10" /></>,
  hud: <><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /><circle cx="12" cy="12" r="3" /></>,
  sound: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" /></>,
  scene: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4l-2 5M14 4l-2 5M20 4l-2 5" /></>,
  area: <path d="M5 7l5-3 5 3 4-2v12l-4 2-5-3-5 3V7zM10 4v13M15 7v12" />,
  regionmedia: <><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" /><path d="M9 4v14M15 6v14" /><path d="M5 12h3M16 11h3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  loop: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
};

export const Icon: React.FC<{ name: string; size?: number }> = ({ name, size }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden>
    {PATHS[name] ?? PATHS.layers}
  </svg>
);

export const LAYER_ICON: Record<LayerType, string> = {
  highlight: "area",
  "region-media": "regionmedia",
  route: "route",
  pin: "pin",
  radar: "radar",
  callout: "callout",
  arrow: "arrow",
  "map-label": "label",
  text: "text",
  "location-card": "card",
  image: "image",
  video: "film",
  flag: "flag",
  counter: "counter",
  hud: "hud",
  sfx: "sound",
  scene: "scene",
};

export const GROUP_COLOR: Record<Group, string> = { map: "var(--map)", screen: "var(--screen)", audio: "var(--audio)", scene: "var(--scene)" };

/* ---------- form controls ---------- */

export const Field: React.FC<{ label: React.ReactNode; value?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, value, hint, children }) => (
  <label className="f" onClick={(e) => (e.target as HTMLElement).tagName === "LABEL" && e.preventDefault()}>
    <span className="fl">
      <span>{label}</span>
      {value !== undefined ? <b>{value}</b> : null}
    </span>
    {children}
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
);

/** Number input that only commits valid numbers, so typing "-" or "0." is not fought. */
export const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; style?: React.CSSProperties }> = ({ value, onChange, min, max, step, style }) => {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0));
  }, [value]);
  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step ?? "any"}
      style={style}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(String(Math.round(value * 1000) / 1000));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(clampOpt(v, min, max));
      }}
    />
  );
};

const clampOpt = (v: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));

export const Slider: React.FC<{ label: React.ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: React.ReactNode; fmt?: (v: number) => string }> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  fmt,
}) => (
  <div className="f">
    <span className="fl">
      <span>{label}</span>
    </span>
    <div className="rowf">
      <input type="range" min={min} max={max} step={step ?? (max - min) / 200} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={typeof label === "string" ? label : undefined} />
      <NumberInput value={value} min={min} max={max} step={step} onChange={onChange} style={{ width: 70, flex: "none" }} />
    </div>
    {fmt ? <span className="hint">{fmt(value)}</span> : null}
    {hint ? <span className="hint">{hint}</span> : null}
  </div>
);

export const Toggle: React.FC<{ label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="chk">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

export function Seg<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

const NAMED: Record<string, string> = { white: "#ffffff", black: "#000000", red: "#ff0000" };
const toHex = (c: string) => {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  return NAMED[c] ?? "#ffb347";
};

/** Colour picker plus text, with an "auto" (theme colour) choice. */
export const ColorInput: React.FC<{ value: string; onChange: (v: string) => void; allowAuto?: boolean }> = ({ value, onChange, allowAuto = true }) => {
  const isAuto = !value || value === "auto";
  return (
    <div className="rowf">
      <input type="color" value={isAuto ? "#ffb347" : toHex(value)} onChange={(e) => onChange(e.target.value)} style={{ opacity: isAuto ? 0.45 : 1 }} aria-label="Colour" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="auto" />
      {allowAuto ? (
        <button type="button" className={`btn sm ${isAuto ? "on" : ""}`} onClick={() => onChange("auto")} title="Use the theme colour">
          Auto
        </button>
      ) : null}
    </div>
  );
};

/** Small dropdown menu anchored to a button. */
export const Menu: React.FC<{ button: (open: () => void, isOpen: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; up?: boolean }> = ({
  button,
  children,
  align = "left",
  up,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      {button(() => setOpen((o) => !o), open)}
      {open ? <div className={`menu ${align === "right" ? "right" : ""} ${up ? "up" : ""}`}>{children(() => setOpen(false))}</div> : null}
    </div>
  );
};

export const Dialog: React.FC<{ title: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, onClose, wide, children }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dlg ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <h2>
          {title}
          <span className="sp" />
          <button className="btn icon ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </h2>
        {children}
      </div>
    </div>
  );
};
