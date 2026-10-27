import { DriveSim } from "../src/sim/DriveSim.ts";
import { buildRound, isCorrect } from "../src/sim/questions.ts";

// a human-ish drive: brake when the next signal is yellow/red and close, release on green
const sim = new DriveSim(1);
for (let i = 0; i < 120 * 300 && !sim.finished; i++) {
  const n = sim.nextSignal();
  sim.setBrake(!!n && n.signal.state !== "green" && n.gap < 60 && n.gap > 0 && (sim.braking || n.gap < sim.v * sim.v / 10 + 4));
  sim.step(1 / 120);
}
const rec = sim.toRecord();
const round = buildRound(rec, 0);
console.log("questions:", round.length, round.map((q) => q.id).join(" "));
for (const q of round) {
  console.log(`\n[${q.id}] ${q.prompt}${q.usedReference ? "  (sample drive)" : ""}`);
  if (q.kind === "numeric") {
    console.log("  answer:", q.answer?.toFixed(2), q.unit, "| right ok:", isCorrect(q, q.answer!), "| 999 wrong:", !isCorrect(q, 999));
  } else console.log("  options:", q.options, "correct:", q.correctIndex, isCorrect(q, q.correctIndex!), !isCorrect(q, (q.correctIndex! + 1) % 4));
}
// a drive with nothing in it must still produce a full round from the sample drive
const empty = new DriveSim(1); empty.step(0.05);
const r2 = buildRound(empty.toRecord(), 0);
console.log("\nempty-drive round:", r2.length, r2.map((q) => q.id + (q.usedReference ? "*" : "")).join(" "));
if (round.length !== 10 || r2.length !== 10) { console.error("EXPECTED 10 QUESTIONS"); process.exit(1); }
console.log("QUESTIONS OK");
