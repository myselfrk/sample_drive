import { CAR_FRONT } from "./constants.ts";
import { autopilotBrake } from "./autopilot.ts";
import { DriveSim, type DriveRecord, type Phase, type Sample } from "./DriveSim.ts";

/** A stretch of the drive with one phase. Contiguous: seg[i].t1 === seg[i+1].t0. */
export interface Segment {
  phase: Phase;
  t0: number; t1: number;
  v0: number; v1: number;
  x0: number; x1: number;
}

export const dur = (s: Segment) => s.t1 - s.t0;
export const slope = (s: Segment) => (s.v1 - s.v0) / (s.t1 - s.t0);
export const area = (s: Segment) => s.x1 - s.x0; // distance = area under the v-t line

const MIN_SEGMENT = 0.5; // s; shorter blips (a brake tap) are merged into a neighbour

function group(samples: Sample[]): Segment[] {
  const segs: Segment[] = [];
  let prev = samples[0];
  let cur: Segment | null = null;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    if (s.t <= prev.t) continue;
    if (!cur || cur.phase !== s.phase) {
      // a sample is labelled with the phase of the step that produced it, so a segment starts at
      // the previous sample (the exact boundary state) and runs to the last sample with its label
      cur = { phase: s.phase, t0: prev.t, t1: s.t, v0: prev.v, v1: s.v, x0: prev.x, x1: s.x };
      segs.push(cur);
    } else {
      cur.t1 = s.t; cur.v1 = s.v; cur.x1 = s.x;
    }
    prev = s;
  }
  return segs;
}

export function buildSegments(samples: Sample[]): Segment[] {
  if (samples.length < 2) return [];
  let segs = group(samples);
  // fold micro-segments into the previous segment (or the next, for the first one), then re-merge
  for (let guard = 0; guard < 50; guard++) {
    const i = segs.findIndex((s) => dur(s) < MIN_SEGMENT);
    if (segs.length < 2) break;
    if (i < 0) break;
    const into = i > 0 ? i - 1 : 1;
    const a = segs[Math.min(i, into)], b = segs[Math.max(i, into)];
    const keep = i > 0 ? a : b; // the neighbour that survives keeps its phase
    segs.splice(Math.min(i, into), 2, {
      phase: keep.phase, t0: a.t0, t1: b.t1, v0: a.v0, v1: b.v1, x0: a.x0, x1: b.x1,
    });
  }
  for (let i = segs.length - 1; i > 0; i--) {
    if (segs[i].phase === segs[i - 1].phase) {
      segs[i - 1] = { ...segs[i - 1], t1: segs[i].t1, v1: segs[i].v1, x1: segs[i].x1 };
      segs.splice(i, 1);
    }
  }
  return segs;
}

/** Speed at time t, linearly interpolated between samples. */
export function speedAt(samples: Sample[], t: number): number {
  if (!samples.length) return 0;
  if (t <= samples[0].t) return samples[0].v;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].t >= t) {
      const a = samples[i - 1], b = samples[i];
      return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t || 1);
    }
  }
  return samples[samples.length - 1].v;
}

/** Index of the signal this brake segment was aimed at (stop line within 60 m ahead of where it ended), or -1. */
export function signalForBrake(seg: Segment, record: DriveRecord): number {
  for (const s of record.signals) {
    const gap = s.lineX - (seg.x1 + CAR_FRONT);
    if (gap > -8 && gap < 60) return s.index;
  }
  return -1;
}

// ---- reference drive -------------------------------------------------------------------------
// A scripted, deterministic drive used when the player skips the game (or lacks a segment a
// question needs): the autopilot brakes as soon as a signal turns yellow and releases on green.
let referenceCache: DriveRecord | null = null;
export function getReferenceDrive(): DriveRecord {
  if (referenceCache) return referenceCache;
  const sim = new DriveSim(1);
  for (let guard = 0; guard < 120 * 600 && !sim.finished; guard++) {
    sim.setBrake(autopilotBrake(sim));
    sim.step(1 / 120);
  }
  referenceCache = sim.toRecord();
  return referenceCache;
}
