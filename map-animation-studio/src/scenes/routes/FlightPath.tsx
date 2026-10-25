import React from "react";
import { z } from "zod";
import { TravelScene } from "../TravelScene";
import { base, zColorOrAuto, zProjection, zRouteStyle, zVehicle } from "../../lib/schema";

export const flightPathSchema = z.object({
  ...base,
  from: z.string().describe('City, landmark or "lat, lon"'),
  via: z.array(z.string()).describe("Optional stopovers"),
  to: z.string(),
  projection: zProjection,
  arc: z.enum(["geodesic", "lifted"]).describe("geodesic = true great circle on the ground; lifted = curved 3D arc in the air"),
  vehicle: zVehicle,
  routeStyle: zRouteStyle,
  routeColor: zColorOrAuto,
  routeWidth: z.number().min(1).max(30),
  cameraMode: z.enum(["fit", "follow", "fly", "overview-follow"]),
  pitch: z.number().min(0).max(60).describe("3D tilt of the map in degrees"),
  introSec: z.number().min(0).max(10),
  outroSec: z.number().min(0).max(10),
  showDistance: z.boolean(),
  showHud: z.boolean().describe("GPS/flight telemetry overlay"),
  arrivalCard: z.boolean(),
  realHours: z.number().min(0).max(30).describe("Real flight time for the HUD clock (0 = estimate at 820 km/h)"),
  departure: z.string().describe("Departure time HH:MM for the HUD clock"),
  dayNight: z.boolean().describe("Real sun lighting (use with the satellite theme)"),
  dateTimeUtc: z.string().describe("UTC date-time for the sun position, e.g. 2025-06-21T06:00:00Z"),
  title: z.string(),
});

export const FlightPath: React.FC<z.infer<typeof flightPathSchema>> = (p) => (
  <TravelScene
    {...p}
    stops={[p.from, ...p.via, p.to]}
    mode="flight"
    lift={p.arc === "lifted" ? 1 : 0}
    easing="smooth"
    layers={{ graticule: p.projection === "globe" }}
  />
);
