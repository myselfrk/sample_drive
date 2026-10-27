import { useCallback, type ReactNode } from "react";
import type { DriveSim } from "../sim/DriveSim.ts";
import { Car } from "./Car.tsx";
import { Atmosphere, PostFx } from "./Environment.tsx";
import { RoadMarkings, Street } from "./Street.tsx";
import { TrafficSignal } from "./TrafficSignal.tsx";

/** Everything in the 3D scene except the camera (passed as children). Remount it (key) when `sim` is replaced. */
export function World({ sim, hero = false, children }: { sim: DriveSim; hero?: boolean; children?: ReactNode }) {
  const getX = useCallback(() => sim.x, [sim]);
  return (
    <>
      <Atmosphere getX={getX} />
      <Street getX={getX} hero={hero} />
      <RoadMarkings />
      {sim.signals.map((s) => (
        <group key={s.index}>
          {!hero && <TrafficSignal sim={sim} index={s.index} side={1} />}
          <TrafficSignal sim={sim} index={s.index} side={-1} withLight={hero} />
        </group>
      ))}
      <Car sim={sim} />
      {children}
      <PostFx />
    </>
  );
}
