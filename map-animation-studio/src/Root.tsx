import "./lib/fonts";
import React from "react";
import { Composition, Folder } from "remotion";
import { sizeFromProps } from "./lib/schema";
import { FlightPath, flightPathSchema } from "./scenes/routes/FlightPath";
import { MapHighlights, mapHighlightsSchema } from "./scenes/highlights/MapHighlights";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="1-Routes-and-Paths">
        <Composition
          id="FlightPath"
          component={FlightPath}
          schema={flightPathSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 10,
            theme: "satellite",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            from: "Mumbai",
            via: [],
            to: "London",
            projection: "globe",
            arc: "lifted",
            vehicle: "plane",
            routeStyle: "glow",
            routeColor: "auto",
            routeWidth: 6,
            cameraMode: "fly",
            pitch: 0,
            introSec: 1,
            outroSec: 2.5,
            showDistance: true,
            showHud: false,
            arrivalCard: true,
            realHours: 9.5,
            departure: "02:15",
            dayNight: true,
            dateTimeUtc: "2025-06-21T06:00:00Z",
            title: "",
          }}
        />
      </Folder>
      <Folder name="0-Map-Highlights">
        <Composition
          id="MapHighlights"
          component={MapHighlights}
          schema={mapHighlightsSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={420}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 14,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            projection: "mercator",
            cameraMode: "tour",
            fixedCenter: "",
            fixedZoom: 2,
            highlights: [
              { target: "India", level: "country", radiusKm: 0, style: "paper-cutout", color: "#ffb347", startSec: 1.2, endSec: 4.2, label: "auto", sublabel: "1.43 billion people" },
              { target: "Kerala", level: "state", radiusKm: 0, style: "neon", color: "#00e5ff", startSec: 5, endSec: 7.8, label: "auto", sublabel: "" },
              { target: "Delhi", level: "radius", radiusKm: 300, style: "ring", color: "#ff5a36", startSec: 8.6, endSec: 10.8, label: "300 km from Delhi", sublabel: "" },
              { target: "China", level: "country", radiusKm: 0, style: "outline-draw", color: "#e03c31", startSec: 11.5, endSec: 0, label: "auto", sublabel: "" },
            ],
            countryLabels: true,
            stateBorders: true,
            title: "",
            subtitle: "",
          }}
        />
      </Folder>
    </>
  );
};
