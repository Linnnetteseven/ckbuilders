"use client";
import { useEffect, useState } from "react";

const nowSecs = () => Math.floor(Number(new Date()) / 1000);

/** Poster-style countdown to a Unix time (seconds). Shows "It's time" once reached. */
export function Countdown({ to, size = "lg", label }: { to: number; size?: "lg" | "sm"; label?: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(nowSecs());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const left = Math.max(0, to - now);
  const parts: [number, string][] = [
    [Math.floor(left / 86400), "days"],
    [Math.floor((left % 86400) / 3600), "hours"],
    [Math.floor((left % 3600) / 60), "min"],
    [left % 60, "sec"],
  ];
  if (left === 0) return <p className={size === "lg" ? "slab text-4xl" : "slab text-lg"}>It&apos;s time.</p>;
  const big = size === "lg";
  return (
    <div role="timer" aria-label={`${label ?? "Opens in"} ${parts.map(([n, u]) => `${n} ${u}`).join(", ")}`}>
      {label && <p className="label mb-2">{label}</p>}
      <div className={`flex ${big ? "gap-2.5 sm:gap-4" : "gap-1.5"}`} aria-hidden>
        {parts.map(([n, u]) => (
          <div key={u} className="text-center">
            <span className={`badge tnum block ${big ? "text-3xl sm:text-5xl min-w-[2.6ch] py-1" : "text-base min-w-[2.4ch]"}`}>{String(n).padStart(2, "0")}</span>
            <span className={`label block mt-1.5 ${big ? "" : "!text-[9px]"}`}>{u}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
