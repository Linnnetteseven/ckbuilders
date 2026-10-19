import Link from "next/link";
import type { Creator, Tier } from "@/lib/creators";
import { formatCkb } from "@/lib/cadencepay";
import { Avatar } from "@/components/Creator";

/**
 * Bars drawn from a hex string (the CadencePay code hash by default), so the
 * "barcode" on every ticket really is the rule that guards the membership.
 */
export function Barcode({ hex, className = "" }: { hex: string; className?: string }) {
  const nibbles = hex.replace(/^0x/, "").slice(0, 40).split("").map((c) => parseInt(c, 16));
  // Lay bars out left to right: width from the nibble, gap from its higher bits
  const bars: { x: number; w: number }[] = [];
  const width = nibbles.reduce((x, n) => {
    const w = 1 + (n % 3);
    bars.push({ x, w });
    return x + w + 1 + ((n >> 2) % 2);
  }, 0);
  return (
    <svg viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" className={className} aria-hidden fill="currentColor">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={40} />)}
    </svg>
  );
}

/** A membership tier as a tear-off ticket: perks above the perforation, the price below. */
export function Ticket({ creator, tier, code, className = "", style }: {
  creator: Creator;
  tier: Tier;
  code: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Link href={`/app/c/${creator.slug}/join/${tier.id}`} style={style}
      className={`ticket group block w-[17rem] sm:w-[19rem] text-pink ${className}`}>
      <div className="rounded-t-[1.4rem] bg-white px-5 pt-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-2">{creator.name}</span>
          <Avatar creator={creator} size="sm" />
        </div>
        <div className="mt-2 font-serif italic text-[2.6rem] leading-none">{tier.name}</div>
        <ul className="mt-4 space-y-1.5 text-[13.5px] leading-snug text-ink-2">
          {tier.perks.slice(0, 2).map((p) => (
            <li key={p} className="flex gap-2"><span aria-hidden className="mt-[7px] w-1.5 h-1.5 shrink-0 rotate-45 bg-pink" />{p}</li>
          ))}
        </ul>
      </div>
      <div aria-hidden className="ticket-perf h-0 mx-4 border-t-2 border-dashed border-blush-2" />
      <div className="rounded-b-[1.4rem] bg-white px-5 pt-4 pb-5">
        <div className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.12em] uppercase">
          <span>Each period</span>
          <span className="text-[15px] tracking-normal font-semibold text-ink tnum">{formatCkb(tier.amount)} CKB</span>
        </div>
        <Barcode hex={code} className="mt-3 w-full h-10" />
        <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3">
          <span>{tier.intervalLabel}</span>
          <span className="text-pink group-hover:translate-x-0.5 transition-transform">Join →</span>
        </div>
      </div>
    </Link>
  );
}
