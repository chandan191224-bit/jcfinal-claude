import React from "react";

/**
 * Top-down vehicle icons drawn pointing right (east) inside a 100x100 box centred on 0,0,
 * so they can be rotated to the direction of travel.
 */
export const VEHICLES = [
  "plane",
  "jet",
  "helicopter",
  "car",
  "suv",
  "bus",
  "truck",
  "train",
  "bike",
  "scooter",
  "autorickshaw",
  "ship",
  "boat",
  "walker",
  "rocket",
  "dot",
] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const VehicleGlyph: React.FC<{ type: Vehicle; color: string; accent?: string }> = ({ type, color, accent = "#ffffff" }) => {
  const stroke = { stroke: "rgba(0,0,0,0.35)", strokeWidth: 1.5 } as const;
  switch (type) {
    case "plane":
      return (
        <g {...stroke} fill={color}>
          <path d="M46 0 C46 -5 40 -6 30 -6 L-30 -5 C-38 -5 -44 -3 -46 0 C-44 3 -38 5 -30 5 L30 6 C40 6 46 5 46 0 Z" />
          <path d="M10 -5 L-12 -46 L-22 -46 L-10 -5 Z" />
          <path d="M10 5 L-12 46 L-22 46 L-10 5 Z" />
          <path d="M-34 -4 L-44 -20 L-50 -20 L-44 -3 Z" />
          <path d="M-34 4 L-44 20 L-50 20 L-44 3 Z" />
          <path d="M42 -3 L46 0 L42 3 Z" fill={accent} />
        </g>
      );
    case "jet":
      return (
        <g {...stroke} fill={color}>
          <path d="M50 0 L20 -5 L-5 -40 L-15 -40 L-5 -5 L-35 -4 L-45 -18 L-50 -18 L-45 0 L-50 18 L-45 18 L-35 4 L-5 5 L-15 40 L-5 40 L20 5 Z" />
          <ellipse cx="25" cy="0" rx="8" ry="2.5" fill={accent} />
        </g>
      );
    case "helicopter":
      return (
        <g {...stroke} fill={color}>
          <ellipse cx="8" cy="0" rx="20" ry="12" />
          <rect x="-42" y="-3" width="36" height="6" rx="3" />
          <rect x="-46" y="-10" width="6" height="20" rx="2" />
          <g fill="none" stroke={color} strokeWidth="4" opacity="0.8">
            <line x1="-34" y1="-34" x2="50" y2="34" />
            <line x1="-34" y1="34" x2="50" y2="-34" />
          </g>
          <circle cx="8" cy="0" r="5" fill={accent} />
        </g>
      );
    case "car":
    case "suv":
      return (
        <g {...stroke}>
          <rect x="-34" y="-17" width="68" height="34" rx={type === "suv" ? 7 : 12} fill={color} />
          <path d="M8 -14 L20 -12 L20 12 L8 14 Z" fill="rgba(20,30,40,0.75)" />
          <path d="M-22 -13 L-12 -13 L-12 13 L-22 13 Z" fill="rgba(20,30,40,0.6)" />
          <rect x="30" y="-13" width="4" height="7" rx="2" fill="#fff7c2" />
          <rect x="30" y="6" width="4" height="7" rx="2" fill="#fff7c2" />
          <rect x="-34" y="-13" width="3" height="6" fill="#ff3b3b" />
          <rect x="-34" y="7" width="3" height="6" fill="#ff3b3b" />
        </g>
      );
    case "bus":
    case "truck":
      return (
        <g {...stroke}>
          <rect x="-46" y="-16" width="92" height="32" rx="6" fill={color} />
          {type === "bus" ? (
            <>
              {[-34, -20, -6, 8, 22].map((x) => (
                <rect key={x} x={x} y="-12" width="10" height="24" rx="2" fill="rgba(255,255,255,0.35)" />
              ))}
              <rect x="36" y="-13" width="8" height="26" rx="2" fill="rgba(20,30,40,0.7)" />
            </>
          ) : (
            <>
              <rect x="22" y="-15" width="22" height="30" rx="4" fill={accent} opacity="0.85" />
              <line x1="20" y1="-16" x2="20" y2="16" stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
            </>
          )}
        </g>
      );
    case "train":
      return (
        <g {...stroke}>
          {[-100, -50, 0].map((x, i) => (
            <rect key={x} x={x - 22} y="-12" width="46" height="24" rx={i === 2 ? 10 : 3} fill={color} />
          ))}
          <path d="M24 -10 Q36 0 24 10 Z" fill={color} />
          <rect x="10" y="-8" width="10" height="16" rx="2" fill="rgba(20,30,40,0.7)" />
          {[-118, -68, -18].map((x) => (
            <rect key={x} x={x} y="-3" width="30" height="6" fill={accent} opacity="0.7" />
          ))}
        </g>
      );
    case "bike":
    case "scooter":
      return (
        <g {...stroke}>
          <rect x="-30" y="-5" width="60" height="10" rx="5" fill="#222" />
          <rect x="-16" y="-10" width="30" height="20" rx="8" fill={color} />
          <circle cx="0" cy="0" r="9" fill={accent} />
          <line x1="18" y1="-14" x2="18" y2="14" stroke="#222" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "autorickshaw":
      return (
        <g {...stroke}>
          <path d="M-30 -18 L14 -18 Q34 -12 34 0 Q34 12 14 18 L-30 18 Z" fill="#1b1b1b" />
          <path d="M-26 -14 L10 -14 Q26 -10 26 0 Q26 10 10 14 L-26 14 Z" fill={color} />
          <rect x="-20" y="-12" width="22" height="24" rx="3" fill="#2a7a3a" />
        </g>
      );
    case "ship":
      return (
        <g {...stroke}>
          <path d="M50 0 L30 -16 L-46 -16 L-46 16 L30 16 Z" fill={color} />
          {[-36, -24, -12, 0, 12].map((x, i) => (
            <rect key={x} x={x} y="-12" width="10" height="24" fill={["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#e67e22"][i]} />
          ))}
          <rect x="18" y="-10" width="10" height="20" fill={accent} />
        </g>
      );
    case "boat":
      return (
        <g {...stroke}>
          <path d="M40 0 Q20 -14 -30 -12 L-34 0 L-30 12 Q20 14 40 0 Z" fill={color} />
          <rect x="-10" y="-6" width="18" height="12" rx="3" fill={accent} />
        </g>
      );
    case "walker":
      return (
        <g {...stroke}>
          <circle cx="0" cy="0" r="16" fill={color} />
          <circle cx="6" cy="0" r="6" fill={accent} />
          <path d="M-10 -10 L-22 -14 M-10 10 L-22 14" stroke={color} strokeWidth="6" strokeLinecap="round" />
        </g>
      );
    case "rocket":
      return (
        <g {...stroke}>
          <path d="M46 0 Q30 -14 -24 -12 L-24 12 Q30 14 46 0 Z" fill={color} />
          <path d="M-24 -12 L-40 -24 L-34 -8 Z M-24 12 L-40 24 L-34 8 Z" fill={accent} />
          <circle cx="16" cy="0" r="6" fill="#7fd3ff" />
          <path d="M-26 -6 L-50 0 L-26 6 Z" fill="#ffb347" />
        </g>
      );
    default:
      return <circle r="14" fill={color} stroke="#fff" strokeWidth="5" />;
  }
};

/** Map pin (teardrop) whose tip is at 0,0. */
export const PinGlyph: React.FC<{ color: string; size: number; inner?: string }> = ({ color, size, inner = "#ffffff" }) => {
  const s = size / 60;
  return (
    <g transform={`scale(${s})`}>
      <path d="M0 0 C-6 -16 -22 -26 -22 -40 A22 22 0 1 1 22 -40 C22 -26 6 -16 0 0 Z" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
      <circle cx="0" cy="-40" r="8.5" fill={inner} />
    </g>
  );
};
