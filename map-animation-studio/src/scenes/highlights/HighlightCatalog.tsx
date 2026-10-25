import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MapView } from "../../map/MapView";
import { HIGHLIGHT_STYLES } from "../../map/highlightStyles";
import { highlightDefaults, useAreaHighlights, useAreaShapes } from "../../map/useAreaHighlights";
import { shapePoints } from "./MapHighlights";
import { base } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { fitCamera } from "../../lib/camera";
import { font } from "../../lib/fonts";

export const catalogSchema = z.object({
  ...base,
  target: z.string().describe("Country or state shown in every cell"),
  color: z.string(),
});

/** Every highlight style at once, so you can pick one by eye. */
export const HighlightCatalog: React.FC<z.infer<typeof catalogSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[p.theme];
  const cols = 4;
  const rows = Math.ceil(HIGHLIGHT_STYLES.length / cols);
  const cw = Math.floor(width / cols);
  const ch = Math.floor(height / rows);
  const shapes = useAreaShapes([{ target: p.target, level: "auto", radiusKm: 0 }], p.borders);
  const cam = useMemo(() => (shapes ? fitCamera("mercator", shapePoints(shapes[0].feature), cw, ch, 0.14, 9) : null), [shapes, cw, ch]);
  const specs = useMemo(
    () => HIGHLIGHT_STYLES.map((style, i) => highlightDefaults({ target: p.target, style, color: p.color, startSec: 0.3 + i * 0.12, label: "" })),
    [p.target, p.color],
  );
  const areas = useAreaHighlights(specs, frame, fps, theme, p.borders);
  if (!cam || areas.length < specs.length) return <AbsoluteFill style={{ background: theme.oceanEdge }} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {HIGHLIGHT_STYLES.map((style, i) => (
        <div key={style} style={{ position: "absolute", left: (i % cols) * cw, top: Math.floor(i / cols) * ch, width: cw, height: ch, overflow: "hidden", outline: "1px solid rgba(255,255,255,0.15)" }}>
          <MapView kind="mercator" camera={cam} theme={theme} borderView={p.borders} size={{ width: cw, height: ch }} areas={[areas[i]]} />
          <div style={{ position: "absolute", left: 12, bottom: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(0,0,0,0.65)", color: "white", font: `600 ${height * 0.02}px ${font("JetBrains Mono")}` }}>{style}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
