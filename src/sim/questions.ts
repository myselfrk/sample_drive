import { ACCEL, BRAKE_DECEL, V_MAX, MS_TO_KMH } from "./constants.ts";
import type { DriveRecord } from "./DriveSim.ts";
import { area, buildSegments, dur, getReferenceDrive, signalForBrake, slope, speedAt, type Segment } from "./analysis.ts";
import { mulberry32 } from "./signals.ts";

// What the result graph should highlight while a question is on screen.
export type Highlight =
  | { kind: "none" }
  | { kind: "area"; t0: number; t1: number } // shade the area under the line (distance)
  | { kind: "slope"; t0: number; v0: number; t1: number; v1: number } // slope triangle (acceleration)
  | { kind: "span"; t0: number; t1: number } // a stretch of time (e.g. a stop)
  | { kind: "point"; t: number; v: number };

export interface BuiltQuestion {
  id: string;
  kind: "numeric" | "mcq";
  group: "data" | "concept";
  prompt: string;
  unit?: string;
  // numeric
  answer?: number;
  tolerance?: { rel: number; abs: number };
  signless?: boolean; // accept the magnitude (decelerations)
  // mcq
  options?: string[];
  correctIndex?: number;
  highlight: Highlight;
  solution: string; // worked solution, uses the student's own numbers
  usedReference?: boolean; // the player's drive lacked the needed segment; sample drive used instead
}

export function isCorrect(q: BuiltQuestion, given: number): boolean {
  if (q.kind === "mcq") return given === q.correctIndex;
  const target = q.answer ?? 0;
  const tol = Math.max((q.tolerance?.rel ?? 0.05) * Math.abs(target), q.tolerance?.abs ?? 0.5);
  const g = q.signless ? Math.abs(given) : given;
  return Math.abs(g - (q.signless ? Math.abs(target) : target)) <= tol;
}

// ---- context ---------------------------------------------------------------------------------
interface Side { record: DriveRecord; segs: Segment[]; ref: boolean }
interface Ctx { sides: [Side, Side]; rnd: () => number }

const f = (n: number, d = 1) => Number(n.toFixed(d)).toString();
const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth"][n - 1] ?? `#${n}`;

function find(ctx: Ctx, pred: (s: Segment, i: number, all: Segment[]) => boolean) {
  for (const side of ctx.sides) {
    const i = side.segs.findIndex(pred);
    if (i >= 0) return { seg: side.segs[i], index: i, side };
  }
  return null;
}

function brakeLabel(seg: Segment, side: Side): string {
  const sig = signalForBrake(seg, side.record);
  if (sig >= 0) return `for signal ${sig + 1}`;
  const n = side.segs.filter((s) => s.phase === "brake" && s.t0 <= seg.t0).length;
  return `in your ${ordinal(n)} braking`;
}

const startAccel = (s: Segment, i: number) => i === 0 && s.phase === "accelerate" && s.v0 < 0.5 && s.v1 >= V_MAX - 0.5;
const bigBrake = (s: Segment) => s.phase === "brake" && dur(s) >= 1 && s.v0 - s.v1 >= 3;

// ---- data-driven questions (computed from the player's own graph) ------------------------------
type Builder = (ctx: Ctx) => BuiltQuestion | null;

const D1: Builder = (ctx) => {
  const r = find(ctx, (s, i) => startAccel(s, i)) ?? find(ctx, (s) => s.phase === "accelerate" && dur(s) >= 2);
  if (!r) return null;
  const { seg } = r; const a = slope(seg);
  return {
    id: "D1", kind: "numeric", group: "data", unit: "m/s²", usedReference: r.side.ref,
    prompt: `From t = ${f(seg.t0)} s to t = ${f(seg.t1)} s your speed rose from ${f(seg.v0)} to ${f(seg.v1)} m/s. What was the car's acceleration?`,
    answer: a, tolerance: { rel: 0.05, abs: 0.1 },
    highlight: { kind: "slope", t0: seg.t0, v0: seg.v0, t1: seg.t1, v1: seg.v1 },
    solution: `The slope of a speed–time graph is the acceleration.\na = Δv / Δt = (${f(seg.v1)} − ${f(seg.v0)}) / (${f(seg.t1)} − ${f(seg.t0)}) = ${f(a, 2)} m/s².`,
  };
};

