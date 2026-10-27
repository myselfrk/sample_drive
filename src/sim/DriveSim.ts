import {
  ACCEL, BRAKE_DECEL, DT, FINISH_X, SAMPLE_EVERY, V_MAX,
} from "./constants.ts";
import {
  gapToLine, makeSignals, stepSignal, toRuntime,
  type SignalColor, type SignalConfig, type SignalRuntime,
} from "./signals.ts";

export type Phase = "accelerate" | "cruise" | "brake" | "stopped";

/** `phase` is the phase of the step that produced this sample. */
export interface Sample { t: number; x: number; v: number; a: number; phase: Phase }

export type EventType =
  | "signal-yellow" | "signal-red" | "signal-green"
  | "brake-start" | "brake-end" | "stopped" | "moved-off" | "crossed-line" | "finish";

export interface DriveEvent {
  t: number;
  x: number;
  v: number;
  type: EventType;
  signal?: number;
  color?: SignalColor; // for crossed-line: the colour at the moment of crossing
  gap?: number; // for signal-yellow / stopped: metres from the car's front to the stop line
  score?: number; // points awarded by this event
  label?: string; // toast text when it scored
}

export interface DriveRecord {
  samples: Sample[];
  events: DriveEvent[];
  signals: SignalConfig[];
  score: number;
  duration: number;
  distance: number;
  finished: boolean;
}

export const START_SCORE = 100;
export const MAX_RED_RUNS = 2;

export class DriveSim {
  t = 0;
  x = 0;
  v = 0;
  a = ACCEL;
  braking = false;
  finished = false;
  /** Set when the driver runs MAX_RED_RUNS red lights; the drive is over and must be restarted. */
  failed = false;
  redRuns = 0;
  phase: Phase = "accelerate";
  score = START_SCORE;
  signals: SignalRuntime[];
  samples: Sample[] = [];
  events: DriveEvent[] = [];
  /** Bumped by reset(); lets cameras snap instead of lerping across a teleport. */
  epoch = 0;
  /** Called for every scoring event, so the UI can toast it. Never setState from here per frame. */
  onScore?: (e: DriveEvent) => void;

  private acc = 0;
  private steps = 0;
  private lastPhase: Phase = "accelerate";
  private config: SignalConfig[];

  private seed: number;

  constructor(seed = 1) {
    this.seed = seed;
    this.config = makeSignals(seed);
    this.signals = this.config.map(toRuntime);
    this.pushSample("accelerate");
  }

  /** Back to the start line in place (the landing-page hero loops one sim instead of remounting the scene). */
  reset() {
    this.t = 0; this.x = 0; this.v = 0; this.a = ACCEL; this.braking = false; this.finished = false;
    this.failed = false; this.redRuns = 0;
    this.phase = "accelerate"; this.lastPhase = "accelerate"; this.score = START_SCORE;
    this.acc = 0; this.steps = 0; this.samples = []; this.events = [];
    this.config = makeSignals(this.seed);
    this.signals = this.config.map(toRuntime);
    this.pushSample("accelerate");
    this.epoch++;
  }

  setBrake(on: boolean) {
    if (on === this.braking || this.finished || this.failed) return;
    this.braking = on;
    this.log(on ? "brake-start" : "brake-end");
  }

