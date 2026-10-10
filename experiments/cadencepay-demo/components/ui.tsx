import Link from "next/link";
import type { ReactNode } from "react";
import { EXPLORER_TX, shortHash } from "@/lib/cadencepay";
import { IconCheck, IconExternal } from "@/components/icons";

/** Pill buttons (styles in globals.css). */
export const btn = {
  primary: "pill",
  primaryLg: "pill pill-lg",
  primarySm: "pill pill-sm",
  dark: "pill pill-dark",
  darkSm: "pill pill-dark pill-sm",
  secondary: "pill pill-outline",
  secondarySm: "pill pill-outline pill-sm",
  white: "pill pill-white pill-lg",
  danger: "pill pill-danger pill-sm",
  quiet: "inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-pink transition-colors",
};

export function Alert({ tone = "error", children }: { tone?: "error" | "warn" | "ok"; children: ReactNode }) {
  const cls = { error: "bg-[#FDECEC] text-[#8A1C14]", warn: "bg-sand text-amber", ok: "bg-mint text-forest" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`bg-soft rounded-2xl animate-pulse ${className}`} />;
}

/** Receipt shown after joining, collecting, topping up and cancelling. */
export function Receipt({ label, txHash }: { label: string; txHash: string }) {
  return (
    <div role="status" className="rise flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium text-forest">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-forest text-white"><IconCheck className="w-3.5 h-3.5" /></span>
        {label}
      </span>
      <a href={EXPLORER_TX(txHash)} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-mono tnum text-forest/80 hover:text-forest">
        Receipt {shortHash(txHash, 6, 4)} <IconExternal className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap justify-between items-center gap-4 text-xs text-ink-3">
        <span>CadencePay · test-network demo · not for real money</span>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
          <a href="https://github.com/Linnnetteseven/ckbuilders" target="_blank" rel="noreferrer" className="hover:text-ink">Source code</a>
          <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer" className="hover:text-ink">Free test CKB</a>
        </nav>
      </div>
    </footer>
  );
}
