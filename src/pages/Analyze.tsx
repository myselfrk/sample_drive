import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getReferenceDrive } from "../sim/analysis.ts";
import type { DriveRecord } from "../sim/DriveSim.ts";
import { buildRound, type BuiltQuestion } from "../sim/questions.ts";
import { MS_TO_KMH } from "../sim/constants.ts";
import { useDriveStore } from "../store/useDriveStore.ts";
import { Background } from "../ui/Background.tsx";
import { GlassCard } from "../ui/Glass.tsx";
import { Navbar } from "../ui/Navbar.tsx";
import { QuestionCard } from "../ui/QuestionCard.tsx";
import { ResultGraph } from "../ui/ResultGraph.tsx";

export default function Analyze() {
  const stored = useDriveStore((s) => s.record);
  const attempt = useDriveStore((s) => s.attempt);
  const nextAttempt = useDriveStore((s) => s.nextAttempt);
  const navigate = useNavigate();
  const sample = !stored; // direct visit: fall back to the bundled sample drive
  const record = useMemo(() => stored ?? getReferenceDrive(), [stored]);
  const questions = useMemo(() => buildRound(record, attempt), [record, attempt]);

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      <Background />
      <Navbar minimal />
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-20">
        {sample && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 flex flex-wrap items-center gap-x-3 gap-y-1">
            Using a sample drive.<Link to="/drive" className="underline font-semibold">Drive for real</Link> to get questions about your own graph.
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Analyze <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400">your drive</span></h1>
        <p className="text-slate-400 mb-8">Every question below is about the graph you drew.</p>
        {/* remounts (fresh answers) whenever a new round is generated */}
        <Quiz key={`${attempt}-${record.duration}`} record={record} questions={questions}
          onDriveAgain={() => { nextAttempt(); navigate("/drive"); }} onNewRound={nextAttempt} />
      </main>
    </div>
  );
}

function Quiz({ record, questions, onDriveAgain, onNewRound }: { record: DriveRecord; questions: BuiltQuestion[]; onDriveAgain: () => void; onNewRound: () => void }) {
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const finished = idx >= questions.length;
  const q = questions[idx];
  const correct = results.filter(Boolean).length;
  const top = useMemo(() => Math.max(...record.samples.map((s) => s.v)), [record]);
  // scoring events reuse the "stopped" type, so count only the plain stop events
  const stops = record.events.filter((e) => e.type === "stopped" && e.score === undefined).length;

  return (
    <>
      <GlassCard className="p-4 sm:p-6 mb-6">
        <ResultGraph record={record} highlight={finished ? { kind: "none" } : q.highlight} />
      </GlassCard>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Stat label="Total time" value={`${record.duration.toFixed(1)} s`} />
        <Stat label="Distance" value={`${record.distance.toFixed(0)} m`} />
        <Stat label="Max speed" value={`${(top * MS_TO_KMH).toFixed(0)} km/h`} />
        <Stat label="Avg speed" value={`${((record.distance / record.duration) * MS_TO_KMH).toFixed(0)} km/h`} />
        <Stat label="Full stops" value={`${stops}`} />
        <Stat label="Drive score" value={`${record.score}`} />
      </div>

      {!finished && (
        <>
          <div className="flex items-center gap-1.5 mb-4" aria-label="Progress">
            {questions.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < results.length ? (results[i] ? "bg-emerald-400" : "bg-rose-400") : i === idx ? "bg-indigo-400" : "bg-white/10"}`} />
            ))}
          </div>
          <QuestionCard key={q.id} q={q} index={idx} total={questions.length}
            onAnswered={(ok) => setResults((r) => [...r, ok])} onNext={() => setIdx((i) => i + 1)} />
        </>
      )}

      {finished && (
        <GlassCard className="p-8 sm:p-10 text-center">
          <Trophy className="w-10 h-10 text-amber-300 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">{correct} / {questions.length} correct</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            {correct >= 9 ? "You read that graph like a physicist." : correct >= 6 ? "Solid. Revisit slope and area and go again." : "Try another drive: slope is acceleration, area is distance."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={onDriveAgain} className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all">Drive again</button>
            <button onClick={onNewRound} className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10">New questions, same drive</button>
          </div>
        </GlassCard>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl px-4 py-3">
      <div className="font-mono text-lg tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
