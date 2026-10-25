import React from "react";
import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { base } from "../../lib/schema";
import { useAsset } from "../../lib/data";
import { loadDem, type Dem } from "../../lib/terrain";
import { usePlaces } from "../../lib/useTrip";
import { TERRAIN_MOVES, TERRAIN_STYLES, TerrainView, terrainCamera, type TerrainMarker } from "../../three/Terrain3D";
import { Grain, Letterbox, Vignette } from "../../fx/Finish";
import { Sfx } from "../../fx/Sfx";
import { LocationCard } from "../../ui/Overlays2D";
import { placeSubtitle } from "../../lib/places";

export const demSweepSchema = z.object({
  ...base,
  target: z.string().describe('Mountain, place or "lat, lon" at the centre of the shot'),
  radiusKm: z.number().min(2).max(120).describe("Area of real terrain loaded around the target"),
  terrainStyle: z.enum(TERRAIN_STYLES),
  move: z.enum(TERRAIN_MOVES),
  exaggeration: z.number().min(0.5).max(4).describe("Vertical exaggeration (1 = true scale)"),
  headingDeg: z.number().min(0).max(360).describe("Direction the camera looks from (0 = from the south looking north)"),
  distanceKm: z.number().min(0.5).max(80),
  heightKm: z.number().min(0).max(20).describe("Camera height above the target summit"),
  turnDeg: z.number().min(0).max(360).describe("Orbit angle covered (orbit move)"),
  fov: z.number().min(20).max(90),
  sunAzimuth: z.number().min(0).max(360),
  sunElevation: z.number().min(2).max(89),
  fog: z.number().min(0).max(1),
  snowline: z.number().min(0).max(7000).describe("Metres; 0 = automatic"),
  peaks: z.array(z.string()).describe("Extra labelled peaks/places"),
  showCard: z.boolean(),
  letterbox: z.boolean(),
});

export const DemMountainSweep: React.FC<z.infer<typeof demSweepSchema>> = (p) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const places = usePlaces([p.target, ...p.peaks]);
  const center = places?.[0];
  const dem = useAsset<Dem>(center ? `dem:${center.lon},${center.lat}:${p.radiusKm}` : null, () => loadDem([center!.lon, center!.lat], p.radiusKm));
  if (!dem || !places || !center) return <AbsoluteFill style={{ background: "#9fb7cc" }} />;
  const t = frame / Math.max(1, durationInFrames - 1);
  const pose = terrainCamera(dem, p.exaggeration, [center.lon, center.lat], p.move, t, {
    distanceKm: p.distanceKm,
    heightKm: p.heightKm,
    headingDeg: p.headingDeg,
    fov: p.fov,
    turnDeg: p.turnDeg,
  });
  const markers: TerrainMarker[] = places.map((pl, i) => ({
    at: [pl.lon, pl.lat],
    label: pl.name,
    sub: pl.elevation ? `${pl.elevation.toLocaleString("en-IN")} m` : `≈ ${Math.round(dem.elevation([pl.lon, pl.lat])).toLocaleString("en-IN")} m`,
    appear: i === 0 ? Math.round(fps * 0.8) : Math.round(fps * (1.2 + i * 0.4)),
  }));
  return (
    <AbsoluteFill>
      <TerrainView
        dem={dem}
        style={p.terrainStyle}
        exaggeration={p.exaggeration}
        snowline={p.snowline}
        camera={pose}
        sunAzimuth={p.sunAzimuth}
        sunElevation={p.sunElevation}
        fog={p.fog}
        markers={markers}
        frame={frame}
      />
      {p.terrainStyle !== "paper" ? <Grain amount={0.05} /> : null}
      <Vignette amount={0.35} />
      {p.letterbox ? <Letterbox /> : null}
      {p.showCard ? (
        <LocationCard
          name={center.name}
          subtitle={placeSubtitle(center)}
          lat={center.lat}
          lon={center.lon}
          start={Math.round(durationInFrames * 0.45)}
          duration={durationInFrames}
          cardStyle="documentary"
          position={p.letterbox ? "top-left" : "bottom-left"}
          inset={p.letterbox ? 0.17 : 0}
        />
      ) : null}
      <Sfx name="riser" at={0} volume={p.sfxVolume * 0.6} enabled={p.sfx} />
      <Sfx name="whoosh" at={Math.round(durationInFrames * 0.45) - 10} volume={p.sfxVolume} enabled={p.sfx} />
    </AbsoluteFill>
  );
};
