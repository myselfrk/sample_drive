import { useMemo, useState } from "react";
import type { DriveRecord } from "../sim/DriveSim.ts";
import { V_MAX } from "../sim/constants.ts";
import { speedAt } from "../sim/analysis.ts";
import type { Highlight } from "../sim/questions.ts";
import { PHASE_COLOR, PHASE_LABEL, SIGNAL_COLOR } from "./phaseColors.ts";

const W = 820, H = 340, M = { l: 52, r: 18, t: 20, b: 40 };
const Y_MAX = 18;

/** Phase-coloured v-t graph of the whole drive: signal markers, hover read-out, and question highlights. */
export function ResultGraph({ record, highlight }: { record: DriveRecord; highlight: Highlight }) {
  const [hover, setHover] = useState<number | null>(null);
  const tEnd = Math.max(5, Math.ceil(record.duration / 10) * 10);
  const X = (t: number) => M.l + (t / tEnd) * (W - M.l - M.r);
  const Y = (v: number) => H - M.b - (v / Y_MAX) * (H - M.t - M.b);
  const s = record.samples;

  const runs = useMemo(() => {
    const out: { phase: keyof typeof PHASE_COLOR; pts: [number, number][] }[] = [];
    for (let i = 1; i < s.length; i++) {
      const last = out[out.length - 1];
      if (!last || last.phase !== s[i].phase) out.push({ phase: s[i].phase, pts: [[s[i - 1].t, s[i - 1].v]] });
      out[out.length - 1].pts.push([s[i].t, s[i].v]);
    }
    return out;
  }, [s]);

  const path = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");

  // polygon under the line between t0 and t1 (distance = area)
  const areaPoly = (t0: number, t1: number) => {
    const pts: [number, number][] = [[t0, speedAt(s, t0)]];
    for (const p of s) if (p.t > t0 && p.t < t1) pts.push([p.t, p.v]);
    pts.push([t1, speedAt(s, t1)]);
    return `${path(pts)} L${X(t1)},${Y(0)} L${X(t0)},${Y(0)} Z`;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = ((px - M.l) / (W - M.l - M.r)) * tEnd;
    setHover(t >= 0 && t <= record.duration ? t : null);
  };
  const hv = hover === null ? null : speedAt(s, hover);
  const hx = hover === null ? 0 : (() => { // distance so far at the hovered time (interpolated)
    let i = s.findIndex((p) => p.t >= hover); if (i < 1) i = 1;
    const a = s[i - 1], b = s[i]; return a.x + ((b.x - a.x) * (hover - a.t)) / (b.t - a.t || 1);
  })();

  const h = highlight;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        role="img" aria-label="Speed–time graph of your drive">
        {/* grid */}
        {[0, 6, 12, 18].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke="white" strokeOpacity={v === 0 ? 0.3 : 0.07} />
            <text x={M.l - 8} y={Y(v)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize="11" fontFamily="var(--font-mono)">{v}</text>
          </g>
        ))}
        {Array.from({ length: Math.floor(tEnd / 10) + 1 }, (_, i) => i * 10).map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={M.t} y2={H - M.b} stroke="white" strokeOpacity={0.05} />
            <text x={X(t)} y={H - M.b + 16} textAnchor="middle" className="fill-slate-400" fontSize="11" fontFamily="var(--font-mono)">{t}</text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={Y(V_MAX)} y2={Y(V_MAX)} stroke="#818cf8" strokeOpacity={0.3} strokeDasharray="2 5" />
        <text x={M.l + 4} y={M.t - 6} className="fill-slate-400" fontSize="11" fontFamily="var(--font-mono)">v (m/s)</text>
        <text x={W - M.r} y={H - 6} textAnchor="end" className="fill-slate-400" fontSize="11" fontFamily="var(--font-mono)">t (s)</text>

        {/* highlights sit under the line */}
        {h.kind === "area" && (
          <g>
            <path d={areaPoly(h.t0, h.t1)} fill="#a78bfa" fillOpacity={0.28} stroke="#a78bfa" strokeDasharray="4 3" />
            <text x={X((h.t0 + h.t1) / 2)} y={Y(speedAt(s, (h.t0 + h.t1) / 2) / 2)} textAnchor="middle" fill="#ddd6fe" fontSize="12" fontWeight="600">area = distance</text>
          </g>
        )}
        {h.kind === "span" && <rect x={X(h.t0)} y={M.t} width={Math.max(2, X(h.t1) - X(h.t0))} height={H - M.t - M.b} fill="#94a3b8" fillOpacity={0.18} />}
        {h.kind === "slope" && (
          <g stroke="#fbbf24" strokeDasharray="5 4" fill="none" strokeWidth={1.5}>
            <path d={`M${X(h.t0)},${Y(h.v0)} L${X(h.t1)},${Y(h.v0)} L${X(h.t1)},${Y(h.v1)}`} />
            <text x={X((h.t0 + h.t1) / 2)} y={Y(h.v0) - 8} textAnchor="middle" fill="#fcd34d" stroke="none" fontSize="12" fontFamily="var(--font-mono)">Δt = {(h.t1 - h.t0).toFixed(1)} s</text>
            <text x={X(h.t1) + 8} y={(Y(h.v0) + Y(h.v1)) / 2} fill="#fcd34d" stroke="none" fontSize="12" fontFamily="var(--font-mono)">Δv = {(h.v1 - h.v0).toFixed(1)} m/s</text>
          </g>
        )}

        {/* the drive, one stroke per phase */}
        {runs.map((r, i) => (
          <g key={i}>
            <path d={`${path(r.pts)} L${X(r.pts[r.pts.length - 1][0])},${Y(0)} L${X(r.pts[0][0])},${Y(0)} Z`} fill={PHASE_COLOR[r.phase]} fillOpacity={0.1} />
            <path d={path(r.pts)} fill="none" stroke={PHASE_COLOR[r.phase]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}

        {/* signal changes */}
        {record.events.filter((e) => e.type === "signal-yellow" || e.type === "signal-red" || e.type === "signal-green").map((e, i) => {
          const c = SIGNAL_COLOR[e.type.slice(7) as keyof typeof SIGNAL_COLOR];
          return (
            <g key={i}>
              <line x1={X(e.t)} x2={X(e.t)} y1={M.t + 6} y2={H - M.b} stroke={c} strokeOpacity={0.55} strokeDasharray="3 3" />
              <circle cx={X(e.t)} cy={M.t + 6} r={3.5} fill={c} />
            </g>
          );
        })}

        {h.kind === "point" && (
          <g>
            <line x1={X(h.t)} x2={X(h.t)} y1={Y(h.v)} y2={Y(0)} stroke="#fbbf24" strokeDasharray="4 3" />
            <line x1={M.l} x2={X(h.t)} y1={Y(h.v)} y2={Y(h.v)} stroke="#fbbf24" strokeDasharray="4 3" />
            <circle cx={X(h.t)} cy={Y(h.v)} r={6} fill="#fbbf24" fillOpacity={0.3} stroke="#fbbf24" />
          </g>
        )}

        {hover !== null && hv !== null && (
          <g pointerEvents="none">
            <line x1={X(hover)} x2={X(hover)} y1={M.t} y2={H - M.b} stroke="white" strokeOpacity={0.35} />
            <circle cx={X(hover)} cy={Y(hv)} r={4.5} fill="#fff" />
          </g>
        )}
      </svg>
      {hover !== null && hv !== null && (
        <div className="pointer-events-none absolute top-2 right-3 rounded-xl bg-white/10 border border-white/10 backdrop-blur px-3 py-2 font-mono text-xs text-slate-200 leading-5">
          <div>t = {hover.toFixed(1)} s</div><div>v = {hv.toFixed(1)} m/s</div><div>x = {hx.toFixed(0)} m</div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-400">
        {(Object.keys(PHASE_COLOR) as (keyof typeof PHASE_COLOR)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-2"><span className="w-3 h-1 rounded-full" style={{ background: PHASE_COLOR[k] }} />{PHASE_LABEL[k]}</span>
        ))}
        <span className="inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Signal change (dashed)</span>
      </div>
    </div>
  );
}
