import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { MODEL_PATHS } from "../models.ts";

export const WHEEL_RADIUS = 0.34;
const WHEEL_NAMES = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"];

export interface CarModel {
  root: THREE.Object3D;
  /** Everything except the wheels: pitched under braking/acceleration while the wheels stay on the road. */
  body: THREE.Group;
  wheels: THREE.Object3D[];
  brakeLight: THREE.MeshStandardMaterial | null;
}

/** A private copy of car.glb (own materials, so paint / brake-light changes never leak between cars). */
export function useCarModel(paint?: string): CarModel {
  const { scene } = useGLTF(MODEL_PATHS.car);
  return useMemo(() => {
    const root = scene.clone(true);
    const cloned = new Map<THREE.Material, THREE.Material>();
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const src = mesh.material as THREE.Material;
      if (!cloned.has(src)) {
        const m = src.clone() as THREE.MeshStandardMaterial;
        mats[m.name] = m; cloned.set(src, m);
      }
      mesh.material = cloned.get(src)!;
    });
    if (paint && mats.CarPaint) mats.CarPaint.color.set(paint);
    const glass = mats.Glass as THREE.MeshPhysicalMaterial | undefined;
    if (glass) {
      // transmission would re-render the whole street a second time per frame; dark, glossy,
      // reflective glass reads the same at driving distance for a fraction of the cost
      glass.transmission = 0; glass.transparent = false; glass.opacity = 1;
      glass.color.set("#06090d"); glass.roughness = 0.04; glass.metalness = 0.0; glass.envMapIntensity = 1.6;
    }
    const brake = mats.BrakeLight ?? null;
    if (brake) brake.emissive.set("#ff1a1a");

    const carNode = root.getObjectByName("Car") ?? root;
    const body = new THREE.Group(); body.name = "body";
    for (const c of [...carNode.children]) if (!WHEEL_NAMES.includes(c.name)) body.add(c);
    carNode.add(body);
    const wheels = WHEEL_NAMES.map((n) => root.getObjectByName(n)!).filter(Boolean);
    return { root, body, wheels, brakeLight: brake };
  }, [scene, paint]);
}
