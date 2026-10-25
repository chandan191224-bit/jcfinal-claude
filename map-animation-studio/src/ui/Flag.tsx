import React from "react";
import { useCurrentFrame } from "remotion";

/**
 * A flag (or any image) waving in the wind: the picture is cut into vertical strips that ride a
 * travelling sine wave, with matching light and shadow. Deterministic per frame.
 */
export const WavingFlag: React.FC<{
  src: string;
  width: number;
  height: number;
  /** Wave height as a fraction of the flag height. */
  amplitude?: number;
  speed?: number;
  strips?: number;
  wave?: boolean;
}> = ({ src, width, height, amplitude = 0.05, speed = 1, strips = 48, wave = true }) => {
  const frame = useCurrentFrame();
  const sw = width / strips;
  const items = [];
  for (let i = 0; i < strips; i++) {
    const x = i * sw;
    // Pinned at the hoist (left), free at the fly end.
    const k = wave ? Math.min(1, (i + 0.5) / strips + 0.15) : 0;
    const phase = (i / strips) * Math.PI * 3 - frame * 0.16 * speed;
    const dy = Math.sin(phase) * amplitude * height * k;
    const slope = Math.cos(phase) * k;
    const light = wave ? slope * 0.22 : 0;
    items.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: dy,
          width: sw + 0.8,
          height,
          backgroundImage: `url("${src}")`,
          backgroundSize: `${width}px ${height}px`,
          backgroundPosition: `${-x}px 0px`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: light > 0 ? `rgba(255,255,255,${light})` : `rgba(0,0,0,${-light * 1.4})`,
          }}
        />
      </div>,
    );
  }
  return <div style={{ position: "relative", width, height, overflow: "visible" }}>{items}</div>;
};
