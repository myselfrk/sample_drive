import { Gauge, MapPin, Timer, Trophy } from "lucide-react";
import type { DriveSim } from "../sim/DriveSim.ts";
import { MS_TO_KMH } from "../sim/constants.ts";
import { PHASE_COLOR, PHASE_LABEL, SIGNAL_COLOR } from "./phaseColors.ts";
import { useThrottled } from "./useThrottled.ts";

/** Read-only dashboard. Samples the sim ~10x/s through useThrottled: never a per-frame React update. */
export function Hud({ sim }: { sim: DriveSim }) {
  const d = useThrottled(() => {
    const n = sim.nextSignal();
    return {
      v: Math.round(sim.v * 10) / 10, x: Math.round(sim.x), t: Math.round(sim.t * 10) / 10, score: sim.score,
      phase: sim.phase, nextGap: n ? Math.max(0, Math.round(n.gap)) : -1, nextState: n ? n.signal.state : "green", nextIdx: n ? n.signal.index : -1,
    };
  }, 10);
  return (
    <div className="flex flex-col gap-2 w-44 sm:w-60">
      <div className="bg-[#050510]/55 border border-white/10 rounded-3xl backdrop-blur-xl px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-3xl sm:text-5xl font-semibold tabular-nums leading-none">{Math.round(d.v * MS_TO_KMH)}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1.5">km/h</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg tabular-nums text-slate-200">{d.v.toFixed(1)}</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">m/s</div>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 text-xs" style={{ color: PHASE_COLOR[d.phase] }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: PHASE_COLOR[d.phase] }} />{PHASE_LABEL[d.phase]}
        </div>
      </div>
      <div className="bg-[#050510]/55 border border-white/10 rounded-2xl backdrop-blur-xl px-2 sm:px-4 py-2.5 sm:py-3 grid grid-cols-3 gap-1 sm:gap-2 text-center">
        <Stat icon={<MapPin className="w-3.5 h-3.5" />} value={`${d.x}`} unit="m" />
        <Stat icon={<Timer className="w-3.5 h-3.5" />} value={d.t.toFixed(1)} unit="s" />
        <Stat icon={<Trophy className="w-3.5 h-3.5" />} value={`${d.score}`} unit="pts" />
      </div>
      {d.nextIdx >= 0 && (
        <div className="bg-[#050510]/55 border border-white/10 rounded-2xl backdrop-blur-xl px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 text-sm">
          <Gauge className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-slate-300">Signal {d.nextIdx + 1}</span>
          <span className="ml-auto font-mono tabular-nums">{d.nextGap} m</span>
          <span className="w-3 h-3 rounded-full" style={{ background: SIGNAL_COLOR[d.nextState], boxShadow: `0 0 10px ${SIGNAL_COLOR[d.nextState]}` }} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, unit }: { icon: React.ReactNode; value: string; unit: string }) {
  return (
    <div>
      <div className="flex justify-center text-slate-500 mb-1">{icon}</div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{unit}</div>
    </div>
  );
}