  /** Advance by a frame's worth of wall time, in fixed physics steps. */
  step(frameDt: number) {
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= DT && !this.finished && !this.failed) {
      this.fixedStep();
      this.acc -= DT;
    }
  }

  private fixedStep() {
    let a: number;
    let phase: Phase;
    if (this.braking) {
      if (this.v > 0) { a = -BRAKE_DECEL; phase = "brake"; } else { a = 0; phase = "stopped"; }
    } else if (this.v < V_MAX) { a = ACCEL; phase = "accelerate"; } else { a = 0; phase = "cruise"; }

    // exact sample at every phase boundary, labelled with the phase that just ended
    if (phase !== this.lastPhase) {
      if (phase === "accelerate" && this.lastPhase === "stopped") this.log("moved-off");
      this.pushSample(this.lastPhase);
    }

    // kinematics, with exact clamping at v = 0 and v = V_MAX. When a clamp lands mid-step, record the
    // exact instant it happened so segment slopes/areas stay exact (and the next phase starts there).
    const v0 = this.v;
    const t0 = this.t;
    let clampedAt = -1;
    if (a < 0 && v0 + a * DT <= 0) {
      const te = v0 / -a;
      this.x += v0 * te + 0.5 * a * te * te;
      this.v = 0;
      clampedAt = te;
    } else if (a > 0 && v0 + a * DT >= V_MAX) {
      const te = (V_MAX - v0) / a;
      this.x += v0 * te + 0.5 * a * te * te + V_MAX * (DT - te);
      this.v = V_MAX;
      clampedAt = te;
    } else {
      this.x += v0 * DT + 0.5 * a * DT * DT;
      this.v = v0 + a * DT;
    }
    this.t += DT;
    this.a = a;
    this.phase = phase;
    this.steps++;

    const exact = clampedAt >= 0 && clampedAt < DT;
    if (exact) {
      const xe = this.x - (phase === "accelerate" ? V_MAX * (DT - clampedAt) : 0);
      this.samples.push({ t: t0 + clampedAt, x: xe, v: this.v, a, phase });
    }
    if (this.postStep(phase, !exact)) return;
    // after an exact clamp the next step starts the following phase, so don't emit a second boundary sample
    this.lastPhase = exact ? (phase === "brake" ? "stopped" : "cruise") : phase;
  }

  /** Returns true when the drive finished. */
  private postStep(phase: Phase, periodicSample: boolean): boolean {
    if (phase === "brake" && this.v === 0) this.onStopped();
    this.updateSignals();

    if (this.x >= FINISH_X) {
      this.finished = true;
      this.pushSample(phase);
      this.log("finish");
      return true;
    }
    if (periodicSample && this.steps % SAMPLE_EVERY === 0) this.pushSample(phase);
    return false;
  }

  private updateSignals() {
    for (const s of this.signals) {
      const changed = stepSignal(s, this.x);
      if (changed) this.log(`signal-${changed}`, { signal: s.index, gap: gapToLine(s, this.x) });
      if (!s.passed && gapToLine(s, this.x) <= 0) {
        s.passed = true;
        this.log("crossed-line", { signal: s.index, color: s.state });
        if (s.state === "red") {
          this.award(-30, "Ran the red light", "crossed-line", s.index);
          if (++this.redRuns >= MAX_RED_RUNS) this.failed = true;
        }
        else if (s.state === "yellow") this.award(0, "Made it on amber", "crossed-line", s.index);
      }
    }
  }

  // Judge a full stop against the next signal ahead.
  private onStopped() {
    const s = this.signals.find((q) => !q.passed);
    this.log("stopped", { signal: s?.index, gap: s ? gapToLine(s, this.x) : undefined });
    if (!s || s.judged) return;
    const gap = gapToLine(s, this.x);
    if (gap > 90) return; // not stopping for any signal
    s.judged = true;
    if (s.state === "green") this.award(-5, "Stopped at a green", "stopped", s.index);
    else if (gap <= 2) this.award(10, "Perfect stop", "stopped", s.index);
    else if (gap <= 6) this.award(5, "Good stop", "stopped", s.index);
    else if (gap > 10) this.award(-5, "Too cautious", "stopped", s.index);
  }

  private award(points: number, label: string, type: EventType, signal: number) {
    this.score += points;
    const e = this.log(type, { signal, score: points, label });
    this.onScore?.(e);
  }

  private log(type: EventType, extra: Partial<DriveEvent> = {}): DriveEvent {
    const e: DriveEvent = { t: this.t, x: this.x, v: this.v, type, ...extra };
    this.events.push(e);
    return e;
  }

  private pushSample(phase: Phase) {
    this.samples.push({ t: this.t, x: this.x, v: this.v, a: this.a, phase });
  }

  /** Next signal the car hasn't crossed yet, with its distance. */
  nextSignal(): { signal: SignalRuntime; gap: number } | null {
    const s = this.signals.find((q) => !q.passed);
    return s ? { signal: s, gap: gapToLine(s, this.x) } : null;
  }

  toRecord(): DriveRecord {
    return {
      samples: this.samples.map((s) => ({ ...s })),
      events: this.events.map((e) => ({ ...e })),
      signals: this.config.map((c) => ({ ...c })),
      score: Math.max(0, this.score),
      duration: this.t,
      distance: this.x,
      finished: this.finished,
    };
  }
}

