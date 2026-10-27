import { Check, X } from "lucide-react";
import { useState } from "react";
import { isCorrect, type BuiltQuestion } from "../sim/questions.ts";
import { GlassCard } from "./Glass.tsx";

/** One question. Remount it (key = question id) for each new question. Reports the verdict once, on submit. */
export function QuestionCard({ q, index, total, onAnswered, onNext }: {
  q: BuiltQuestion; index: number; total: number; onAnswered: (correct: boolean) => void; onNext: () => void;
}) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const done = result !== null;

  const submitNumeric = () => {
    const n = Number(text.replace(",", "."));
    if (text.trim() === "" || Number.isNaN(n) || done) return;
    const ok = isCorrect(q, n); setResult(ok); onAnswered(ok);
  };
  const pick = (i: number) => {
    if (done) return;
    setPicked(i); const ok = isCorrect(q, i); setResult(ok); onAnswered(ok);
  };

  return (
    <GlassCard className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs uppercase tracking-wider text-indigo-300">Question {index + 1} of {total}</span>
        <span className="text-[11px] uppercase tracking-wider text-slate-500">{q.group === "data" ? "From your drive" : "Concept"}</span>
      </div>
      <h3 className="text-xl sm:text-2xl font-semibold leading-snug mb-6">{q.prompt}</h3>
      {q.usedReference && (
        <p className="mb-5 text-xs text-amber-300/90 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
          Your drive didn’t include this stretch, so this question uses the sample drive shown on the graph.
        </p>
      )}

      {q.kind === "numeric" ? (
        <form onSubmit={(e) => { e.preventDefault(); submitNumeric(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input autoFocus inputMode="decimal" value={text} disabled={done} onChange={(e) => setText(e.target.value)} placeholder="Your answer"
              aria-label="Your answer"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 pr-16 font-mono text-lg outline-none focus:border-indigo-400/60 disabled:opacity-70" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">{q.unit}</span>
          </div>
          {!done && <button type="submit" className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all">Check</button>}
        </form>
      ) : (
        <div className="grid gap-3">
          {q.options!.map((o, i) => {
            const isRight = i === q.correctIndex; const isPick = i === picked;
            const state = !done ? "border-white/10 hover:border-indigo-400/50 hover:bg-white/[0.08]" : isRight ? "border-emerald-400/60 bg-emerald-400/10" : isPick ? "border-rose-400/60 bg-rose-400/10" : "border-white/5 opacity-60";
            return (
              <button key={i} onClick={() => pick(i)} disabled={done} className={`text-left px-5 py-4 rounded-xl border bg-white/5 transition-all flex items-center gap-3 ${state}`}>
                <span className="w-6 h-6 shrink-0 rounded-full border border-white/20 text-xs flex items-center justify-center font-mono text-slate-300">{"ABCD"[i]}</span>
                <span>{o}</span>
                {done && isRight && <Check className="ml-auto w-5 h-5 text-emerald-400" />}
                {done && isPick && !isRight && <X className="ml-auto w-5 h-5 text-rose-400" />}
              </button>
            );
          })}
        </div>
      )}

      {done && (
        <div className="mt-6 animate-[fadeUp_.3s_ease-out]">
          <div className={`flex items-center gap-2 font-semibold mb-3 ${result ? "text-emerald-300" : "text-rose-300"}`}>
            {result ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            {result ? "Correct" : q.kind === "numeric" ? `Not quite — the answer is ${Number(q.answer!.toFixed(2))} ${q.unit ?? ""}` : "Not quite"}
          </div>
          <div className="rounded-2xl bg-black/30 border border-white/10 p-4 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Worked solution</div>{q.solution}
          </div>
          <button onClick={onNext} autoFocus className="mt-5 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-all">
            {index + 1 === total ? "See my results" : "Next question →"}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
