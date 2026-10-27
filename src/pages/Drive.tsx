import { ChevronDown, ChevronUp, Flag, OctagonX, RotateCcw } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { ChaseCamera } from "../scene/ChaseCamera.tsx";
import { World } from "../scene/World.tsx";
import { DriveSim, type DriveEvent } from "../sim/DriveSim.ts";
import { useDriveStore } from "../store/useDriveStore.ts";
import { BrakeButton } from "../ui/BrakeButton.tsx";
import { GlassCard } from "../ui/Glass.tsx";
import { Hud } from "../ui/Hud.tsx";
import { LiveGraph } from "../ui/LiveGraph.tsx";
import { Navbar } from "../ui/Navbar.tsx";
import { SceneLoader } from "../ui/SceneLoader.tsx";

type Stage = "countdown" | "driving" | "done" | "failed";
interface Toast { id: number; label: string; score: number }

/** Steps the sim from the render loop (refs only: the only React state changes are one-offs like finishing). */
function SimRunner({ sim, runningRef, onFinish, onFail }: { sim: DriveSim; runningRef: React.RefObject<boolean>; onFinish: () => void; onFail: () => void }) {
  const fired = useRef(false);
  useFrame((_, dt) => {
    if (runningRef.current) sim.step(dt);
    if (sim.failed && !fired.current) { fired.current = true; onFail(); }
    if (sim.finished && !fired.current) { fired.current = true; onFinish(); }
  });
  return null;
}

/** Mounts only once everything above it in the Suspense boundary (the GLBs) has resolved. */
function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

