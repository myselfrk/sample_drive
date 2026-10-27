import { BRAKE_DECEL } from "./constants.ts";
import type { DriveSim } from "./DriveSim.ts";

/**
 * A tidy driver: brake once the next signal is amber/red and the car needs ~stopping distance + 1.5 m
 * to stop at the line; keep braking until it's green. Used for the sample drive and the landing hero.
 */
export function autopilotBrake(sim: DriveSim): boolean {
  const n = sim.nextSignal();
  if (!n || n.signal.state === "green" || n.gap >= 70 || n.gap <= -1) return false;
  return sim.braking || n.gap <= (sim.v * sim.v) / (2 * BRAKE_DECEL) + 1.5;
}