const D2: Builder = (ctx) => {
  const r = find(ctx, startAccel);
  if (!r) return null;
  const { seg } = r; const t = dur(seg);
  return {
    id: "D2", kind: "numeric", group: "data", unit: "s", usedReference: r.side.ref,
    prompt: "How long did your car take to reach its top speed from rest at the start?",
    answer: t, tolerance: { rel: 0.05, abs: 0.5 },
    highlight: { kind: "point", t: seg.t1, v: seg.v1 },
    solution: `Read off where the line stops rising and goes flat: it reaches ${f(seg.v1)} m/s at t = ${f(t)} s.\nCheck with t = (v − u) / a = (${f(seg.v1)} − 0) / ${f(ACCEL)} = ${f(seg.v1 / ACCEL)} s.`,
  };
};

const D3: Builder = (ctx) => {
  const r = find(ctx, startAccel);
  if (!r) return null;
  const { seg } = r; const s = area(seg);
  return {
    id: "D3", kind: "numeric", group: "data", unit: "m", usedReference: r.side.ref,
    prompt: `How far did the car travel during those first ${f(dur(seg))} seconds (the shaded triangle)?`,
    answer: s, tolerance: { rel: 0.05, abs: 1 },
    highlight: { kind: "area", t0: seg.t0, t1: seg.t1 },
    solution: `Distance is the area under the speed–time line. Here it is a triangle:\narea = ½ × base × height = ½ × ${f(dur(seg))} s × ${f(seg.v1)} m/s = ${f(s)} m.`,
  };
};

const D4: Builder = (ctx) => {
  const r = find(ctx, bigBrake);
  if (!r) return null;
  const { seg } = r; const a = slope(seg); const label = brakeLabel(seg, r.side);
  return {
    id: "D4", kind: "numeric", group: "data", unit: "m/s²", signless: true, usedReference: r.side.ref,
    prompt: `You braked ${label}, slowing from ${f(seg.v0)} m/s to ${f(seg.v1)} m/s in ${f(dur(seg))} s. What was the size of the deceleration?`,
    answer: Math.abs(a), tolerance: { rel: 0.05, abs: 0.15 },
    highlight: { kind: "slope", t0: seg.t0, v0: seg.v0, t1: seg.t1, v1: seg.v1 },
    solution: `a = Δv / Δt = (${f(seg.v1)} − ${f(seg.v0)}) / ${f(dur(seg))} = ${f(a, 2)} m/s².\nIt is negative because the car is slowing down, so the deceleration (retardation) is ${f(Math.abs(a), 2)} m/s².`,
  };
};

const D5: Builder = (ctx) => {
  const r = find(ctx, bigBrake);
  if (!r) return null;
  const { seg } = r; const s = area(seg); const label = brakeLabel(seg, r.side);
  const check = (seg.v0 * seg.v0 - seg.v1 * seg.v1) / (2 * BRAKE_DECEL);
  return {
    id: "D5", kind: "numeric", group: "data", unit: "m", usedReference: r.side.ref,
    prompt: `How far did the car travel while braking ${label} (the shaded region)?`,
    answer: s, tolerance: { rel: 0.05, abs: 1 },
    highlight: { kind: "area", t0: seg.t0, t1: seg.t1 },
    solution: `Distance = area under the line = ½ (u + v) × Δt = ½ × (${f(seg.v0)} + ${f(seg.v1)}) × ${f(dur(seg))} = ${f(s)} m.\nCross-check with v² = u² − 2as: s = (u² − v²) / 2a = (${f(seg.v0)}² − ${f(seg.v1)}²) / (2 × ${f(BRAKE_DECEL)}) = ${f(check)} m.`,
  };
};

const D6: Builder = (ctx) => {
  const rec = ctx.sides[0].record;
  if (rec.duration < 5) return null;
  const v = rec.distance / rec.duration;
  return {
    id: "D6", kind: "numeric", group: "data", unit: "m/s",
    prompt: `Your whole drive covered ${f(rec.distance, 0)} m in ${f(rec.duration)} s. What was your average speed?`,
    answer: v, tolerance: { rel: 0.05, abs: 0.3 },
    highlight: { kind: "none" },
    solution: `Average speed = total distance / total time = ${f(rec.distance, 0)} / ${f(rec.duration)} = ${f(v, 2)} m/s (${f(v * MS_TO_KMH)} km/h).\nIt is lower than your top speed because of the time spent speeding up and waiting. It is not the average of the speeds you read off the graph.`,
  };
};

const D7: Builder = (ctx) => {
  const r = find(ctx, (s) => s.phase === "stopped" && dur(s) >= 0.5);
  if (!r) return null;
  const { seg } = r; const sig = signalForBrake(seg, r.side.record);
  return {
    id: "D7", kind: "numeric", group: "data", unit: "s", usedReference: r.side.ref,
    prompt: `For how long was the car stationary ${sig >= 0 ? `at signal ${sig + 1}` : "during your first stop"} (the flat stretch on the time axis)?`,
    answer: dur(seg), tolerance: { rel: 0.05, abs: 0.4 },
    highlight: { kind: "span", t0: seg.t0, t1: seg.t1 },
    solution: `While the car is stopped the graph lies flat on the time axis (v = 0). That stretch runs from t = ${f(seg.t0)} s to t = ${f(seg.t1)} s, so Δt = ${f(dur(seg))} s.`,
  };
};

