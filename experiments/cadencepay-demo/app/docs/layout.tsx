import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav, DocsPager } from "@/components/docs/DocsNav";

export const metadata: Metadata = {
  title: { default: "Docs", template: "%s · CadencePay docs" },
  description: "Build recurring payments on CKB where the payer keeps control: quickstart, SDK reference, on-chain rules and deployments.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-blush-2">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="text-pink text-2xl whitespace-nowrap">
            <span className="font-semibold tracking-[-0.06em]">Cadence</span><span className="font-serif italic">Pay</span>
            <span className="ml-2 align-middle font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">Docs</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <a href="https://github.com/Linnnetteseven/ckbuilders/tree/main/experiments" target="_blank" rel="noreferrer" className="text-ink-2 hover:text-pink hidden sm:inline">GitHub</a>
            <a href="https://www.npmjs.com/package/cadencepay" target="_blank" rel="noreferrer" className="text-ink-2 hover:text-pink hidden sm:inline">npm</a>
            <Link href="/app" className="pill pill-sm">Launch demo</Link>
          </nav>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-14 lg:self-start py-4 lg:py-10 border-b border-line lg:border-0">
          <DocsNav />
        </aside>
        <main id="main" className="doc py-10 lg:py-12 min-w-0 max-w-3xl">
          {children}
          <DocsPager />
        </main>
      </div>
    </>
  );
}
