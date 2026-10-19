import Link from "next/link";
import { WalletChip } from "./WalletChip";

/** The app's nav: same paper pill as the landing page, sticky so it's always one tap away. */
export function AppNav() {
  return (
    <header className="sticky top-0 z-30 pt-3 px-4 sm:px-6 bg-gradient-to-b from-paper from-60% to-transparent pb-3">
      <nav aria-label="Main" className="max-w-6xl mx-auto">
        <div className="card flex items-center justify-between gap-2 sm:gap-3 !rounded-full px-3 sm:px-4 py-2">
          <Link href="/" className="slab text-sm min-[380px]:text-base sm:text-lg whitespace-nowrap flex items-center gap-1.5 sm:gap-2"><img src="/logo.png" alt="" width={28} height={28} className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" /><span>Message <span className="hand text-tomato text-lg min-[380px]:text-xl sm:text-2xl">in a</span> Cell</span></Link>
          <div className="flex items-center gap-3 sm:gap-4 label">
            <Link href="/#how" className="hidden md:inline hover:text-tomato">How it works</Link>
            {/* On phones "My capsules" lives in the wallet menu, to leave room for the wallet */}
            <Link href="/mine" className="hidden sm:inline hover:text-tomato whitespace-nowrap">My capsules</Link>
            {/* .btn sets its own display, so hide the wrapper on phones */}
            <span className="hidden md:inline"><Link href="/seal" className="btn !py-1.5 !px-3.5 !text-xs">Seal one</Link></span>
            <WalletChip />
          </div>
        </div>
      </nav>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-24 bg-night text-paper-2 relative">
      <div className="torn bg-paper absolute top-0 inset-x-0" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 flex flex-wrap items-center justify-between gap-4">
        <p className="hand text-2xl text-brass">see you on the day</p>
        <div className="flex flex-wrap gap-5 label text-paper-2/70">
          <Link href="/seal" className="hover:text-brass">Seal a message</Link>
          <Link href="/mine" className="hover:text-brass">My capsules</Link>
          <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer" className="hover:text-brass">Free test CKB</a>
          <span>CKB testnet · unaudited</span>
        </div>
      </div>
    </footer>
  );
}

/** Page heading: a handwritten kicker, a poster title, and a plain-language line. */
export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="hand text-2xl text-tomato -rotate-1">{kicker}</p>
      <h1 className="poster text-[clamp(3rem,10vw,5.5rem)] mt-1">{title}</h1>
      {children && <div className="mt-4 text-lg text-ink-2 max-w-[52ch] leading-relaxed">{children}</div>}
    </div>
  );
}

/** A numbered step: stamp card, number badge, title, and a handwritten hint. */
export function StepCard({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="card stamp relative p-5 sm:p-7">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <h2 id={`step-${n}`} className="flex items-center gap-3">
          <span className={`badge text-lg ${done ? "!bg-olive" : ""}`} aria-hidden>{done ? "✓" : n}</span>
          <span className="slab text-2xl">{title}</span>
        </h2>
        {hint && <p className="hand text-xl text-tomato text-right max-w-[16ch] leading-tight hidden sm:block">{hint}</p>}
      </div>
      {hint && <p className="hand text-lg text-tomato mt-1 sm:hidden relative z-10">{hint}</p>}
      <div className="relative z-10 mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** "What happens next" list with numbered dots on a dotted route. */
export function RouteSteps({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="relative space-y-5 pl-9">
      <span aria-hidden className="absolute left-[13px] top-2 bottom-2 border-l-2 border-dashed border-tomato/50" />
      {steps.map((s, i) => (
        <li key={s.title} className="relative">
          <span aria-hidden className="absolute -left-9 top-0 grid place-items-center w-7 h-7 rounded-full bg-tomato text-paper-2 slab text-sm border-2 border-ink">{i + 1}</span>
          <p className="slab text-lg leading-tight">{s.title}</p>
          <div className="text-ink-2 leading-relaxed mt-0.5">{s.body}</div>
        </li>
      ))}
    </ol>
  );
}
