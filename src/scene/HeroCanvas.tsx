import { Suspense, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { autopilotBrake } from "../sim/autopilot.ts";
import type { DriveSim } from "../sim/DriveSim.ts";
import { PLAYER_Z } from "./Car.tsx";
import { World } from "./World.tsx";

const LOOP_END = 25.5; // s: accelerate -> cruise -> brake for the red -> wait -> accelerate again, then loop

/** Autopilot drives the same sim the live graph reads; loops with a short fade so the reset isn't a visible pop. */
function HeroRunner({ sim }: { sim: DriveSim }) {
  const dom = useThree((s) => s.gl.domElement);
  useFrame((_, dt) => {
    sim.setBrake(autopilotBrake(sim));
    sim.step(dt);
    if (sim.t > LOOP_END) sim.reset();
    dom.style.opacity = String(Math.max(0, Math.min(1, sim.t / 0.7, (LOOP_END - sim.t) / 0.7)));
  });
  return null;
}

/** Slow low-angle side tracking shot; the car sits right of centre on wide screens so the headline has room. */
function HeroCamera({ sim }: { sim: DriveSim }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const seen = useRef(-1);
  const pos = useRef(new THREE.Vector3());
  useFrame((state, dt) => {
    const wide = size.width / size.height > 1.25;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 9);
    const shift = wide ? 0.6 : -0.6; // look slightly behind the car so it sits right of centre, clear of the headline
    pos.current.set(sim.x, 1.25 + Math.sin(state.clock.elapsedTime * 0.35) * 0.08, 11.5);
    if (seen.current !== sim.epoch || state.clock.elapsedTime < 0.1) { camera.position.copy(pos.current); seen.current = sim.epoch; }
    camera.position.lerp(pos.current, k);
    camera.lookAt(camera.position.x - shift, 0.95, PLAYER_Z - 0.2);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== 36) { cam.fov = 36; cam.updateProjectionMatrix(); }
  });
  return null;
}

export default function HeroCanvas({ sim, active }: { sim: DriveSim; active: boolean }) {
  return (
    <Canvas shadows dpr={[1, 1.5]} frameloop={active ? "always" : "never"} camera={{ fov: 36, near: 0.1, far: 500, position: [0, 1.25, 11.5] }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}>
      <Suspense fallback={null}>
        <World sim={sim} hero><HeroCamera sim={sim} /></World>
        <HeroRunner sim={sim} />
      </Suspense>
    </Canvas>
  );
}
