import type React from "react";

/** Templates that a Map Composer "scene" layer can play. Filled by src/registry.ts. */
export type SceneDef = { component: React.FC<Record<string, unknown>>; defaultProps: Record<string, unknown> };

const scenes = new Map<string, SceneDef>();

export const registerScene = (id: string, def: { component: React.FC<never>; defaultProps: Record<string, unknown> }) => {
  scenes.set(id, def as unknown as SceneDef);
};

export const getScene = (id: string) => scenes.get(id);
