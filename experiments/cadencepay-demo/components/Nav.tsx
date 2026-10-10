"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/useWallet";

const LINKS = [
  { href: "/", label: "Explore", match: (p: string) => p === "/" || p.startsWith("/c/") },
  { href: "/dashboard", label: "Memberships", match: (p: string) => p.startsWith("/dashboard") },
  { href: "/creator", label: "Creators", match: (p: string) => p.startsWith("/creator") },
];

export function Nav() {
  const pathname = usePathname();
  const { signer, address, connect, disconnect } = useWallet();
  const short = address ? `${address.slice(0, 7)}…${address.slice(-4)}` : null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-bg/90 backdrop-blur-sm border-b border-border">
      <nav aria-label="Main" className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span aria-hidden className="w-5 h-5 rounded-md bg-rose" />
          <span className="font-semibold text-sm tracking-tight">CadencePay</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={`text-[13px] sm:text-sm px-2 sm:px-3 py-1.5 rounded-md transition-colors ${
                  active ? "text-ink font-medium bg-surface" : "text-muted hover:text-ink"
                } ${l.href === "/creator" ? "hidden sm:inline-flex" : ""}`}>
                {l.label}
              </Link>
            );
          })}

          {signer && short ? (
            <button onClick={() => void disconnect()} title="Disconnect wallet"
              className="press ml-1 text-xs font-mono tnum border border-border hover:border-rose hover:text-rose px-2.5 py-1.5 rounded-md">
              {short}
            </button>
          ) : signer ? (
            <span aria-label="Loading wallet" className="ml-1 h-8 w-20 bg-surface rounded-md animate-pulse" />
          ) : (
            <button onClick={() => void connect()}
              className="press ml-1 text-sm bg-ink hover:bg-rose text-white px-3.5 py-1.5 rounded-md font-medium">
              Connect
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
