import { useEffect, useRef } from "react";
import type { DriveEvent, Sample } from "../sim/DriveSim.ts";
import { V_MAX } from "../sim/constants.ts";
import { PHASE_COLOR, SIGNAL_COLOR } from "./phaseColors.ts";

export interface GraphSource { samples: Sample[]; t: number; events: DriveEvent[] }

interface Props {
  /** Read every animation frame. Return null before a drive exists. */
  getSource: () => GraphSource | null;
  windowSec?: number;
  className?: string;
}

const Y_MAX = 18;
const M = { l: 38, r: 12, t: 16, b: 24 };

/** Live speed-time graph on a 2D canvas, redrawn from the sim's sample buffer in its own rAF loop (no React state). */
export function LiveGraph({ getSource, windowSec = 30, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef(getSource);
  srcRef.current = getSource;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (w < 10 || h < 10) return;
      const src = srcRef.current();
      const tNow = src?.t ?? 0;
      const tMax = Math.max(windowSec, tNow), tMin = tMax - windowSec;
      const X = (t: number) => M.l + ((t - tMin) / windowSec) * (w - M.l - M.r);
      const Y = (v: number) => h - M.b - (v / Y_MAX) * (h - M.t - M.b);

      ctx.clearRect(0, 0, w, h);
      ctx.font = "10px 'Geist Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";

      // grid + axes
      ctx.lineWidth = 1;
      for (const v of [0, 6, 12, 18]) {
        ctx.strokeStyle = v === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.07)";
        ctx.beginPath(); ctx.moveTo(M.l, Y(v)); ctx.lineTo(w - M.r, Y(v)); ctx.stroke();
        ctx.fillStyle = "rgba(148,163,184,0.9)"; ctx.textAlign = "right";
        ctx.fillText(String(v), M.l - 6, Y(v));
      }
      // V_MAX reference
      ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(129,140,248,0.35)";
      ctx.beginPath(); ctx.moveTo(M.l, Y(V_MAX)); ctx.lineTo(w - M.r, Y(V_MAX)); ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (let t = Math.ceil(tMin / 10) * 10; t <= tMax; t += 10) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath(); ctx.moveTo(X(t), M.t); ctx.lineTo(X(t), h - M.b); ctx.stroke();
        ctx.fillStyle = "rgba(148,163,184,0.9)"; ctx.fillText(String(t), X(t), h - M.b + 6);
      }
      ctx.fillStyle = "rgba(148,163,184,0.75)"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("v (m/s)", M.l + 4, 2);
      ctx.textAlign = "right"; ctx.fillText("t (s)", w - M.r - 22, h - 11);

      if (!src || src.samples.length < 2) return;
      const s = src.samples;

      // signal markers
      for (const e of src.events) {
        if (e.t < tMin || (e.type !== "signal-yellow" && e.type !== "signal-red" && e.type !== "signal-green")) continue;
        const col = SIGNAL_COLOR[e.type.slice(7) as keyof typeof SIGNAL_COLOR];
        ctx.strokeStyle = col + "99"; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(X(e.t), M.t + 4); ctx.lineTo(X(e.t), h - M.b); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(e.t), M.t + 4, 3, 0, Math.PI * 2); ctx.fill();
      }

      // first visible sample (binary search)
      let lo = 0, hi = s.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid].t < tMin) lo = mid + 1; else hi = mid; }
      const start = Math.max(0, lo - 1);

      // coloured line, one stroke per phase run (the segment ending at sample i has phase s[i].phase),
      // with a soft fill underneath
      ctx.lineWidth = 2.25; ctx.lineJoin = "round"; ctx.lineCap = "round";
      const strokeRun = (a: number, b: number, phase: Sample["phase"]) => {
        const col = PHASE_COLOR[phase];
        ctx.strokeStyle = col; ctx.fillStyle = col + "1f";
        ctx.beginPath(); ctx.moveTo(X(s[a].t), Y(s[a].v));
        for (let k = a + 1; k <= b; k++) ctx.lineTo(X(s[k].t), Y(s[k].v));
        ctx.stroke();
        ctx.lineTo(X(s[b].t), Y(0)); ctx.lineTo(X(s[a].t), Y(0)); ctx.closePath(); ctx.fill();
      };
      if (start + 1 < s.length) {
        let runStart = start, runPhase = s[start + 1].phase;
        for (let i = start + 2; i < s.length; i++) {
          if (s[i].phase !== runPhase) { strokeRun(runStart, i - 1, runPhase); runStart = i - 1; runPhase = s[i].phase; }
        }
        strokeRun(runStart, s.length - 1, runPhase);
      }

      // current point
      const p = s[s.length - 1]; const col = PHASE_COLOR[p.phase];
      ctx.fillStyle = col + "33"; ctx.beginPath(); ctx.arc(X(p.t), Y(p.v), 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(p.t), Y(p.v), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [windowSec]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%", display: "block" }} />;
}
