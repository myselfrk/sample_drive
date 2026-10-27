import type { ReactNode } from "react";

export function GlassCard({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl ${hover ? "hover:border-indigo-500/40 transition-all" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
      <span className="text-xs text-indigo-300 uppercase tracking-wider">{children}</span>
    </div>
  );
}
