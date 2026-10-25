# Map Animation Studio

Map and travel animations for YouTube, built on Remotion, so you edit them in **Remotion Studio**: a timeline, a props panel and a Render button.
It covers every technique in the *Map & Travel Animation Reference Guide*, plus extra highlight, transition and editing effects.

All the data is free and accurate, and most of it ships in this folder:

| Data | Source | Notes |
|---|---|---|
| Country borders (3 detail levels) | Natural Earth 1:10m | **`borders: "india"`** uses Natural Earth's India point-of-view file (J&K and Ladakh as officially recognised by India). `"world"` uses de facto lines. |
| States / provinces | Natural Earth admin-1 | Every country |
| 7,300+ cities, 70+ landmarks and peaks, extra Indian towns | Natural Earth plus surveyed coordinates | Peaks use official heights (Everest 8,849 m) |
| Rivers, lakes, highways, railways | Natural Earth 1:10m | Highways and railways are the **routing network** |
| Satellite globe, night lights | NASA Blue Marble / Black Marble | Real day/night terminator for any date |
| 3D terrain | AWS Terrain Tiles (SRTM, ~30–70 m) | Downloaded when rendering; `npm run cache-terrain` stores it offline |
| Flags (250+) | `flag-icons` (MIT) | Waving animation |
| Sound effects | Synthesised by `scripts/make-sfx.mjs` | Your own, royalty-free |

## Setup

```bash
cd map-animation-studio
npm install
npm run studio        # opens Remotion Studio at http://localhost:3000
```

In Studio, pick a composition on the left and edit its props on the right. Type places as names (`"Mumbai"`, `"Taj Mahal"`, `"Kerala"`, `"Paris, France"`) or coordinates (`"19.07, 72.87"`). To name a coordinate, write `"Base Camp (28.0026, 86.8528)"`.

## Rendering at the highest quality

Studio's **Render** button and the scripts below use the settings in `remotion.config.ts`: lossless PNG frames, H.264 at CRF 12 with the slow preset, BT.709 colour and 320 kbps audio. That gives a visually lossless master (about 30 Mbps at 1080p).

```bash
npm run render -- FlightPath              # out/FlightPath.mp4 (1080p)
npm run render -- FlightPath --4k         # 3840x2160
npm run render -- FlightPath --shorts     # 1080x1920 for Shorts/Reels
npm run render -- FlightPath --square     # 1080x1080
npm run render -- FlightPath --prores     # ProRes 4444 .mov for Premiere/DaVinci grading
npm run render -- MapComposer --props=my-props.json
```

Every composition also has a **format** prop (16:9 1080p / 4K, 9:16, 1:1, 4:5) and a **durationSec** prop.

## The compositions

### 00 · Map Composer: your own timeline with keyframes
`MapComposer` is the free-form editor. Add **layers**; each one appears as a bar on the Studio timeline from `startSec` to `endSec`. Layer types:

`highlight` · `region-media` (photo/video/flag inside a country or state) · `route` · `pin` · `radar` · `callout` · `arrow` · `map-label` · `text` · `location-card` · `image` · `video` · `flag` · `counter` · `hud` · `sfx`

