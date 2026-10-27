import type { Phase } from "../sim/DriveSim.ts";

// Graph phase colours (GravityGrid's cyan / indigo / rose / slate palette).
export const PHASE_COLOR: Record<Phase, string> = {
  accelerate: "#22d3ee",
  cruise: "#818cf8",
  brake: "#fb7185",
  stopped: "#94a3b8",
};
export const PHASE_LABEL: Record<Phase, string> = {
  accelerate: "Accelerating",
  cruise: "Cruising",
  brake: "Braking",
  stopped: "Stopped",
};
export const SIGNAL_COLOR = { green: "#34d399", yellow: "#fbbf24", red: "#f43f5e" } as const;