const D8: Builder = (ctx) => {
  const rec = ctx.sides[0].record;
  if (rec.duration < 6) return null;
  const t = Math.max(1, Math.round(rec.duration * (0.15 + 0.7 * ctx.rnd())));
  const v = speedAt(rec.samples, t);
  return {
    id: "D8", kind: "numeric", group: "data", unit: "m/s",
    prompt: `At t = ${t} s, what was the car's speed? Read it off the graph.`,
    answer: v, tolerance: { rel: 0.05, abs: 0.5 },
    highlight: { kind: "point", t, v },
    solution: `Go up from t = ${t} s on the time axis to the line, then across to the speed axis: v ≈ ${f(v)} m/s (≈ ${f(v * MS_TO_KMH)} km/h).`,
  };
};

const D9: Builder = (ctx) => {
  for (const side of ctx.sides) {
    const e = side.record.events.find((ev) => ev.type === "signal-yellow" && ev.gap !== undefined && ev.v > 5);
    if (!e) continue;
    const need = (e.v * e.v) / (2 * BRAKE_DECEL); const gap = e.gap ?? 0;
    return {
      id: "D9", kind: "numeric", group: "data", unit: "m", usedReference: side.ref,
      prompt: `When signal ${(e.signal ?? 0) + 1} turned yellow you were doing ${f(e.v)} m/s, ${f(gap, 0)} m from its stop line. What is the minimum distance needed to stop with the brake at ${f(BRAKE_DECEL)} m/s²?`,
      answer: need, tolerance: { rel: 0.05, abs: 1 },
      highlight: { kind: "none" },
      solution: `Use v² = u² − 2as with v = 0: s = u² / 2a = ${f(e.v)}² / (2 × ${f(BRAKE_DECEL)}) = ${f(need)} m.\nYou were ${f(gap, 0)} m away, so ${need <= gap ? `you had ${f(gap - need, 0)} m to spare, provided you braked at once.` : "you could not stop in time at that speed."}\nEvery 0.5 s you waited before braking cost another ${f(e.v * 0.5)} m.`,
    };
  }
  return null;
};

const D10: Builder = (ctx) => {
  const r = find(ctx, (s) => s.phase === "cruise" && dur(s) >= 3);
  if (!r) return null;
  const { seg } = r;
  const ta = Math.ceil(seg.t0 + 0.2); const tb = Math.min(Math.floor(seg.t1 - 0.2), ta + 5);
  if (tb - ta < 2) return null;
  const s = seg.v0 * (tb - ta);
  return {
    id: "D10", kind: "numeric", group: "data", unit: "m", usedReference: r.side.ref,
    prompt: `Between t = ${ta} s and t = ${tb} s the graph is flat at ${f(seg.v0)} m/s. How far did you travel in that interval?`,
    answer: s, tolerance: { rel: 0.05, abs: 1 },
    highlight: { kind: "area", t0: ta, t1: tb },
    solution: `A flat line means constant speed (a = 0). The area is a rectangle: distance = height × width = v × Δt = ${f(seg.v0)} × ${tb - ta} = ${f(s)} m.`,
  };
};

