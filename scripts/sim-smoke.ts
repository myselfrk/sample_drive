// Runs a scripted drive and prints the segments: slopes must be exactly +2 / 0 / -5 and the areas must add up.
import { DriveSim } from "../src/sim/DriveSim.ts";
import { buildSegments, area, slope, dur, getReferenceDrive } from "../src/sim/analysis.ts";

const rec = getReferenceDrive();
const segs = buildSegments(rec.samples);
let total = 0, bad = 0;
for (const s of segs) {
  const sl = slope(s);
  const ok = s.phase === "accelerate" ? Math.abs(sl - 2) < 0.06 : s.phase === "brake" ? Math.abs(sl + 5) < 0.12 : Math.abs(sl) < 1e-6;
  if (!ok) bad++;
  total += area(s);
  console.log(s.phase.padEnd(10), `t ${s.t0.toFixed(2)}-${s.t1.toFixed(2)}`, `v ${s.v0.toFixed(2)}->${s.v1.toFixed(2)}`, `slope ${sl.toFixed(3)}`, `dist ${area(s).toFixed(2)}`, ok ? "" : "  <-- BAD");
}
console.log("duration", rec.duration.toFixed(2), "distance", rec.distance.toFixed(2), "sum of areas", total.toFixed(2), "score", rec.score);
console.log("events:", rec.events.filter((e) => e.score !== undefined).map((e) => `${e.label}(${e.score})`).join(", "));
if (bad || Math.abs(total - rec.distance) > 0.01) { console.error("SMOKE FAILED"); process.exit(1); }
// player who never brakes should run every red that turns, and still finish
const sim = new DriveSim(1);
for (let i = 0; i < 120 * 200 && !sim.finished; i++) sim.step(1 / 120);
console.log("no-brake drive: finished", sim.finished, "t", sim.t.toFixed(1), "score", sim.score);
void dur;
console.log("SMOKE OK");
