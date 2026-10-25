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

## Map Animation Studio: desktop software

**Install:** run **`Map-Animation-Studio-Setup-<version>.exe`** and click through the installer. You can install it for just you or for everyone, and choose the folder. It adds a **Map Animation Studio** icon to the desktop and the Start Menu, and you uninstall it from *Settings → Apps* like any other program. You can pass the same installer to anyone with Windows 10 or 11 (64-bit). Windows SmartScreen may say "Windows protected your PC" because the installer isn't code-signed: click **More info → Run anyway**.

Everything is inside the app: the editor, the 30 animations and all the map data (borders, states, 7,300+ cities, roads, rivers, satellite imagery, flags, sounds). No browser, terminal or internet is needed, except for Google Fonts and new 3D terrain areas.

**Export** renders every frame and encodes **H.264 MP4** (about 40 Mbit/s for 1080p, 120 Mbit/s for 4K, 320 kbps AAC audio), then asks where to save it (the Videos folder by default). On a computer whose video encoder can't make H.264, it renders a near-lossless master and converts it with the built-in ffmpeg (x264 CRF 14, slow preset). Projects and your media are stored inside the app and reopen automatically.

**Building the installer** (developers): `npm run build-desktop` writes `release/Map-Animation-Studio-Setup-<version>.exe`. On Linux or macOS this needs Wine (`apt install wine64 wine32:i386`). `npm run build-desktop -- --dir` makes an unpacked app without the installer. `npm run app` runs the editor from source in a browser with live reload. `npm run build-html` makes the single-file browser version (`Map Animation Studio.html`).

The screen is laid out like Cutroom:

| Area | What it does |
|---|---|
| **Left: Add / Templates / Media** | Add any layer at the playhead: highlight area, flag/photo/video inside an area, route, pin, radar, callout, arrow, map label, text, location card, image, video, waving flag, counter, GPS HUD, sound. **Templates** adds any of the 30 ready-made animations as a *scene* on the timeline, or starts a new project from one. **Media** adds your photos, videos and audio. They are kept inside the app and are there next time. |
| **Centre: preview** | Live preview. Drag the selected layer to move it, scroll to scale it, Shift+scroll to rotate it. With **Rec** on, those moves become keyframes at the playhead. Drop files on the preview to add them. |
| **Right: inspector** | **Layer**: every setting, with place search (countries, states, 7,300+ cities, landmarks). **Animate**: keyframes (opacity, scale, x, y, rotate, easing) and presets. **Camera**: camera keyframes (place, zoom, bearing, 3D pitch, fly/smooth/cut). **Project**: frame size, length, map look, borders, map details, sun, sound. |
| **Bottom: timeline** | One track per layer, plus a camera track. Drag bars to move them, drag their edges to trim. Drag the diamonds to retime keyframes, and double-click the camera row to add a camera key. Snapping is on (hold Alt to turn it off), and Ctrl+wheel zooms. Drag the end marker to change the length. |

**Export options:** Highest quality MP4, Smaller MP4 (about 16 Mbit/s for 1080p) or WebM. Every frame size works: 1080p, 4K, Shorts 9:16, 1:1 and 4:5.

**Saving:** **Ctrl+S** saves the project (*Project → Open* lists your projects), and after that it autosaves. *Project → Download project file* gives you a `.json` copy for another computer. Undo/redo goes back up to 150 steps.

**Shortcuts:** Space play · ←/→ frame · K keyframe · R record · S split · Del delete · Ctrl+D duplicate · Ctrl+Z / Ctrl+Shift+Z undo/redo · Ctrl+S save · Ctrl+O open.

A misspelt place name doesn't stop the preview: that element is skipped and a ⚠ warning shows on the preview.


## Remotion Studio (optional, for developers)

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

`highlight` · `region-media` (photo/video/flag inside a country or state) · `route` · `pin` · `radar` · `callout` · `arrow` · `map-label` · `text` · `location-card` · `image` · `video` · `flag` · `counter` · `hud` · `sfx` · `scene` (plays any of the 30 templates, full-frame or scaled down as picture-in-picture)

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
