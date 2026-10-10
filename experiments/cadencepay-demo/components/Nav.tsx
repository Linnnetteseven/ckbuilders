"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { IconWallet } from "@/components/icons";

const LINKS = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" || p.startsWith("/c/") },
  { href: "/dashboard", label: "Memberships", match: (p: string) => p.startsWith("/dashboard") },
  { href: "/creator", label: "For creators", match: (p: string) => p.startsWith("/creator") },
];

export function Nav() {
  const pathname = usePathname();
  const { signer, address, connect, disconnect } = useWallet();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-line/80">
      <nav aria-label="Main" className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span aria-hidden className="w-6 h-6 rounded-full bg-pink grid place-items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-white" />
          </span>
          <span className="font-semibold text-[17px] tracking-tight">CadencePay</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap text-[13px] sm:text-sm px-2.5 sm:px-3.5 py-2 rounded-full transition-colors ${
                  active ? "text-ink font-semibold bg-soft" : "text-ink-2 hover:text-ink"
                } ${l.href === "/creator" ? "hidden md:inline-flex" : l.href === "/" ? "hidden sm:inline-flex" : ""}`}>
                {l.label}
              </Link>
            );
          })}

          {signer && short ? (
            <button onClick={() => void disconnect()} title="Disconnect wallet" className="pill pill-outline pill-sm ml-1.5 font-mono font-medium tnum">
              <IconWallet className="w-3.5 h-3.5" />{short}
            </button>
          ) : signer ? (
            <span aria-label="Loading wallet" className="ml-1.5 h-9 w-24 bg-soft rounded-full animate-pulse" />
          ) : (
            <button onClick={() => void connect()} className="pill pill-dark pill-sm ml-1.5">Connect</button>
          )}
        </div>
      </nav>
    </header>
  );
}
