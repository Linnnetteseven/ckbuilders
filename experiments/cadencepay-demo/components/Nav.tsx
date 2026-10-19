"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/useWallet";
import { IconWallet } from "@/components/icons";

const LINKS = [
  { href: "/app", label: "Explore", match: (p: string) => p === "/app" || p.startsWith("/app/c/") },
  { href: "/app/dashboard", label: "Memberships", match: (p: string) => p.startsWith("/app/dashboard") },
  { href: "/app/creator", label: "For creators", match: (p: string) => p.startsWith("/app/creator") },
];

export function Nav() {
  const pathname = usePathname();
  const { signer, address, connect, disconnect } = useWallet();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-line/80">
      <nav aria-label="Main" className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-pink text-[1.45rem] leading-none whitespace-nowrap">
            <span className="font-semibold tracking-[-0.06em]">Cadence</span><span className="font-serif italic">Pay</span>
          </span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap text-[13px] sm:text-sm px-2.5 sm:px-3.5 py-2 rounded-full transition-colors ${
                  active ? "text-ink font-semibold bg-soft" : "text-ink-2 hover:text-ink"
                } ${l.href === "/app/creator" ? "hidden md:inline-flex" : l.href === "/app" ? "hidden sm:inline-flex" : ""}`}>
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
