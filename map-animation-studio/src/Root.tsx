import "./lib/fonts";
import React from "react";
import { Composition, Folder } from "remotion";
import { sizeFromProps } from "./lib/schema";
import { FlightPath, flightPathSchema } from "./scenes/routes/FlightPath";
import { MapHighlights, mapHighlightsSchema } from "./scenes/highlights/MapHighlights";
import { DemMountainSweep, demSweepSchema } from "./scenes/terrain/DemMountainSweep";
import { VehicleRoute, vehicleRouteSchema } from "./scenes/routes/VehicleRoute";
import { ParchmentCrawl, parchmentSchema } from "./scenes/routes/ParchmentCrawl";
import { ElevationTrail, elevationTrailSchema } from "./scenes/routes/ElevationTrail";
import { MacroZoomDrop, macroZoomSchema } from "./scenes/terrain/MacroZoomDrop";
import { EarthZoomChain, earthZoomSchema } from "./scenes/vlog/EarthZoomChain";
import {
  HudOverlay,
  hudOverlaySchema,
  KineticLocationCard,
  kineticCardSchema,
  MatchCut,
  matchCutSchema,
  SearchFlyTo,
  searchFlySchema,
} from "./scenes/transitions/TravelTransitions";
import { DayNightGlobe, dayNightSchema, PolaroidPinDrop, polaroidSchema, SplitScreenTracker, splitScreenSchema } from "./scenes/vlog/VlogScenes";
import { RegionMediaFill, regionMediaSchema } from "./scenes/regions/RegionMediaFill";
import { MapComposer, composerSchema } from "./scenes/composer/MapComposer";
import { EmpireExpansion, expansionSchema, FrontlineShift, frontlineSchema, ParticleStreams, particleSchema } from "./scenes/history/HistoryScenes";

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
        <Composition
          id="VehicleRoute"
          component={VehicleRoute}
          schema={vehicleRouteSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={450}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 15,
            theme: "vlog",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            stops: ["Delhi", "Shimla", "Manali", "Leh"],
            mode: "road",
            trackFile: "",
            projection: "mercator",
            vehicle: "suv",
            routeStyle: "double",
            routeColor: "auto",
            routeWidth: 7,
            cameraMode: "overview-follow",
            pitch: 45,
            headingUp: false,
            introSec: 1.5,
            outroSec: 2.5,
            stopPauseSec: 0.6,
            showDistance: true,
            showHud: false,
            showCompass: true,
            showScale: true,
            arrivalCard: true,
            cardStyle: "vlog",
            realHours: 0,
            departure: "06:00",
            roads: true,
            rail: false,
            states: true,
            title: "",
          }}
        />
        <Composition
          id="ParchmentCrawl"
          component={ParchmentCrawl}
          schema={parchmentSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={360}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 12,
            theme: "parchment",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            stops: ["San Francisco", "Honolulu", "Manila", "Kathmandu"],
            mode: "flight",
            projection: "natural",
            routeColor: "auto",
            routeWidth: 7,
            cameraMode: "fit",
            stopPauseSec: 0.4,
            planeOverlay: true,
            burnEdges: true,
            title: "",
          }}
        />
        <Composition
          id="ElevationTrail"
          component={ElevationTrail}
          schema={elevationTrailSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={600}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 20,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            stops: [
              "Lukla (27.6869, 86.7314)",
              "Namche Bazaar (27.8069, 86.7140)",
              "Tengboche (27.8361, 86.7644)",
              "Dingboche (27.8923, 86.8314)",
              "Lobuche (27.9483, 86.8103)",
              "Gorak Shep (27.9806, 86.8289)",
              "Everest Base Camp (28.0026, 86.8528)",
            ],
            mode: "straight",
            trackFile: "",
            terrainStyle: "realistic",
            exaggeration: 1.3,
            trailColor: "auto",
            cameraDistanceKm: 6,
            cameraHeightKm: 3.2,
            sunAzimuth: 130,
            sunElevation: 30,
            fog: 0.4,
            graph: true,
            title: "Everest Base Camp Trek",
          }}
        />
      </Folder>
      <Folder name="2-Terrain-and-Flyovers">
        <Composition
          id="DemMountainSweep"
          component={DemMountainSweep}
          schema={demSweepSchema}
          calculateMetadata={sizeFromProps}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 10,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            target: "Mount Everest",
            radiusKm: 14,
            terrainStyle: "realistic",
            move: "sweep",
            exaggeration: 1.2,
            headingDeg: 200,
            distanceKm: 13,
            heightKm: 1.2,
            turnDeg: 120,
            fov: 48,
            sunAzimuth: 140,
            sunElevation: 24,
            fog: 0.45,
            snowline: 5400,
            peaks: ["Lhotse", "Nuptse"],
            showCard: true,
            letterbox: true,
          }}
        />
              <Composition
          id="MacroZoomDrop"
          component={MacroZoomDrop}
          schema={macroZoomSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={300}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 10,
            theme: "satellite",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            target: "Gateway of India",
            startFrom: "",
            spinDeg: 160,
            endZoom: 6.5,
            closeTheme: "dark",
            holdSec: 2.5,
            dayNight: true,
            dateTimeUtc: "2025-03-20T06:00:00Z",
            highlights: [],
            hud: true,
            card: true,
            cardStyle: "documentary",
            endMedia: "",
          }}
        />
      </Folder>
      <Folder name="00-Map-Composer">
        <Composition
          id="MapComposer"
          component={MapComposer}
          schema={composerSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={480}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 16,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            projectFile: "",
            projection: "mercator",
            camera: [
              { t: 0, place: "India", zoom: 2.1, bearing: 0, pitch: 0, move: "cut", ease: "linear" },
              { t: 3.4, place: "Delhi", zoom: 4.2, bearing: 0, pitch: 0, move: "fly", ease: "ease-in-out" },
              { t: 7.6, place: "Delhi", zoom: 4.4, bearing: 0, pitch: 0, move: "smooth", ease: "linear" },
              { t: 9, place: "Ahmedabad", zoom: 3.4, bearing: 0, pitch: 35, move: "smooth", ease: "ease-in-out" },
              { t: 13.4, place: "Mumbai", zoom: 4.3, bearing: 0, pitch: 20, move: "fly", ease: "ease-in-out" },
              { t: 16, place: "Mumbai", zoom: 4.6, bearing: 0, pitch: 20, move: "smooth", ease: "linear" },
            ],
            layers: [
              { name: "India flag", type: "region-media", startSec: 0.4, endSec: 3.6, places: ["India"], level: "country", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "", subtext: "", media: "flag", wave: true, value: 0, anchor: "center", size: 60, keys: [{ t: 0, opacity: 0, scale: 1, x: 0, y: 0, rotate: 0, ease: "linear" }, { t: 0.6, opacity: 0.9, scale: 1, x: 0, y: 0, rotate: 0, ease: "ease-out" }, { t: 2.6, opacity: 0.9, scale: 1, x: 0, y: 0, rotate: 0, ease: "linear" }, { t: 3.2, opacity: 0, scale: 1, x: 0, y: 0, rotate: 0, ease: "ease-in" }] },
              { name: "Title", type: "text", startSec: 0.6, endSec: 3.4, places: [], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "DELHI TO MUMBAI", subtext: "1,400 km by road", media: "", wave: true, value: 0, anchor: "top", size: 84, keys: [{ t: 0, opacity: 0, scale: 1, x: 0, y: 60, rotate: 0, ease: "linear" }, { t: 0.6, opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, ease: "back" }, { t: 2.4, opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, ease: "linear" }, { t: 2.8, opacity: 0, scale: 1, x: 0, y: -30, rotate: 0, ease: "ease-in" }] },
              { name: "Capital region", type: "highlight", startSec: 3.4, endSec: 7.6, places: ["Delhi"], level: "radius", radiusKm: 150, highlightStyle: "pulse", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "#ffb347", text: "National Capital Region", subtext: "", media: "", wave: true, value: 0, anchor: "center", size: 60, keys: [] },
              { name: "Delhi pin", type: "pin", startSec: 3.6, endSec: 16, places: ["Delhi"], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "#ffb347", text: "", subtext: "", media: "", wave: true, value: 0, anchor: "center", size: 56, keys: [{ t: 0, opacity: 0, scale: 0.2, x: 0, y: 0, rotate: 0, ease: "linear" }, { t: 0.5, opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, ease: "elastic" }] },
              { name: "Road trip", type: "route", startSec: 7.6, endSec: 13.4, places: ["Delhi", "Jaipur", "Ahmedabad", "Mumbai"], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "double", mode: "road", vehicle: "suv", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "", subtext: "", media: "", wave: true, value: 0, anchor: "center", size: 60, keys: [] },
              { name: "Mumbai radar", type: "radar", startSec: 12.8, endSec: 16, places: ["Mumbai"], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "#00e5ff", text: "MUMBAI", subtext: "", media: "", wave: true, value: 0, anchor: "center", size: 60, keys: [] },
              { name: "Arrival card", type: "location-card", startSec: 13.2, endSec: 16, places: ["Mumbai"], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "", subtext: "", media: "", wave: true, value: 0, anchor: "bottom-left", size: 60, keys: [] },
              { name: "Flag badge", type: "flag", startSec: 0.4, endSec: 16, places: ["India"], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "", subtext: "", media: "", wave: true, value: 0, anchor: "top-right", size: 170, keys: [{ t: 0, opacity: 0, scale: 0.3, x: 0, y: 0, rotate: -30, ease: "linear" }, { t: 0.8, opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, ease: "back" }] },
              { name: "Whoosh", type: "sfx", startSec: 3, endSec: 4.2, places: [], level: "auto", radiusKm: 0, highlightStyle: "glow", routeStyle: "glow", mode: "road", vehicle: "car", cardStyle: "documentary", pinVariant: "pin", color: "auto", text: "", subtext: "", media: "whoosh", wave: true, value: 0, anchor: "center", size: 60, keys: [] },
            ],
            mapLayers: { countryLabels: true, states: true, roads: true, rail: false, rivers: true, graticule: false },
            dayNight: false,
            dateTimeUtc: "2025-06-21T06:00:00Z",
          }}
        />
      </Folder>
      <Folder name="0-Map-Highlights">
        <Composition
          id="RegionMediaFill"
          component={RegionMediaFill}
          schema={regionMediaSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={240}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 8,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            projection: "mercator",
            cameraMode: "fit-all",
            regions: [
              { target: "India", level: "country", radiusKm: 0, media: "flag", fit: "cover", wave: true, opacity: 1, reveal: "iris", outline: "#ffffff", label: "auto", startSec: 0.6, endSec: 0 },
              { target: "Nepal", level: "country", radiusKm: 0, media: "flag", fit: "cover", wave: true, opacity: 1, reveal: "iris", outline: "#ffffff", label: "", startSec: 1.6, endSec: 0 },
              { target: "Bhutan", level: "country", radiusKm: 0, media: "flag", fit: "cover", wave: true, opacity: 1, reveal: "iris", outline: "#ffffff", label: "", startSec: 2.2, endSec: 0 },
              { target: "Bangladesh", level: "country", radiusKm: 0, media: "flag", fit: "cover", wave: true, opacity: 1, reveal: "iris", outline: "#ffffff", label: "", startSec: 2.8, endSec: 0 },
              { target: "Sri Lanka", level: "country", radiusKm: 0, media: "flag", fit: "cover", wave: true, opacity: 1, reveal: "iris", outline: "#ffffff", label: "", startSec: 3.4, endSec: 0 },
            ],
            countryLabels: true,
            title: "",
            subtitle: "",
          }}
        />
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
      <Folder name="3-Travel-Transitions">
        <Composition
          id="MatchCut"
          component={MatchCut}
          schema={matchCutSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={150}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 5,
            theme: "satellite",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            place: "Taj Mahal",
            media: "",
            style: "iris",
            startZoom: 4,
            endZoom: 10,
            cutAtSec: 3,
            label: true,
          }}
        />
        <Composition
          id="GeoZoomPush"
          component={MatchCut}
          schema={matchCutSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={120}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 4,
            theme: "satellite",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            place: "Golden Temple",
            media: "",
            style: "zoom-blur",
            startZoom: 2,
            endZoom: 11,
            cutAtSec: 2.4,
            label: false,
          }}
        />
        <Composition
          id="HudOverlay"
          component={HudOverlay}
          schema={hudOverlaySchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={240}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 8,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            stops: ["Leh", "Pangong Lake (33.7595, 78.6674)"],
            mode: "road",
            media: "",
            hudStyle: "drone",
            color: "#7CFFB2",
            altitudeM: 4300,
            realHours: 5,
            clockStart: "07:30:00",
            miniMap: true,
          }}
        />
        <Composition
          id="KineticLocationCard"
          component={KineticLocationCard}
          schema={kineticCardSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={180}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 6,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            place: "Varanasi",
            title: "",
            subtitle: "",
            cardStyle: "documentary",
            position: "bottom-left",
            background: "map",
            media: "",
            projection: "mercator",
            accent: "#ffb347",
          }}
        />
        <Composition
          id="SearchFlyTo"
          component={SearchFlyTo}
          schema={searchFlySchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={240}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 8,
            theme: "satellite",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            from: "London",
            to: "Jaisalmer",
            query: "",
            projection: "globe",
            endZoom: 5.5,
          }}
        />
      </Folder>
      <Folder name="5-Historical-Geopolitical">
        <Composition
          id="FrontlineShift"
          component={FrontlineShift}
          schema={frontlineSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={360}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 12,
            theme: "military",
            borders: "world",
            sfx: true,
            sfxVolume: 0.25,
            projection: "mercator",
            frame: ["Seoul", "Pyongyang", "Busan", "42.3, 130.5", "39.5, 124.2"],
            sideA: { name: "North Korea & China", color: "#d62828", holds: "north" },
            sideB: { name: "South Korea & UN", color: "#1d4ed8" },
            lines: [
              { atSec: 0.5, points: "38.0, 124.8; 38.0, 126.0; 38.0, 127.2; 38.0, 128.6", label: "JUN 1950" },
              { atSec: 3.5, points: "35.15, 128.3; 35.55, 128.35; 35.9, 128.5; 36.1, 128.9; 36.05, 129.4", label: "SEP 1950" },
              { atSec: 6.5, points: "39.9, 124.4; 40.3, 125.5; 40.8, 126.8; 41.5, 128.2; 42.0, 129.6", label: "NOV 1950" },
              { atSec: 9.5, points: "37.75, 126.1; 38.0, 126.9; 38.3, 127.3; 38.3, 128.0; 38.6, 128.35", label: "JUL 1953" },
            ],
            arrows: [
              { path: "38.3, 126.9; 37.0, 127.4; 35.9, 128.2", startSec: 1, endSec: 3.3, side: "A", label: "" },
              { path: "36.9, 125.4; 37.3, 126.2; 37.48, 126.62", startSec: 4.2, endSec: 5.4, side: "B", label: "Incheon" },
              { path: "41.0, 126.4; 40.0, 126.6; 38.4, 127.0", startSec: 7.2, endSec: 9.2, side: "A", label: "" },
            ],
            title: "Korean War fronts (approx.)",
          }}
        />
        <Composition
          id="EmpireExpansion"
          component={EmpireExpansion}
          schema={expansionSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={420}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 14,
            theme: "minimal",
            borders: "world",
            sfx: true,
            sfxVolume: 0.25,
            projection: "mercator",
            frame: ["Lisbon", "Helsinki", "Nicosia", "Dublin", "Valletta"],
            steps: [
              { label: "1957", caption: "Treaty of Rome: the founding six", atSec: 0.8, action: "add", regions: ["France", "Germany", "Italy", "Belgium", "Netherlands", "Luxembourg"], color: "#1d4fb8" },
              { label: "1973", caption: "Denmark, Ireland, United Kingdom", atSec: 2.4, action: "add", regions: ["Denmark", "Ireland", "United Kingdom"], color: "#2f6fed" },
              { label: "1981", caption: "Greece", atSec: 3.8, action: "add", regions: ["Greece"], color: "#2f6fed" },
              { label: "1986", caption: "Spain, Portugal", atSec: 5, action: "add", regions: ["Spain", "Portugal"], color: "#2f6fed" },
              { label: "1995", caption: "Austria, Finland, Sweden", atSec: 6.4, action: "add", regions: ["Austria", "Finland", "Sweden"], color: "#4f8bf5" },
              { label: "2004", caption: "Ten countries join", atSec: 8, action: "add", regions: ["Cyprus", "Czechia", "Estonia", "Hungary", "Latvia", "Lithuania", "Malta", "Poland", "Slovakia", "Slovenia"], color: "#6fa1f7" },
              { label: "2007", caption: "Bulgaria, Romania", atSec: 9.6, action: "add", regions: ["Bulgaria", "Romania"], color: "#6fa1f7" },
              { label: "2013", caption: "Croatia", atSec: 11, action: "add", regions: ["Croatia"], color: "#8fb7f9" },
              { label: "2020", caption: "United Kingdom leaves", atSec: 12.4, action: "remove", regions: ["United Kingdom"], color: "#c8102e" },
            ],
            highlightNew: true,
            title: "The European Union",
            note: "Modern borders shown (Natural Earth). Germany joined in 1957 as West Germany.",
          }}
        />
        <Composition
          id="ParticleStreams"
          component={ParticleStreams}
          schema={particleSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={300}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 10,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            projection: "natural",
            frame: [],
            flows: [
              { from: "New Delhi", to: "Dubai", value: 35, color: "#ffb347", label: "" },
              { from: "New Delhi", to: "New York", value: 27, color: "#ff6b6b", label: "" },
              { from: "New Delhi", to: "Riyadh", value: 25, color: "#ffd166", label: "" },
              { from: "New Delhi", to: "London", value: 8, color: "#4dd4ff", label: "" },
              { from: "New Delhi", to: "Toronto", value: 7, color: "#b388ff", label: "" },
              { from: "New Delhi", to: "Sydney", value: 6, color: "#7CFFB2", label: "" },
            ],
            unit: "units",
            arc: 0.8,
            density: 1,
            title: "Flows (example data)",
            note: "Illustrative values. Replace them with your sourced figures.",
          }}
        />
      </Folder>
      <Folder name="6-Vlog-Integration">
        <Composition
          id="SplitScreenTracker"
          component={SplitScreenTracker}
          schema={splitScreenSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={300}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 10,
            theme: "vlog",
            borders: "india",
            sfx: false,
            sfxVolume: 0.25,
            media: "",
            stops: ["Mumbai", "Lonavala", "Pune"],
            mode: "road",
            trackFile: "",
            vehicle: "car",
            routeStyle: "glow",
            routeColor: "auto",
            layout: "side-by-side",
            mapShare: 0.4,
            pitch: 30,
          }}
        />
        <Composition
          id="PolaroidPinDrop"
          component={PolaroidPinDrop}
          schema={polaroidSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={420}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 14,
            theme: "vlog",
            borders: "india",
            sfx: true,
            sfxVolume: 0.25,
            stops: ["Jaipur", "Agra", "Varanasi"],
            photos: [],
            captions: ["Pink City", "Taj Mahal", "Ghats at dawn"],
            mode: "road",
            vehicle: "car",
            routeStyle: "dashed",
            routeColor: "auto",
            stopPauseSec: 1,
            expandLast: true,
            expandSec: 1.5,
          }}
        />
        <Composition
          id="EarthZoomChain"
          component={EarthZoomChain}
          schema={earthZoomSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={270}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 9,
            theme: "dark",
            borders: "india",
            sfx: true,
            sfxVolume: 0.3,
            projection: "globe",
            steps: [
              { target: "India", level: "country", radiusKm: 0, style: "outline-draw", color: "#ffb347", label: "auto" },
              { target: "Uttarakhand", level: "state", radiusKm: 0, style: "glow", color: "#00e5ff", label: "auto" },
              { target: "Kedarnath", level: "radius", radiusKm: 12, style: "ring", color: "#ff5a36", label: "Kedarnath" },
            ],
            beatTimesSec: [],
            music: "",
            musicVolume: 0.5,
            rampSec: 1.4,
            shake: true,
            flash: true,
          }}
        />
        <Composition
          id="DayNightGlobe"
          component={DayNightGlobe}
          schema={dayNightSchema}
          calculateMetadata={sizeFromProps}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={360}
          defaultProps={{
            format: "16:9 1080p",
            durationSec: 12,
            theme: "satellite",
            borders: "india",
            sfx: false,
            sfxVolume: 0.25,
            startUtc: "2025-12-21T00:00:00Z",
            hoursCovered: 24,
            focus: "New Delhi",
            rotate: false,
            zoom: 0,
            showClock: true,
          }}
        />
      </Folder>
    </>
  );
};
