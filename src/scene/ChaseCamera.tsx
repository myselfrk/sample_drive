import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { DriveSim } from "../sim/DriveSim.ts";
import { V_MAX } from "../sim/constants.ts";
import { PLAYER_Z } from "./Car.tsx";

/** Behind-and-above chase camera: critically damped follow, speed-dependent FOV, light shake at speed. */
export function ChaseCamera({ sim }: { sim: DriveSim }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const look = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3(-9, 3.2, 1));
  const fov = useRef(55);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const k = 1 - Math.exp(-dt * 7);
    const want = new THREE.Vector3(sim.x - 9, 3.2, PLAYER_Z * 0.55);
    if (state.clock.elapsedTime < 0.1) pos.current.copy(want);
    pos.current.lerp(want, k);
    const shake = Math.max(0, sim.v - 12) / (V_MAX - 12) * 0.012;
    const t = state.clock.elapsedTime;
    cam.position.set(pos.current.x, pos.current.y + Math.sin(t * 31) * shake, pos.current.z + Math.cos(t * 27) * shake);
    look.current.lerp(new THREE.Vector3(sim.x + 8, 1.0, PLAYER_Z * 0.8), k);
    cam.lookAt(look.current);
    const f = 55 + 8 * (sim.v / V_MAX);
    fov.current += (f - fov.current) * k;
    if (Math.abs(cam.fov - fov.current) > 0.05) { cam.fov = fov.current; cam.updateProjectionMatrix(); }
  });
  return null;
}
