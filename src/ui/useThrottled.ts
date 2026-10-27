import { useEffect, useRef, useState } from "react";

/** Samples `read()` at `hz` and re-renders only when the shallow-compared result changes. Never per frame. */
export function useThrottled<T extends object>(read: () => T, hz = 10): T {
  const readRef = useRef(read);
  readRef.current = read;
  const [value, setValue] = useState<T>(() => read());
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = readRef.current();
      setValue((prev) => {
        for (const k of Object.keys(next) as (keyof T)[]) if (prev[k] !== next[k]) return next;
        return prev;
      });
    }, 1000 / hz);
    return () => window.clearInterval(id);
  }, [hz]);
  return value;
}
