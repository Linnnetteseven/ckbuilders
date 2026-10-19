"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CAPSULE_LOCK } from "@/lib/capsule";
import { useScrollProgress } from "./useScrollProgress";
import { Blueprint } from "./Blueprint";
import { TreasureMap } from "./TreasureMap";
import { WalletChip } from "./WalletChip";

const GITHUB = "https://github.com/Linnnetteseven/ckbuilders/tree/main/experiments";

/** Live testnet block height, so the page shows the chain it runs on is ticking. */
function useTipBlock() {
  const [tip, setTip] = useState<bigint | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("https://testnet.ckb.dev/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "get_tip_block_number", params: [] }),
    }).then((r) => r.json()).then((d: { result?: string }) => { if (alive && d.result) setTip(BigInt(d.result)); }).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return tip === null ? "…" : tip.toLocaleString("en");
}

function Nav() {
  return (
    <header className="absolute top-0 inset-x-0 z-20">
      <nav aria-label="Main" className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="card flex items-center justify-between gap-2 sm:gap-3 !rounded-full px-3 sm:px-4 py-2">
          <Link href="/" className="slab text-sm min-[380px]:text-base sm:text-lg whitespace-nowrap flex items-center gap-1.5 sm:gap-2"><img src="/logo.png" alt="" width={28} height={28} className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" /><span>Message <span className="hand text-tomato text-lg min-[380px]:text-xl sm:text-2xl">in a</span> Cell</span></Link>
          <div className="flex items-center gap-4 label">
            <a href="#how" className="hidden sm:inline hover:text-tomato">How it works</a>
            <Link href="/mine" className="hidden sm:inline hover:text-tomato">My capsules</Link>
            <span className="hidden sm:inline"><Link href="/seal" className="btn !py-1.5 !px-3.5 !text-xs">Seal one</Link></span>
            <WalletChip />
          </div>
        </div>
      </nav>
    </header>
  );
}

const YEAR = new Date().getFullYear();

function Hero({ block }: { block: string }) {
  const ink = { stroke: "var(--color-ink)", strokeWidth: 2.5, strokeLinejoin: "round" as const };
  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(#A9C7CF,#E6E2C8_62%)]">
      {/* landscape */}
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full" aria-hidden>
        <circle cx="1130" cy="230" r="90" fill="#F2C35B" stroke="var(--color-ink)" strokeWidth="2.5" className="hero-sun" />
        <g className="hero-far">
          <path d="M0 610 C180 520 300 560 460 500 C640 430 760 520 940 470 C1120 420 1260 500 1440 450 V900 H0 Z" fill="#9FB07A" {...ink} />
        </g>
        <g className="hero-near">
          <path d="M0 700 C220 640 380 690 620 650 C860 610 1060 680 1440 630 V900 H0 Z" fill="#B7A267" {...ink} />
          {/* soil strata, a cutaway */}
          <path d="M0 760 C300 735 560 770 820 745 C1080 720 1260 760 1440 740" stroke="rgba(30,27,22,.35)" strokeWidth="2" fill="none" strokeDasharray="10 8" />
          <path d="M0 820 C260 800 600 830 900 805 C1160 785 1320 815 1440 805" stroke="rgba(30,27,22,.3)" strokeWidth="2" fill="none" strokeDasharray="4 8" />
          {/* the buried capsule */}
          <g transform="translate(1010 770) rotate(-8)">
            <rect x="-58" y="-24" width="116" height="48" rx="24" fill="#D9A93B" {...ink} />
            <line x1="26" y1="-24" x2="26" y2="24" {...ink} />
            <circle cx="42" cy="0" r="9" fill="var(--color-tomato)" stroke="var(--color-ink)" strokeWidth="2" />
          </g>
          <path d="M990 690 l22 22 M1012 690 l-22 22" stroke="var(--color-tomato)" strokeWidth="7" strokeLinecap="round" />
        </g>
        {[[140, 170, 1.2], [560, 120, 0.9], [820, 260, 1]].map(([x, y, s], i) => (
          <path key={i} className="hero-cloud" style={{ "--k": i % 2 ? -1 : 1 } as React.CSSProperties}
            transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFDF6" stroke="var(--color-ink)" strokeWidth="2.5"
            d="M0 40 C-6 18 20 8 34 18 C40 -4 80 -6 88 18 C110 8 132 24 124 40 Z" />
        ))}
      </svg>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-32 sm:pt-36 pb-48">
        <p className="label">CKB testnet · block {block} · {YEAR} → whenever</p>
        <h1 className="mt-4 poster text-[clamp(4.2rem,14vw,11.5rem)]">
          Message
          <span className="block hand text-tomato text-[0.42em] [-webkit-text-stroke:0] [text-shadow:none] -my-[0.1em] ml-[0.2em]">in a</span>
          Cell
        </h1>
        <p className="mt-6 max-w-[34ch] text-lg sm:text-xl leading-relaxed">
          Seal a letter, a photo or a video with some CKB until a day that matters. When they open it, the message is theirs, and so is the CKB.
        </p>
        <p className="hand text-2xl text-tomato mt-2 -rotate-2">(the storage is part of the gift)</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/seal" className="btn">Seal a message</Link>
          <a href="#how" className="btn btn-ghost">How it works</a>
        </div>
      </div>
      <div className="torn absolute bottom-0 inset-x-0 rotate-180" />
    </section>
  );
}

