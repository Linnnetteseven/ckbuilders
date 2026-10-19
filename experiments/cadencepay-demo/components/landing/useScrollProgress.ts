"use client";
import { useEffect, useRef } from "react";

/**
 * Scroll progress for one section, written straight to a `--p` CSS variable
 * (0 → 1) on every animation frame, so the page never re-renders while
 * scrolling. Everything that moves reads `var(--p)` in CSS.
 *
 * - "pin": the section is a tall track with a sticky child; 0 when its top
 *   reaches the top of the screen, 1 when its bottom reaches the bottom.
 * - "pass": 0 as the section enters at the bottom, 1 once it is mostly up.
 *
 * With reduced motion the value is pinned to 1, so everything shows its final,
 * readable state, and the CSS drops the sticky pinning.
 */
export function useScrollProgress<T extends HTMLElement>(
  mode: "pin" | "pass",
  onProgress?: (p: number) => void,
) {
  const ref = useRef<T>(null);
  const cb = useRef(onProgress);
  useEffect(() => { cb.current = onProgress; });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      cb.current?.(1);
      return;
    }
    let raf = 0;
    let last = -1;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const raw = mode === "pin" ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (vh * 0.75 + r.height * 0.4);
      const p = Math.min(1, Math.max(0, raw));
      if (Math.abs(p - last) > 0.0005) {
        last = p;
        el.style.setProperty("--p", p.toFixed(4));
        cb.current?.(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  return ref;
}
