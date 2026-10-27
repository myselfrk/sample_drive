import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MODEL_PATHS } from "../models.ts";
import type { DriveSim } from "../sim/DriveSim.ts";
import type { SignalColor } from "../sim/signals.ts";

const LAMP: Record<SignalColor, { node: string; color: string }> = {
  red: { node: "Lamp_Red", color: "#ff2a1a" },
  yellow: { node: "Lamp_Yellow", color: "#ffb000" },
  green: { node: "Lamp_Green", color: "#22ff6a" },
};

/** One signal head on a pole. Lamps face -X (towards the approaching car). Lamp glow is driven by sim.signals[index].state. */
export function TrafficSignal({ sim, index, side = 1, withLight = true }: { sim: DriveSim; index: number; side?: 1 | -1; withLight?: boolean }) {
  const { scene } = useGLTF(MODEL_PATHS.signal);
  const light = useRef<THREE.PointLight>(null);
  const cfg = sim.signals[index];

  const { root, lamps } = useMemo(() => {
    const root = scene.clone(true);
    const cloned = new Map<THREE.Material, THREE.Material>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const src = m.material as THREE.Material;
      if (!cloned.has(src)) cloned.set(src, src.clone()); // per-instance: otherwise every signal lights up together
      m.material = cloned.get(src)!;
    });
    const lamps = {} as Record<SignalColor, THREE.MeshStandardMaterial>;
    (Object.keys(LAMP) as SignalColor[]).forEach((k) => {
      const mesh = root.getObjectByName(LAMP[k].node) as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.set(LAMP[k].color);
      lamps[k] = mat;
    });
    return { root, lamps };
  }, [scene]);

  const shown = useRef<SignalColor | null>(null);
  useEffect(() => { shown.current = null; }, [sim]);

  useFrame(() => {
    const state = sim.signals[index].state;
    if (state === shown.current) return;
    shown.current = state;
    (Object.keys(lamps) as SignalColor[]).forEach((k) => { lamps[k].emissiveIntensity = k === state ? 9 : 0.04; });
    if (light.current) { light.current.color.set(LAMP[state].color); light.current.intensity = 45; }
  });

  return (
    <group position={[cfg.poleX, 0, side * 4.7]} rotation-y={0}>
      <primitive object={root} />
      {withLight && <pointLight ref={light} position={[-0.6, 3.4, 0]} distance={16} decay={2} intensity={0} />}
    </group>
  );
}
