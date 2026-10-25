import React from "react";
import { z } from "zod";
import { TravelScene } from "../TravelScene";
import { base, zColorOrAuto, zProjection, zRouteMode, zRouteStyle, zVehicle } from "../../lib/schema";
import { LOCATION_CARD_STYLES } from "../../ui/Overlays2D";

export const vehicleRouteSchema = z.object({
  ...base,
  stops: z.array(z.string()).min(2).describe("Start, stops and destination"),
  mode: zRouteMode,
  trackFile: z.string().describe("Optional GPX/GeoJSON in public/ for an exact recorded route"),
  projection: zProjection,
  vehicle: zVehicle,
  routeStyle: zRouteStyle,
  routeColor: zColorOrAuto,
  routeWidth: z.number().min(1).max(30),
  cameraMode: z.enum(["fit", "follow", "fly", "overview-follow"]),
  pitch: z.number().min(0).max(60),
  headingUp: z.boolean().describe("Rotate the map so the vehicle always drives up (navigation view)"),
  introSec: z.number().min(0).max(10),
  outroSec: z.number().min(0).max(10),
  stopPauseSec: z.number().min(0).max(5),
  showDistance: z.boolean(),
  showHud: z.boolean(),
  showCompass: z.boolean(),
  showScale: z.boolean(),
  arrivalCard: z.boolean(),
  cardStyle: z.enum(LOCATION_CARD_STYLES),
  realHours: z.number().min(0).max(200).describe("Real trip time for HUD speed/clock (0 = estimate)"),
  departure: z.string(),
  roads: z.boolean().describe("Show the highway network"),
  rail: z.boolean().describe("Show the railway network"),
  states: z.boolean().describe("Show state borders"),
  title: z.string(),
});

export const VehicleRoute: React.FC<z.infer<typeof vehicleRouteSchema>> = (p) => (
  <TravelScene
    {...p}
    lift={0}
    easing="smooth"
    layers={{ roads: p.roads, rail: p.rail, states: p.states ? "all" : undefined, rivers: true }}
  />
);
