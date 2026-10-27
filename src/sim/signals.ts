import { CAR_FRONT, POLE_OFFSET, SIGNAL_LINES, YELLOW_DURATION, DT } from "./constants.ts";

export type SignalColor = "green" | "yellow" | "red";

export interface SignalConfig {
  index: number;
  lineX: number;
  poleX: number;
  turnsRed: boolean;
  triggerDist: number; // m before the stop line (measured from the car's front) when it turns yellow
  redDuration: number; // s
}

export interface SignalRuntime extends SignalConfig {
  state: SignalColor;
  stateT: number;
  triggered: boolean;
  passed: boolean;
  judged: boolean;
}

// mulberry32: tiny seeded PRNG so a "level" is replayable and the reference drive is deterministic.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three of the four signals turn red; one stays green to test whether the student brakes when they
// don't need to. Trigger distances leave room to stop: from 16 m/s the stopping distance is
// v^2 / 2a = 25.6 m, plus ~1 s of reaction (16 m) -> 41.6 m, so 50-75 m with a 2 s amber is fair.
export function makeSignals(seed = 1): SignalConfig[] {
  const rnd = mulberry32(seed);
  const stayGreen = Math.floor(rnd() * SIGNAL_LINES.length);
  return SIGNAL_LINES.map((lineX, index) => ({
    index,
    lineX,
    poleX: lineX + POLE_OFFSET,
    turnsRed: index !== stayGreen,
    triggerDist: Math.round(50 + rnd() * 25),
    redDuration: Math.round((4 + rnd() * 2) * 10) / 10,
  }));
}

export function toRuntime(c: SignalConfig): SignalRuntime {
  return { ...c, state: "green", stateT: 0, triggered: false, passed: false, judged: false };
}

export const gapToLine = (s: SignalConfig, carX: number) => s.lineX - (carX + CAR_FRONT);

/** Advances one signal by one physics step. Returns the new colour if it changed. */
export function stepSignal(s: SignalRuntime, carX: number): SignalColor | null {
  const gap = gapToLine(s, carX);
  if (s.state === "green" && !s.triggered && s.turnsRed && !s.passed && gap <= s.triggerDist) {
    s.state = "yellow"; s.stateT = 0; s.triggered = true;
    return "yellow";
  }
  if (s.state === "yellow") {
    s.stateT += DT;
    if (s.stateT >= YELLOW_DURATION) { s.state = "red"; s.stateT = 0; return "red"; }
  } else if (s.state === "red") {
    s.stateT += DT;
    if (s.stateT >= s.redDuration) { s.state = "green"; s.stateT = 0; return "green"; }
  }
  return null;
}