// ---- conceptual multiple choice ----------------------------------------------------------------
interface Concept { id: string; prompt: string; correct: string; wrong: string[]; why: string }
const CONCEPTS: Concept[] = [
  { id: "C1", prompt: "What does the slope of a speed–time graph represent?", correct: "Acceleration", wrong: ["Distance travelled", "Speed", "Time taken"],
    why: "Slope = rise / run = Δv / Δt, which is the definition of acceleration." },
  { id: "C2", prompt: "What does the area under a speed–time graph represent?", correct: "Distance travelled", wrong: ["Acceleration", "Average speed", "Force"],
    why: "Speed × time = distance, so the area between the line and the time axis is the distance covered." },
  { id: "C3", prompt: "While your car waited at a red light, what did the graph look like?", correct: "A horizontal line on the time axis (v = 0)",
    wrong: ["A line sloping upward", "A vertical line", "The graph stops"],
    why: "The car is at rest, so v = 0 the whole time. Time keeps passing, so the line runs along the time axis." },
  { id: "C4", prompt: "While cruising at top speed, the car's acceleration was…", correct: "Zero — the line is horizontal",
    wrong: ["Maximum", "Negative", "Equal to its speed"], why: "A horizontal line has zero slope, so Δv = 0 and a = 0. The speed is constant." },
  { id: "C5", prompt: "The braking parts of your graph slope downward. This means…", correct: "The car has negative acceleration (it is decelerating)",
    wrong: ["The car is moving backward", "Time is decreasing", "The car has stopped"],
    why: "Speed is falling, so Δv is negative. The car still moves forward, but it is slowing down." },
  { id: "C6", prompt: "Which part of your graph is steeper, accelerating or braking? Why?", correct: `Braking: ${f(BRAKE_DECEL)} m/s² is larger in size than ${f(ACCEL)} m/s²`,
    wrong: ["Accelerating, because the engine is stronger", "Both the same", "It depends on the speed"],
    why: `Steepness is the size of the acceleration. Braking changes speed by ${f(BRAKE_DECEL)} m/s every second, accelerating by only ${f(ACCEL)} m/s every second.` },
  { id: "C7", prompt: "If the brakes were twice as strong (10 m/s²), the stopping distance from the same speed would…", correct: "Halve (s = v² / 2a)",
    wrong: ["Double", "Quarter", "Stay the same"], why: "s = v² / 2a, so s is inversely proportional to a. Doubling a halves s." },
  { id: "C8", prompt: "If you were going twice as fast, the stopping distance with the same braking would become…", correct: "4 times as long (s ∝ v²)",
    wrong: ["Twice as long", "The same", "Half as long"], why: "s = v² / 2a, so s grows with the square of v. Doubling v makes s four times larger." },
  { id: "C9", prompt: "A driver reacts 0.5 s late while doing 16 m/s. How much extra distance do they cover before braking starts?", correct: "8 m (16 × 0.5)",
    wrong: ["4 m", "16 m", "32 m"], why: "Before the brakes act the car keeps its speed: s = v × t = 16 × 0.5 = 8 m." },
  { id: "C10", prompt: "A straight line sloping upward on a speed–time graph means…", correct: "Uniform (constant) acceleration",
    wrong: ["Constant speed", "Increasing acceleration", "The car is at rest"], why: "A straight line has a constant slope, so the acceleration is constant. Constant speed would be a flat line." },
  { id: "C11", prompt: "Two cars both reach 16 m/s from rest: car A in 8 s, car B in 4 s. Whose line is steeper, and what is B's acceleration?", correct: "Car B, 4 m/s²",
    wrong: ["Car A, 2 m/s²", "Same steepness", "Car B, 2 m/s²"], why: "B gains 16 m/s in 4 s: a = 16 / 4 = 4 m/s², steeper than A's 16 / 8 = 2 m/s²." },
  { id: "C12", prompt: "Why did braking to a full stop at a green light lower your score, in physics terms?", correct: "It wasted time, and your average speed fell",
    wrong: ["It damaged the car", "Green means accelerate harder", "There is no physics reason"],
    why: "Stopping adds a braking stretch, a wait, and a new acceleration stretch. The same distance takes longer, so average speed = distance / time drops." },
];

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildConcept(c: Concept, rnd: () => number): BuiltQuestion {
  const options = shuffle([c.correct, ...c.wrong], rnd);
  return { id: c.id, kind: "mcq", group: "concept", prompt: c.prompt, options, correctIndex: options.indexOf(c.correct), highlight: { kind: "none" }, solution: c.why };
}

// ---- a round ---------------------------------------------------------------------------------
const CORE: Builder[] = [D1, D2, D3, D4, D5, D6];
const EXTRA: Builder[] = [D7, D8, D9, D10];

/** 10 questions: the 6 core data-driven ones, plus 4 more (at least 2 conceptual) varied by `attempt`. */
export function buildRound(record: DriveRecord, attempt = 0): BuiltQuestion[] {
  const ref = getReferenceDrive();
  const rnd = mulberry32(Math.round(record.duration * 1000) + record.score * 31 + attempt * 7919);
  const ctx: Ctx = {
    sides: [
      { record, segs: buildSegments(record.samples), ref: false },
      { record: ref, segs: buildSegments(ref.samples), ref: true },
    ],
    rnd,
  };
  const core = CORE.map((b) => b(ctx)).filter((q): q is BuiltQuestion => !!q);
  const extras = EXTRA.map((b) => b(ctx)).filter((q): q is BuiltQuestion => !!q);
  const concepts = shuffle(CONCEPTS, rnd).map((c) => buildConcept(c, rnd));
  const chosen = concepts.slice(0, 2);
  const rest = shuffle([...extras, ...concepts.slice(2)], rnd);
  const need = 10 - core.length - chosen.length;
  chosen.push(...rest.slice(0, Math.max(need, 0)));
  return [...core, ...shuffle(chosen, rnd)];
}
