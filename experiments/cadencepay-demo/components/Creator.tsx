import type { CSSProperties } from "react";
import type { Creator } from "@/lib/creators";

/** Crisp geometric motif per creator, drawn in tints of their colour. */
function Motif({ slug }: { slug: string }) {
  const stroke = "rgba(255,255,255,.22)";
  const fill = "rgba(255,255,255,.10)";
  if (slug === "wanjiru-frames") {
    // camera aperture blades
    const blades = Array.from({ length: 6 }, (_, i) => i * 60);
    return (
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
        <g transform="translate(300 100)">
          <circle r="150" fill={fill} />
          <circle r="96" fill="none" stroke={stroke} strokeWidth="2" />
          {blades.map((a) => (
            <path key={a} d="M0 0 L96 -22 L60 74 Z" transform={`rotate(${a})`} fill="rgba(255,255,255,.08)" stroke={stroke} strokeWidth="1.5" />
          ))}
          <circle r="34" fill="rgba(0,0,0,.18)" />
        </g>
        <circle cx="40" cy="30" r="70" fill="rgba(255,255,255,.06)" />
      </svg>
    );
  }
  if (slug === "otieno-builds") {
    // lesson grid with code brackets
    return (
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
        {Array.from({ length: 11 }, (_, x) => Array.from({ length: 6 }, (_, y) => (
          <circle key={`${x}-${y}`} cx={20 + x * 38} cy={18 + y * 34} r="2.2" fill="rgba(255,255,255,.28)" />
        )))}
        <path d="M250 40 L210 100 L250 160" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M320 40 L360 100 L320 160" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M300 30 L270 170" stroke="rgba(255,255,255,.2)" strokeWidth="10" strokeLinecap="round" />
      </svg>
    );
  }
  // matatu-sound: sound rings and a waveform
  const bars = [18, 42, 70, 36, 88, 54, 104, 62, 30, 76, 48, 92, 40, 22, 58, 80, 34];
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
      {[60, 100, 140, 180].map((r) => <circle key={r} cx="320" cy="100" r={r} fill="none" stroke={stroke} strokeWidth="2" />)}
      <circle cx="320" cy="100" r="26" fill="rgba(255,255,255,.2)" />
      {bars.map((h, i) => <rect key={i} x={20 + i * 14} y={100 - h / 2} width="7" height={h} rx="3.5" fill="rgba(255,255,255,.22)" />)}
    </svg>
  );
}

export function Cover({ creator, className = "" }: { creator: Creator; className?: string }) {
  return (
    <div
      className={`${className.includes("absolute") ? "" : "relative"} overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${creator.hue}, color-mix(in oklab, ${creator.hue} 62%, #181512))` } as CSSProperties}
    >
      <Motif slug={creator.slug} />
    </div>
  );
}

export function Avatar({ creator, size = "md", ring = false }: { creator: Creator; size?: "sm" | "md" | "lg" | "xl"; ring?: boolean }) {
  const dims = { sm: "w-9 h-9 text-xs", md: "w-12 h-12 text-sm", lg: "w-20 h-20 text-xl", xl: "w-28 h-28 sm:w-32 sm:h-32 text-3xl" }[size];
  return (
    <div
      aria-hidden
      className={`${dims} relative z-10 rounded-full shrink-0 grid place-items-center font-semibold text-white ${ring ? "ring-4 ring-white shadow-[0_8px_24px_-10px_rgba(24,21,18,.5)]" : ""}`}
      style={{ background: `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${creator.hue} 70%, #fff), ${creator.hue} 60%, color-mix(in oklab, ${creator.hue} 70%, #181512))` }}
    >
      {creator.initials}
    </div>
  );
}

export function Chip({ tone = "pink", children }: { tone?: "pink" | "green" | "amber" | "gray"; children: React.ReactNode }) {
  const cls = {
    pink: "bg-blush text-pink-deep",
    green: "bg-mint text-forest",
    amber: "bg-sand text-amber",
    gray: "bg-soft text-ink-2",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{children}</span>;
}
