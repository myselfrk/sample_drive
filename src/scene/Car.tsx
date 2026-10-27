import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { V_MAX } from "../sim/constants.ts";
import type { DriveSim } from "../sim/DriveSim.ts";
import { useCarModel, WHEEL_RADIUS } from "./useCarModel.ts";

export const PLAYER_Z = 1.75; // right-hand lane (three +Z is to the car's right as it drives along +X)

/** The player's car: position, wheel spin, brake light and body pitch are driven straight from the sim (refs only). */
export function Car({ sim, paint = "#b5121b" }: { sim: DriveSim; paint?: string }) {
  const { root, body, wheels, brakeLight } = useCarModel(paint);
  const group = useRef<THREE.Group>(null);
  const prevX = useRef(sim.x);
  const pitch = useRef({ p: 0, pv: 0, glow: 0.4 });

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const g = group.current; if (!g) return;
    g.position.set(sim.x, 0, PLAYER_Z);

    const dx = sim.x - prevX.current; prevX.current = sim.x;
    if (Math.abs(dx) < 5) for (const w of wheels) w.rotateY(-dx / WHEEL_RADIUS); // skip the jump when a looping sim resets

    // weight transfer: nose dips under braking, lifts slightly under acceleration (critically damped spring)
    const target = sim.braking && sim.v > 0.2 ? -1.5 : sim.a > 0 && sim.v < V_MAX ? 0.8 : 0;
    const st = pitch.current;
    const k = 70, c = 2 * Math.sqrt(k);
    st.pv += (k * (THREE.MathUtils.degToRad(target) - st.p) - c * st.pv) * dt;
    st.p += st.pv * dt;
    body.rotation.z = st.p;

    if (brakeLight) {
      const want = sim.braking ? 6 : 0.4;
      st.glow += (want - st.glow) * (1 - Math.exp(-dt / 0.04)); // ~80 ms
      brakeLight.emissiveIntensity = st.glow;
    }
  });

  return <group ref={group}><primitive object={root} /></group>;
}

/** A parked / static copy, e.g. kerbside traffic. */
export function StaticCar({ position, rotationY = 0, paint }: { position: [number, number, number]; rotationY?: number; paint: string }) {
  const { root } = useCarModel(paint);
  return <group position={position} rotation-y={rotationY}><primitive object={root} /></group>;
}
