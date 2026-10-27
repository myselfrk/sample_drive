import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

/** Covers the canvas until the GLBs are in. GravityGrid look: pulsing indigo dot. */
export function SceneLoader() {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  useEffect(() => { if (progress >= 100 && !active) { const t = setTimeout(() => setDone(true), 250); return () => clearTimeout(t); } }, [progress, active]);
  return (
    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#050510] transition-opacity duration-500 ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <span className="relative flex h-5 w-5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-5 w-5 rounded-full bg-indigo-500" />
      </span>
      <p className="text-sm text-slate-400">Warming up the engine… {Math.round(progress)}%</p>
    </div>
  );
}
