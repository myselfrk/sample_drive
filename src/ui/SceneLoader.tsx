import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

/** Covers the canvas until the GLBs are in. GravityGrid look: pulsing indigo dot. */
export function SceneLoader({ ready = false }: { ready?: boolean }) {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  // `ready` is the real signal (scene mounted). Progress alone can stay at 0% when the models were
  // preloaded before this component mounted, so it can't be the only way out.
  const loaded = ready || (progress >= 100 && !active);
  useEffect(() => { if (loaded) { const t = setTimeout(() => setDone(true), 250); return () => clearTimeout(t); } }, [loaded]);
  return (
    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#050510] transition-opacity duration-500 ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <span className="relative flex h-5 w-5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-5 w-5 rounded-full bg-indigo-500" />
      </span>
      <p className="text-sm text-slate-400">Warming up the engine… {Math.round(ready ? 100 : progress)}%</p>
    </div>
  );
}