* **Keyframes** (`keys`): each key sets `opacity`, `scale`, `x`, `y` and `rotate` at a time `t` (seconds from the layer's start), with an easing (`linear`, `ease-in`, `ease-out`, `ease-in-out`, `back`, `elastic`, `bounce`, `hold`). Keys combine freely, and layers stack.
* **Camera keyframes** (`camera`): place, zoom, bearing, 3D pitch, and how the camera gets there (`fly` = Google-Earth zoom-out/in, `smooth`, `linear`, `cut`).
* **Project files**: set `projectFile` to a JSON file in `public/` (see `public/projects/example-delhi-mumbai.json`). Your `/make-video` pipeline can write these files and render them with `npm run render -- MapComposer --props='{"projectFile":"projects/x.json"}'`.

### 0 · Map highlights
* `MapHighlights`: tours countries, states, radius rings or your own GeoJSON (`file:areas/x.geojson`) with **16 highlight styles**: fill, gradient, glow, neon, outline-draw, spotlight, pop-out, paper-cutout, extrude, hatch, dots, pulse, marching-ants, blink, inner-glow, ring.
* `HighlightCatalog` shows all 16 styles side by side so you can pick one.
* `CountrySpotlightGlobe` is the same scene on the satellite globe.
* `RegionMediaFill` puts **waving flags, photos or video inside a country or state, clipped exactly to its border**, so nothing spills into neighbouring areas. `media: "flag"` uses the area's own flag, and `"flag:jp"` picks one.

### 1 · Routes & paths
* `FlightPath`: great-circle flight, either geodesic or lifted 3D arc, with the plane turning to its heading, a live distance counter, real flight-time clock, HUD and arrival card. Mumbai→London measures 7,194 km.
* `VehicleRoute`: car, bus, train, bike, auto-rickshaw or ship **snapped to real highways or railways** (Delhi→Leh goes via Shimla and Manali), with a tilted 3D navigation camera. `mode: "street"` uses OpenStreetMap/OSRM street routing (needs internet). `trackFile` takes your GPX.
* `ParchmentCrawl`: Indiana-Jones-style red ink crawl on antique paper, with creases, burnt edges and a plane overlay.
* `ElevationTrail`: a trek drawn on **real 3D terrain** with a live elevation graph (gain/loss). Use a GPX file for the exact trail.

### 2 · Terrain & flyovers
* `DemMountainSweep`: drone sweep/orbit/flyover/reveal over real elevation data, with sun position, fog, snowline and peak labels (hidden behind ridges).
* `LowPolyTerrain`: the same with faceted low-poly styling.
* `MacroZoomDrop`: continuous dive from orbit to a place, with satellite imagery crossfading to vector detail, an altitude HUD and an optional dissolve into your footage.
* `LandmarkSwivel`: 360° orbit around a landmark miniature with a floating pin and tilt-shift.
* `TiltShiftCity`: toy-like miniature city with traffic and tilt-shift blur.

### 3 · Travel transitions
`MatchCut` (iris / window / zoom-blur / reverse into your footage), `GeoZoomPush` (satellite snap push with speed lines and flash), `HudOverlay` (GPS telemetry over footage or a 3D terrain chase, with circular minimap), `KineticLocationCard` (6 card styles), `SearchFlyTo` (search bar types the place, then the globe flies there).

### 4 · Isometric & infographic
`PopUpMiniatures` (3D landmark models spring up as the route reaches them), `ExtrudedCity` (isometric city; give it a GeoJSON of real building footprints via `buildingsFile`), `PulsingMarkers` (radar-ring targets with callout boxes that can hold a photo or video preview; it is a Map Composer preset, so you can add more layers).

### 5 · Historical & geopolitical
`FrontlineShift` (moving front lines, territory shading limited to chosen countries, military arrows, date ticker), `EmpireExpansion` (choropleth timeline with add/remove steps; the default is EU enlargement 1957→2020), `ParticleStreams` (migration/trade flows), `UnfoldingPaperMap` (a 3D folded map unfolds, then the route is drawn; the default is Vasco da Gama's 1497–98 voyage via coastal waypoints).

### 6 · Vlog integration
`SplitScreenTracker` (footage plus live route map: side-by-side, stacked or picture-in-picture), `PolaroidPinDrop` (polaroids drop at each stop and the last grows into the full-screen clip), `EarthZoomChain` (audio-driven zooms: set `beatTimesSec` and `music` and each zoom lands on a beat with whoosh, impact, shake and flash), `DayNightGlobe` (real sun position over time).

## Your own media
Put files in `public/media/` and reference them as `media/clip.mp4`. Put custom areas (GeoJSON) in `public/areas/` and use `file:areas/my-area.geojson` as a target.

## Accuracy notes
* Distances are geodesic (WGS84 mean radius). Flight lines are true great circles. Road and rail routes follow Natural Earth's major highways and railways, so they are slightly shorter than the real winding road (Mumbai–Pune 147 km vs ~150 km). Use `street` mode or a GPX file for exact roads.
* Vector detail is excellent down to about state and city scale. For street level, cut to footage (`endMedia`, match cuts).
* Historical defaults (Korean War fronts, Vasco da Gama route) are approximate illustrations. Replace them with your sourced data. Country shapes are modern borders.
* 3D landmark models are stylised miniatures, not survey models.

## Rebuilding data
`npm run build-data` re-downloads Natural Earth and NASA imagery and rebuilds `public/data`. `npm run make-sfx` regenerates the sounds.