function Stats() {
  const items: [string, string][] = [
    ["1 CKB", "per byte of message. It all goes to them."],
    ["0", "servers holding your words"],
    ["90", "days before an unopened gift can come home"],
    ["∞", "it stays readable after it's opened"],
  ];
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 text-center">
        {items.map(([n, t]) => (
          <li key={t}>
            <span className="badge text-4xl sm:text-5xl">{n}</span>
            <p className="mt-3 text-sm text-ink-2 max-w-[20ch] mx-auto">{t}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PARTS = [
  ["A letter", "Encrypted on your device. The key only travels inside the link you share."],
  ["A photo", "Stored inside the cell itself. Every byte locks 1 CKB, which goes to them when they open it."],
  ["A video or voice note", "Encrypted, then kept as a file whose fingerprint is written on-chain, so it can't be swapped."],
  ["The seal", "A lock that only opens on the date, for the person you chose. CKB's own clock decides."],
];

function BlueprintSection({ block }: { block: string }) {
  const [step, setStep] = useState(0);
  const ref = useScrollProgress<HTMLElement>("pin", (p) => {
    const s = Math.min(3, Math.floor(p * 4.4));
    setStep((c) => (c === s ? c : s));
  });
  return (
    <section ref={ref} aria-labelledby="bp-h" className="pin-track relative h-[340vh]">
      <div className="pin-sticky sticky top-0 h-dvh overflow-hidden bg-paper-2 border-y-2 border-ink">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 grid lg:grid-cols-[1fr_1.4fr] gap-6 items-center pt-16 pb-6">
          <div>
            <p className="label text-tomato">Fig. 1</p>
            <h2 id="bp-h" className="slab text-[clamp(2.2rem,4.5vw,3.8rem)] mt-2">What goes <span className="hand text-tomato">inside</span></h2>
            <ol className="mt-6 space-y-4">
              {PARTS.map(([t, d], i) => (
                <li key={t} className={`bp-step ${i <= step ? "is-on" : ""}`}>
                  <span className="slab text-xl">{String(i + 1).padStart(2, "0")} · {t}</span>
                  <p className="text-[15px] text-ink-2 leading-relaxed">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-h-0 h-[46vh] lg:h-[72vh]">
            <Blueprint codeHash={CAPSULE_LOCK.codeHash} block={block} />
          </div>
        </div>
      </div>
    </section>
  );
}

const USES = [
  { t: "A gift", hand: "for a day", d: "Birthdays, graduations, weddings. Pick the date; they open it then, not a moment before.", tilt: "-rotate-2" },
  { t: "If I'm gone", hand: "for later", d: "What happens to your crypto when you die. Check in now and then; if you stop, it opens for the person you chose.", tilt: "rotate-1" },
  { t: "Future me", hand: "for you", d: "A letter and some savings to your future self, locked until the day you set.", tilt: "-rotate-1" },
];

export function Landing() {
  const block = useTipBlock();
  return (
    <>
      <Nav />
      <main id="main" className="overflow-x-clip">
        <Hero block={block} />
        <Stats />
        <BlueprintSection block={block} />
        <div id="how" className="scroll-mt-0"><TreasureMap /></div>

        <section aria-labelledby="uses-h" className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <h2 id="uses-h" className="slab text-[clamp(2.2rem,4.5vw,3.8rem)]">Three ways <span className="hand text-tomato">to use it</span></h2>
          <ul className="mt-12 grid md:grid-cols-3 gap-8">
            {USES.map((u) => (
              <li key={u.t} className={`card stamp relative p-6 ${u.tilt} hover:rotate-0 transition-transform duration-300`}>
                <p className="hand text-2xl text-tomato">{u.hand}</p>
                <h3 className="slab text-3xl mt-1">{u.t}</h3>
                <p className="mt-3 text-ink-2 leading-relaxed">{u.d}</p>
                <Link href="/seal" className="btn btn-ghost !text-sm mt-5 relative z-10">Seal one</Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="honest-h" className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="card p-7 sm:p-10">
            <h2 id="honest-h" className="slab text-3xl">The honest bits</h2>
            <ul className="mt-5 space-y-3 text-ink-2 leading-relaxed list-disc pl-5 marker:text-tomato">
              <li>The CKB is truly locked until the date: CKB itself enforces it. The <em>message</em> is encrypted, but anyone holding the link has the key, so share the link privately.</li>
              <li>Every byte stored locks 1 CKB. A 30 KB photo means about 30,000 CKB inside the gift, and they receive all of it.</li>
              <li>If an unopened gift is never collected, you can take it back 90 days after its date. No earlier.</li>
              <li>This runs on CKB testnet with free test CKB, and the code hasn&apos;t been audited yet.</li>
            </ul>
            <p className="hand text-2xl text-tomato mt-4 -rotate-1">write something they&apos;ll keep</p>
          </div>
        </section>
      </main>

      <footer className="bg-night text-paper-2 relative">
        <div className="torn bg-paper absolute top-0 inset-x-0" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12 text-center">
          <p className="hand text-3xl text-brass">see you on the day</p>
          <h2 className="poster text-[clamp(3rem,9vw,7rem)] mt-2">Seal one</h2>
          <Link href="/seal" className="btn mt-8">Seal a message</Link>
          <div className="mt-16 flex flex-wrap justify-center gap-6 label text-paper-2/70">
            <Link href="/mine" className="hover:text-brass">My capsules</Link>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-brass">GitHub</a>
            <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer" className="hover:text-brass">Free test CKB</a>
            <span>CKB testnet · unaudited · sister of Sats in a Bottle</span>
          </div>
        </div>
      </footer>
    </>
  );
}
