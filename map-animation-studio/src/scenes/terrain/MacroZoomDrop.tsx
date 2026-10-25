import React, { useMemo } from "react";
import { z } from "zod";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { MapView, MapOverlay } from "../../map/MapView";
import { Pin } from "../../map/overlays";
import { useAreaHighlights, zHighlight } from "../../map/useAreaHighlights";
import { base, zTheme } from "../../lib/schema";
import { THEMES } from "../../lib/themes";
import { baseScale, cam, flyTo } from "../../lib/camera";
import { clamp, easeInOutCubic, smooth, subsolarPoint } from "../../lib/geo";
import { usePlaces } from "../../lib/useTrip";
import { placeSubtitle } from "../../lib/places";
import { resolveMedia, isVideoFile } from "../../lib/media";
import { Finish, Grain } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { Hud, LocationCard, LOCATION_CARD_STYLES } from "../../ui/Overlays2D";

export const macroZoomSchema = z.object({
  ...base,
  target: z.string(),
  startFrom: z.string().describe('Where the globe faces at the start (place or "lat, lon"); empty = opposite side spin'),
  spinDeg: z.number().min(0).max(720).describe("Extra globe spin during the approach"),
  endZoom: z.number().min(2).max(9).describe("Final magnification (4 ≈ country, 6.5 ≈ region/city). Use endMedia for street level."),
  closeTheme: zTheme.describe("Look used once zoomed in (satellite imagery gets blurry close up)"),
  holdSec: z.number().min(0).max(10).describe("Seconds held at the end"),
  dayNight: z.boolean(),
  dateTimeUtc: z.string(),
  highlights: z.array(zHighlight),
  hud: z.boolean().describe("Altitude/coordinates telemetry"),
  card: z.boolean(),
  cardStyle: z.enum(LOCATION_CARD_STYLES),
  endMedia: z.string().describe("Optional footage/photo in public/ that dissolves in at the end (match cut)"),
});

export const MacroZoomDrop: React.FC<z.infer<typeof macroZoomSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const places = usePlaces([p.target, ...(p.startFrom ? [p.startFrom] : [])]);
  const far = THEMES[p.theme];
  const close = THEMES[p.closeTheme];
  const areas = useAreaHighlights(p.highlights, frame, fps, close, p.borders);
  const hold = Math.round(p.holdSec * fps);
  const move = Math.max(1, durationInFrames - hold);
  const t = clamp(frame / move);
  const tgt = places?.[0];
  const start = useMemo(() => {
    if (!tgt) return cam(0, 0, -0.6);
    const s = places?.[1];
    return s ? cam(s.lon, s.lat, -0.65) : cam(tgt.lon - 100, tgt.lat * 0.3, -0.65);
  }, [tgt, places]);
  if (!tgt) return <AbsoluteFill style={{ background: "#05070d" }} />;
  const end = cam(tgt.lon, tgt.lat, p.endZoom);
  // Rotate first, then dive: the camera centre reaches the target early, the zoom keeps building.
  const e = easeInOutCubic(t);
  const c = flyTo(start, end, e, "globe", 0.6);
  const spin = p.spinDeg * (1 - smooth(clamp(t / 0.55)));
  const camera = { ...c, lon: c.lon - spin, zoom: start.zoom + (end.zoom - start.zoom) * Math.pow(e, 1.6) };
  // Imagery fades to the vector look between zoom 4 and 5.5.
  const mix = clamp((camera.zoom - 4) / 1.5);
  const sun = p.dayNight ? subsolarPoint(new Date(p.dateTimeUtc || "2025-03-20T06:00:00Z")) : null;
  const kmPerPx = 6371 / (baseScale("globe", width, height) * Math.pow(2, camera.zoom));
  const altitudeKm = (kmPerPx * width) / 1.15;
  const arrive = move;
  const mediaIn = clamp((frame - (arrive + 10)) / 20);
  const src = p.endMedia ? resolveMedia(p.endMedia) : null;
  return (
    <AbsoluteFill style={{ background: "#05070d" }}>
      {mix < 1 ? (
        <MapView kind="globe" camera={camera} theme={far} borderView={p.borders} sun={sun} layers={{ countryLabels: camera.zoom > 1.2 && camera.zoom < 5 }} />
      ) : null}
      {mix > 0 ? (
        <AbsoluteFill style={{ opacity: mix }}>
          <MapView
            kind="globe"
            camera={camera}
            theme={close}
            borderView={p.borders}
            areas={areas}
            layers={{ countryLabels: true, states: "all", roads: camera.zoom > 5.5, rail: camera.zoom > 6, rivers: true, lakes: true }}
          >
            <MapOverlay>
              <Pin at={[tgt.lon, tgt.lat]} label={tgt.name} start={arrive - 25} size={Math.round(height * 0.06)} />
            </MapOverlay>
          </MapView>
        </AbsoluteFill>
      ) : null}
      {mix > 0 ? <Finish theme={close} /> : <Grain amount={0.04} />}
      {p.hud ? <Hud style="flight" data={{ lat: camera.lat, lon: camera.lon, altitudeM: altitudeKm * 1000, title: tgt.name.toUpperCase() }} /> : null}
      {src && mediaIn > 0 ? (
        <AbsoluteFill style={{ opacity: mediaIn, scale: String(interpolate(mediaIn, [0, 1], [1.15, 1])) }}>
          {isVideoFile(p.endMedia) ? (
            <Video src={src} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
          ) : (
            <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </AbsoluteFill>
      ) : null}
      {p.card ? <LocationCard name={tgt.name} subtitle={placeSubtitle(tgt)} lat={tgt.lat} lon={tgt.lon} start={arrive - 15} duration={durationInFrames} cardStyle={p.cardStyle} position={p.hud ? "bottom-right" : "bottom-left"} /> : null}
      <Sfx name="zoom-in" at={Math.max(0, move - 52)} volume={p.sfxVolume} enabled={p.sfx} />
      <Sfx name="whoosh" at={Math.round(move * 0.15)} volume={p.sfxVolume * 0.7} enabled={p.sfx} />
      <Sfx name="impact" at={move - 4} volume={p.sfxVolume * 0.6} enabled={p.sfx} />
    </AbsoluteFill>
  );
};