export default function Drive() {
  const navigate = useNavigate();
  const setRecord = useDriveStore((s) => s.setRecord);
  const nextAttempt = useDriveStore((s) => s.nextAttempt);
  const [run, setRun] = useState(0);
  const sim = useMemo(() => { void run; return new DriveSim(1); }, [run]);
  // dev-only handle for automated play-throughs (scratch scripts drive the real page)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __sim?: DriveSim }).__sim = sim; }, [sim]);
  const [stage, setStage] = useState<Stage>("countdown");
  const [count, setCount] = useState<number | "GO">(3);
  const [sceneReady, setSceneReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [graphOpen, setGraphOpen] = useState(() => window.innerWidth >= 640);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [summary, setSummary] = useState<{ score: number; time: number; top: number } | null>(null);
  const runningRef = useRef(false);
  const stageRef = useRef<Stage>("countdown");
  stageRef.current = stage;
  runningRef.current = stage === "driving" && !paused;

  const brake = useCallback((down: boolean) => {
    if (down && (stageRef.current !== "driving" || !runningRef.current)) return;
    sim.setBrake(down);
  }, [sim]);

  // scoring toasts (rare, so plain state is fine)
  useEffect(() => {
    sim.onScore = (e: DriveEvent) => {
      const id = e.t * 1000 + Math.random();
      setToasts((t) => [...t.slice(-2), { id, label: e.label ?? "", score: e.score ?? 0 }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
    };
    return () => { sim.onScore = undefined; };
  }, [sim]);

  // 3 - 2 - 1 - GO
  useEffect(() => {
    setStage("countdown"); setCount(3); setSceneReady(false); setSummary(null); setToasts([]); setPaused(false);
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      if (n > 0) setCount(n as 1 | 2);
      else if (n === 0) { setCount("GO"); setStage("driving"); }
      else { window.clearInterval(id); }
    }, 900);
    return () => window.clearInterval(id);
  }, [sim]);

  // keyboard brake (Space / ArrowDown) and pause on tab blur
  useEffect(() => {
    const isBrake = (e: KeyboardEvent) => e.code === "Space" || e.code === "ArrowDown";
    const down = (e: KeyboardEvent) => { if (!isBrake(e)) return; e.preventDefault(); if (!e.repeat) { setPaused(false); brake(true); } };
    const up = (e: KeyboardEvent) => { if (isBrake(e)) { e.preventDefault(); sim.setBrake(false); } };
    const pause = () => { if (stageRef.current === "driving") { sim.setBrake(false); setPaused(true); } };
    const vis = () => { if (document.hidden) pause(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("blur", pause); document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", vis);
    };
  }, [brake, sim]);

  const onFinish = useCallback(() => {
    const rec = sim.toRecord();
    setRecord(rec);
    setSummary({ score: rec.score, time: rec.duration, top: Math.max(...rec.samples.map((s) => s.v)) });
    setStage("done");
  }, [sim, setRecord]);

  const onFail = useCallback(() => { sim.setBrake(false); setStage("failed"); }, [sim]);

  const graphSource = useCallback(() => ({ samples: sim.samples, t: sim.t, events: sim.events }), [sim]);

  return (
    <div className="h-[100dvh] bg-neutral-950 text-white relative overflow-hidden select-none">
      <Navbar minimal />
      <div className="absolute inset-0 pt-16 sm:pt-20">
        <div className="relative w-full h-full">
          <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 55, near: 0.1, far: 600, position: [-9, 3.2, 1] }}
            gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}>
            <Suspense fallback={null}>
              <World key={run} sim={sim}><ChaseCamera sim={sim} /></World>
              <SceneReady key={run} onReady={() => setSceneReady(true)} />
              <SimRunner key={run} sim={sim} runningRef={runningRef} onFinish={onFinish} onFail={onFail} />
            </Suspense>
          </Canvas>
          <SceneLoader ready={sceneReady} />

          {/* HUD (top-left) */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-10"><Hud sim={sim} /></div>

          {/* controls (top-right) */}
          <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 flex items-center gap-2">
            <button onClick={() => setRun((r) => r + 1)} className="px-3.5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-xs text-slate-300 hover:bg-white/10 inline-flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>
          </div>

          {/* bottom controls. Desktop: graph bottom-right, brake bottom-centre. Mobile: brake stacked above the graph so they never overlap. */}
          <div className="absolute z-10 bottom-3 inset-x-3 sm:inset-x-auto sm:right-5 sm:bottom-5 flex flex-col items-center sm:items-end gap-3">
            <div className="sm:hidden flex flex-col items-center gap-1.5">
              <BrakeButton onChange={brake} disabled={stage !== "driving"} />
            </div>
            <div className="w-full sm:w-[22.5rem]">
              <GlassCard className="p-3 rounded-2xl !bg-[#050510]/70">
                <button onClick={() => setGraphOpen((o) => !o)} className="w-full flex items-center justify-between text-xs text-slate-400 uppercase tracking-wider mb-1">
                  <span>Speed–time graph · live</span>{graphOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                <div className={graphOpen ? "h-32 sm:h-[180px]" : "h-0 overflow-hidden"}><LiveGraph getSource={graphSource} windowSec={30} /></div>
              </GlassCard>
            </div>
          </div>
          <div className="hidden sm:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-2">
            <BrakeButton onChange={brake} disabled={stage !== "driving"} />
            <span className="text-[11px] uppercase tracking-wider text-slate-400">Hold <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono">Space</kbd> to brake</span>
          </div>

          {/* toasts */}
          <div className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
            {toasts.map((t) => (
              <div key={t.id} className={`px-4 py-2 rounded-full border backdrop-blur-xl text-sm font-semibold flex items-center gap-2 animate-[fadeUp_.3s_ease-out]
                ${t.score > 0 ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : t.score < 0 ? "bg-rose-500/15 border-rose-400/40 text-rose-200" : "bg-white/10 border-white/20 text-slate-200"}`}>
                {t.label}{t.score !== 0 && <span className="font-mono">{t.score > 0 ? `+${t.score}` : t.score}</span>}
              </div>
            ))}
          </div>

          {/* countdown */}
          {stage === "countdown" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
              <div key={String(count)} className="text-[9rem] sm:text-[12rem] font-bold leading-none bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 animate-[pop_.9s_ease-out]">{count}</div>
              <p className="text-slate-300 mt-2 text-center px-6">The car accelerates by itself. <span className="text-white font-semibold">You control the brake.</span></p>
            </div>
          )}
          {stage === "driving" && count === "GO" && <div key="go" className="absolute inset-x-0 top-1/3 z-20 text-center text-7xl font-bold text-white/90 pointer-events-none animate-[fadeOut_1s_ease-out_forwards]">GO</div>}

          {paused && stage === "driving" && (
            <button onClick={() => setPaused(false)} className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <span className="text-3xl font-bold">Paused</span><span className="text-slate-300 text-sm">Click or press a key to resume</span>
            </button>
          )}

          {stage === "failed" && (
            <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
              <GlassCard className="p-8 sm:p-10 max-w-md w-full text-center bg-neutral-900/70">
                <OctagonX className="w-8 h-8 text-rose-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-2">Drive over</h2>
                <p className="text-slate-400 mb-8">You broke the signal twice. That's a traffic rule violation, so please restart and try again.</p>
                <button onClick={() => setRun((r) => r + 1)} className="w-full px-6 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all">Restart</button>
              </GlassCard>
            </div>
          )}

          {stage === "done" && summary && (
            <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
              <GlassCard className="p-8 sm:p-10 max-w-md w-full text-center bg-neutral-900/70">
                <Flag className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-2">Drive complete</h2>
                <p className="text-slate-400 mb-6">Your drive drew a graph. Now let’s read it.</p>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <Summary label="Score" value={`${summary.score}`} /><Summary label="Time" value={`${summary.time.toFixed(1)} s`} /><Summary label="Top speed" value={`${(summary.top * 3.6).toFixed(0)} km/h`} />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => { nextAttempt(); navigate("/analyze"); }} className="flex-1 px-6 py-4 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all">Analyze my drive →</button>
                  <button onClick={() => setRun((r) => r + 1)} className="px-6 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10">Drive again</button>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 py-3">
      <div className="font-mono text-xl tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label}</div>
    </div>
  );
}
