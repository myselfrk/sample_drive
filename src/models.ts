import { useGLTF } from "@react-three/drei";

// Single declaration of every GLB the scenes can load (same idea as GravityGrid's MODEL_PATHS).
// Every model MUST ship geometry-compressed: scripts/check-models.mjs fails predev/prebuild otherwise.
// To add one: build it in Blender -> blender/exports/*.raw.glb -> scripts/optimize-models.sh -> add it here.
const base = import.meta.env.BASE_URL;
export const MODEL_PATHS = {
  car: `${base}models/car.glb`,
  signal: `${base}models/signal.glb`,
  road: `${base}models/road.glb`,
  tree: `${base}models/tree.glb`,
  streetlight: `${base}models/streetlight.glb`,
  buildings: `${base}models/buildings.glb`,
} as const;

export type ModelKey = keyof typeof MODEL_PATHS;

export function preloadModels() {
  for (const p of Object.values(MODEL_PATHS)) useGLTF.preload(p);
}
