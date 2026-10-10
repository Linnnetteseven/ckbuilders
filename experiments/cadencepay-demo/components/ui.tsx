import Link from "next/link";
import type { ReactNode } from "react";
import { EXPLORER_TX, shortHash } from "@/lib/cadencepay";

export const btn = {
  primary:
    "press inline-flex items-center justify-center gap-2 rounded-md bg-ink text-white px-5 py-3 text-sm font-semibold hover:bg-rose disabled:bg-muted disabled:cursor-not-allowed",
  secondary:
    "press inline-flex items-center justify-center gap-2 rounded-md border border-border bg-white px-4 py-2.5 text-sm font-medium hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed",
  quiet:
    "press inline-flex items-center gap-1 text-sm text-muted hover:text-ink",
};

export function Avatar({ initials, hue, size = "md" }: { initials: string; hue: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "w-9 h-9 text-xs", md: "w-12 h-12 text-sm", lg: "w-20 h-20 text-xl" }[size];
  return (
    <div
      aria-hidden
      className={`${dims} rounded-2xl shrink-0 flex items-center justify-center font-semibold text-white`}
      style={{ background: `linear-gradient(140deg, ${hue}, color-mix(in oklab, ${hue} 55%, #1C1814))` }}
    >
      {initials}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "warn" | "ok"; children: ReactNode }) {
  const cls = {
    error: "border-red-200 bg-red-50 text-red-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    ok: "border-forest/20 bg-mint text-forest",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border rounded-md px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`bg-surface rounded-md animate-pulse ${className}`} />;
}

/** Receipt line shown after every subscribe, claim, top-up and cancel. */
export function Receipt({ label, txHash }: { label: string; txHash: string }) {
  return (
    <Alert tone="ok">
      {label} ·{" "}
      <a href={EXPLORER_TX(txHash)} target="_blank" rel="noreferrer" className="font-mono tnum underline break-all">
        receipt {shortHash(txHash)}
      </a>
    </Alert>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap justify-between items-center gap-4 text-xs text-muted">
        <span>CadencePay · CKB testnet demo · unaudited, not for real funds</span>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
          <a href="https://github.com/Linnnetteseven/ckbuilders" target="_blank" rel="noreferrer" className="hover:text-ink">Source</a>
          <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer" className="hover:text-ink">Testnet faucet</a>
        </nav>
      </div>
    </footer>
  );
}
