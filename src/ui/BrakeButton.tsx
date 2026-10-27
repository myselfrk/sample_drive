import { useState } from "react";

/** Hold to brake. Pointer events so it works on touch; the same sim.setBrake the keyboard uses. */
export function BrakeButton({ onChange, disabled }: { onChange: (down: boolean) => void; disabled?: boolean }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => { if (disabled && v) return; setDown(v); onChange(v); };
  return (
    <button
      type="button" aria-label="Brake (hold)" aria-pressed={down}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
      onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none w-[88px] h-[88px] rounded-full border-2 font-bold tracking-widest text-xs uppercase transition-all duration-100
        ${down ? "bg-rose-500/90 border-rose-300 scale-95 shadow-[0_0_60px_10px_rgba(244,63,94,0.55)]" : "bg-rose-500/15 border-rose-400/50 hover:bg-rose-500/25 shadow-[0_0_30px_2px_rgba(244,63,94,0.18)]"}
        ${disabled ? "opacity-40" : ""}`}
    >
      Brake
    </button>
  );
}
