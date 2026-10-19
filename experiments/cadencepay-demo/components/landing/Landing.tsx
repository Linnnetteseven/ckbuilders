"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, Cover } from "@/components/Creator";
import { IconArrowRight, IconCheck, IconX } from "@/components/icons";
import { CREATORS } from "@/lib/creators";
import { TESTNET } from "@/lib/cadencepay-sdk";
import { useScrollProgress } from "./useScrollProgress";
import { Ticket } from "./Ticket";

const CODE_HASH = TESTNET.cadencepay.codeHash;
const GITHUB = "https://github.com/Linnnetteseven/ckbuilders/tree/main/experiments";

/** The headline wordmark: plain sans "Cadence", italic serif "Pay". */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span className="font-semibold tracking-[-0.06em]">Cadence</span>
      <span className="font-serif italic tracking-[-0.02em] -ml-[0.02em]">Pay</span>
    </span>
  );
}

/** Live testnet block height, so the page shows the chain it runs on is moving. */
function TipBlock() {
  const [tip, setTip] = useState<bigint | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("https://testnet.ckb.dev/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "get_tip_block_number", params: [] }),
      })
        .then((r) => r.json())
        .then((d: { result?: string }) => { if (alive && d.result) setTip(BigInt(d.result)); })
        .catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <span className="font-mono text-[11px] tracking-[0.14em] uppercase tnum">
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-pink mr-2 align-middle live-dot" />
      CKB testnet {tip === null ? "· live" : `· block ${tip.toLocaleString("en")}`}
    </span>
  );
}

function TopBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-pink">
      <span className="text-[15px]">Recurring payments where the payer keeps control</span>
      <nav aria-label="Main" className="flex items-center gap-5 text-[15px]">
        <a href="#how" className="hover:underline">How it works</a>
        <Link href="/docs" className="hover:underline">Docs</Link>
        <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:underline hidden sm:inline">GitHub</a>
      </nav>
      <Link href="/app" className="pill pill-sm">Launch demo <IconArrowRight className="arrow w-3.5 h-3.5" /></Link>
    </div>
  );
}

/** Compact header that slides in once the giant wordmark has scrolled away. */
function StickyHeader({ show }: { show: boolean }) {
  return (
    <header aria-hidden={!show} className={`fixed top-0 inset-x-0 z-50 bg-white/92 backdrop-blur-md border-b border-blush-2 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${show ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="max-w-[90rem] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4 text-pink">
        <Link href="/" tabIndex={show ? 0 : -1} className="text-2xl"><Wordmark /></Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#how" tabIndex={show ? 0 : -1} className="hover:underline hidden sm:inline">How it works</a>
          <Link href="/docs" tabIndex={show ? 0 : -1} className="hover:underline">Docs</Link>
          <Link href="/app" tabIndex={show ? 0 : -1} className="pill pill-sm">Launch demo</Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-4 sm:px-8 pt-5 pb-16 sm:pb-24">
      <div className="max-w-[90rem] mx-auto">
        <div className="mt-8 sm:mt-14 grid lg:grid-cols-2 gap-10 items-end">
          <div className="order-2 lg:order-1 space-y-4 text-pink">
            <TipBlock />
            <p className="max-w-[38ch] text-ink-2 text-lg leading-relaxed">
              Members fund their own membership balance. Creators collect the agreed amount, once each period. The rules are enforced by the network, not by us.
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <h1 className="text-pink text-[clamp(2.6rem,5.6vw,5.4rem)] leading-[0.98] tracking-[-0.04em]">
              Support your favourite creators.
              <span className="block font-serif italic tracking-[-0.02em] text-[1.12em] leading-[0.95]">Stay in control.</span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="pill pill-lg">Launch demo <IconArrowRight className="arrow w-4 h-4" /></Link>
              <Link href="/docs" className="pill pill-lg pill-outline">Read the docs</Link>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

/**
 * The first scroll, after neutomni: a small framed window opens up to fill the
 * screen, then each tile inside is sliced away from a different side in turn.
 * Timeline (p): 0–.3 the frame opens · .3–.42 hold · .42–.86 tiles slice off ·
 * .84–.96 the empty frame wipes up, revealing the statement underneath.
 */
const SLICES: { dt: number; dr: number; db: number; dl: number }[] = [
  { dt: 0, dr: 0, db: 0, dl: 1 }, { dt: 1, dr: 0, db: 0, dl: 0 }, { dt: 0, dr: 1, db: 0, dl: 0 },
  { dt: 0, dr: 0, db: 1, dl: 0 }, { dt: 0, dr: 0, db: 0, dl: 1 }, { dt: 0, dr: 1, db: 0, dl: 0 },
];

function FactTile({ tone, big, line }: { tone: "pink" | "white" | "blush"; big: React.ReactNode; line: string }) {
  const cls = { pink: "bg-pink text-white", white: "bg-white text-pink", blush: "bg-blush text-pink" }[tone];
  return (
    <div className={`h-full flex flex-col justify-between p-5 sm:p-7 ${cls}`}>
      <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.16em] uppercase opacity-80">CadencePay</span>
      <div>
        <div className="text-[clamp(1.8rem,3.6vw,3.4rem)] leading-[0.95] tracking-[-0.04em]">{big}</div>
        <p className={`mt-2 text-sm sm:text-[15px] leading-snug ${tone === "pink" ? "text-white/85" : "text-ink-2"}`}>{line}</p>
      </div>
    </div>
  );
}

function CreatorTile({ i }: { i: number }) {
  const c = CREATORS[i];
  return (
    <Link href={`/app/c/${c.slug}`} className="group relative block h-full overflow-hidden">
      <Cover creator={c} className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]" />
      <div className="absolute left-3 right-3 bottom-3 sm:left-4 sm:right-4 sm:bottom-4 flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur px-3 py-2.5">
        <Avatar creator={c} size="sm" />
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight truncate">{c.name}</div>
          <div className="text-xs text-ink-3 truncate hidden sm:block">{c.craft}</div>
        </div>
        <IconArrowRight className="ml-auto w-4 h-4 shrink-0 text-pink transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function Showcase() {
  const ref = useScrollProgress<HTMLElement>("pin");
  const tiles = [
    <CreatorTile key="a" i={0} />,
    <FactTile key="b" tone="pink" big={<>100 CKB<span className="block font-serif italic tracking-[-0.02em]">a week.</span></>} line="Never more, never early." />,
    <CreatorTile key="c" i={1} />,
    <FactTile key="d" tone="white" big={<span className="font-serif italic tracking-[-0.02em]">Cancel any time.</span>} line="Everything you haven't paid comes straight back." />,
    <CreatorTile key="e" i={2} />,
    <FactTile key="f" tone="blush" big={<>Paid <span className="font-serif italic tracking-[-0.02em]">straight</span> to them.</>} line="No middleman holding the money." />,
  ];
  return (
    <section ref={ref} aria-label="Creators on CadencePay" className="pin-track relative h-[340vh]">
      <div className="show-stage pin-sticky sticky top-0 h-dvh overflow-hidden">
        {/* What the frame's final wipe reveals; it is the next "section" */}
        <div className="show-under absolute inset-0 flex flex-col pt-14">
          <Equation />
          <div className="flex-1 flex items-center"><Statement /></div>
        </div>
        <div className="show-frame absolute inset-0 bg-ink">
          <ul className="show-grid h-full max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2 gap-2.5 sm:gap-5 px-4 sm:px-8 pt-20 pb-8 sm:pt-24 sm:pb-12">
            {tiles.map((t, i) => (
              <li key={i} className="slice-tile min-h-0 overflow-hidden rounded-[2px]"
                style={{ "--i": i, "--dt": SLICES[i].dt, "--dr": SLICES[i].dr, "--db": SLICES[i].db, "--dl": SLICES[i].dl } as React.CSSProperties}>
                {t}
              </li>
            ))}
          </ul>
          <p className="show-caption absolute inset-x-0 top-6 sm:top-8 text-center font-mono text-[11px] tracking-[0.18em] uppercase text-white/70">
            Real creators&apos; pages · real test network
          </p>
        </div>
      </div>
    </section>
  );
}

function Equation() {
  return (
    <p aria-label="A set amount, plus once per period, plus your own wallet, equals staying in control"
      className="max-w-[90rem] mx-auto px-4 sm:px-8 py-8 grid grid-cols-2 sm:grid-cols-7 gap-y-2 items-center text-center font-mono text-[12px] sm:text-[13px] tracking-[0.18em] uppercase text-pink border-b border-dashed border-blush-2">
      <span>A set amount</span><span aria-hidden className="hidden sm:block">+</span>
      <span>Once per period</span><span aria-hidden className="hidden sm:block">+</span>
      <span>Your own wallet</span><span aria-hidden className="hidden sm:block">=</span>
      <span className="col-span-2 sm:col-span-1 font-semibold">Stay in control</span>
    </p>
  );
}

const STATEMENT = "A subscription shouldn't need the keys to your whole wallet.";

/** Sits under the showcase frame and is revealed by its final wipe; fills in word by word. */
function Statement() {
  const words = STATEMENT.split(" ");
  return (
    <div className="px-4 sm:px-8 w-full">
      <div className="max-w-[90rem] mx-auto grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-20 items-end">
        <h2 aria-label={STATEMENT} className="text-pink text-[clamp(2.4rem,6.4vw,6.2rem)] leading-[0.98] tracking-[-0.045em]">
          {words.map((w, i) => (
            <span key={i} aria-hidden className={`fill-word ${i >= 5 && i <= 8 ? "font-serif italic tracking-[-0.02em]" : ""}`}
              style={{ "--i": i / words.length } as React.CSSProperties}>{w} </span>
          ))}
        </h2>
        <div className="space-y-5 text-lg leading-relaxed text-ink-2 max-w-[42ch]">
          <p>Card subscriptions keep charging until you chase them. Wallet approvals can reach everything you hold.</p>
          <p>With CadencePay you put a small amount into a membership that is <em className="font-serif text-[1.2em] text-pink">yours</em>. The creator can take the agreed amount once each period, and nothing else.</p>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Join", accent: "today", body: "Pick a tier. The first payment goes straight to the creator, and a few more are saved in a balance only you can withdraw.", paid: 100, saved: 300, note: "First payment sent" },
  { n: "02", title: "Paid", accent: "each period", body: "Once each period the creator collects the agreed amount. Never more, never early, always straight to them.", paid: 200, saved: 200, note: "One payment collected" },
  { n: "03", title: "Top up", accent: "any time", body: "Running low? Add more whenever you like. The price and the schedule can't change.", paid: 200, saved: 400, note: "You added 200 CKB" },
  { n: "04", title: "Cancel", accent: "in one tap", body: "Changed your mind? Cancel and everything you haven't paid yet comes back to your wallet.", paid: 200, saved: 0, note: "400 CKB back to you" },
] as const;

/** Simple line drawings for each step, in the spirit of hand-drawn diagrams. */
function StepArt({ i }: { i: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 200 120" className="w-full h-24 sm:h-28 text-white/90" aria-hidden>
      <line x1="0" y1="60" x2="200" y2="60" {...common} strokeDasharray="4 6" opacity=".6" />
      {i === 0 && <><circle cx="70" cy="60" r="34" {...common} /><path d="M108 60h56m-10-10 10 10-10 10" {...common} /></>}
      {i === 1 && [30, 80, 130, 180].map((x, k) => <circle key={x} cx={x} cy="60" r={k === 1 ? 14 : 6} {...common} fill={k <= 1 ? "currentColor" : "none"} />)}
      {i === 2 && <><rect x="70" y="22" width="60" height="76" rx="10" {...common} /><path d="M100 46v28m-14-14h28" {...common} /></>}
      {i === 3 && <><path d="M150 60a50 34 0 1 1-12-22" {...common} /><path d="M140 22l-2 16 16 2" {...common} /></>}
    </svg>
  );
}

function Process() {
  const [step, setStep] = useState(0);
  const ref = useScrollProgress<HTMLElement>("pin", (p) => {
    const s = Math.max(0, Math.min(3, Math.floor(p * 4.5)));
    setStep((cur) => (cur === s ? cur : s));
  });
  const s = STEPS[step];
  return (
    <section id="how" ref={ref} aria-labelledby="how-h" className="pin-track relative h-[440vh] scroll-mt-0">
      <div className="pin-sticky sticky top-0 h-dvh overflow-hidden flex flex-col px-4 sm:px-8 pt-20 pb-6">
        <div className="max-w-[90rem] w-full mx-auto flex flex-wrap items-end justify-between gap-6">
          <h2 id="how-h" className="text-pink text-[clamp(2.2rem,4.6vw,4.4rem)] leading-[0.98] tracking-[-0.04em]">
            One membership,<span className="block font-serif italic tracking-[-0.02em]">start to finish.</span>
          </h2>
          <dl aria-live="polite" className="flex gap-6 sm:gap-10 text-pink tnum">
            <div>
              <dt className="font-mono text-[11px] tracking-[0.14em] uppercase">Paid to the creator</dt>
              <dd key={`p${step}`} className="tick text-3xl sm:text-5xl tracking-[-0.04em]">{s.paid} <span className="text-base">CKB</span></dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-[0.14em] uppercase">Still yours</dt>
              <dd key={`s${step}`} className="tick text-3xl sm:text-5xl tracking-[-0.04em]">{s.saved} <span className="text-base">CKB</span></dd>
            </div>
          </dl>
        </div>
        <p className="max-w-[90rem] w-full mx-auto mt-3 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-3">
          Example: 100 CKB a week · <span className="text-pink">{s.note}</span>
        </p>

        <ol className="steps max-w-[90rem] w-full mx-auto mt-6 flex-1 min-h-0 relative sm:grid sm:grid-cols-4 sm:gap-3">
          {STEPS.map((st, i) => (
            <li key={st.n} className="step-card bg-pink text-white rounded-none flex flex-col p-5 sm:p-6"
              style={{ "--i": i } as React.CSSProperties}>
              <span className="font-mono text-sm">{st.n}</span>
              <div className="my-auto py-4"><StepArt i={i} /></div>
              <h3 className="text-[1.9rem] leading-none tracking-[-0.03em]">
                {st.title} <span className="block font-serif italic tracking-normal">{st.accent}</span>
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/90 max-w-[34ch]">{st.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const TICKETS = [
  { creator: CREATORS[0], tierId: "supporter", rot: -6, x: -1 },
  { creator: CREATORS[1], tierId: "learner", rot: 2, x: 0 },
  { creator: CREATORS[2], tierId: "rider", rot: 7, x: 1 },
];

function Tickets() {
  const ref = useScrollProgress<HTMLElement>("pin");
  return (
    <section ref={ref} aria-labelledby="tickets-h" className="pin-track relative h-[300vh] bg-blush">
      <div className="pin-sticky sticky top-0 h-dvh overflow-hidden flex flex-col px-4 pt-24 pb-14">
        <h2 id="tickets-h" className="text-center text-pink text-[clamp(2.6rem,7.4vw,7.4rem)] leading-[0.95] tracking-[-0.05em]">
          Your money <span className="font-serif italic tracking-[-0.02em]">stays yours.</span>
        </h2>
        <p className="mt-3 text-center text-ink-2 text-lg max-w-[46ch] mx-auto">Every membership is its own ticket. Pick one and the rules on it never change.</p>
        <div className="relative flex-1 min-h-[24rem] w-full max-w-6xl mx-auto [perspective:1400px]">
          {TICKETS.map(({ creator, tierId, rot, x }, i) => {
            const tier = creator.tiers.find((t) => t.id === tierId)!;
            return (
              <div key={creator.slug} className="ticket-fly absolute left-1/2 top-1/2"
                style={{ "--i": i, "--rot": `${rot}deg`, "--x": x } as React.CSSProperties}>
                <Ticket creator={creator} tier={tier} code={CODE_HASH} className="shadow-[0_40px_80px_-30px_rgba(166,58,86,.55)]" />
              </div>
            );
          })}
        </div>
        <p className="hidden sm:block absolute bottom-6 inset-x-0 text-center font-mono text-[11px] tracking-[0.14em] uppercase text-pink px-4">
          Every ticket&apos;s barcode is the fingerprint of the on-chain rule that guards it
        </p>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section aria-labelledby="rules-h" className="px-4 sm:px-8 py-24 sm:py-36">
      <div className="max-w-[90rem] mx-auto">
        <h2 id="rules-h" className="text-pink text-[clamp(2.2rem,5vw,4.6rem)] leading-[0.98] tracking-[-0.04em] max-w-[18ch]">
          Clear rules, <span className="font-serif italic tracking-[-0.02em]">checked every time.</span>
        </h2>
        <div className="mt-12 grid md:grid-cols-2 gap-3">
          <div className="lift bg-pink text-white p-7 sm:p-10 min-h-[22rem] flex flex-col">
            <h3 className="text-3xl tracking-[-0.03em]">Creators <span className="font-serif italic">can</span></h3>
            <ul className="mt-auto pt-10 space-y-4 text-lg">
              {["Collect the agreed amount", "Once each period", "Paid straight to their own wallet"].map((t) => (
                <li key={t} className="flex gap-3 items-start border-t border-white/30 pt-4"><IconCheck className="w-5 h-5 mt-1 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="lift border-2 border-pink text-pink p-7 sm:p-10 min-h-[22rem] flex flex-col">
            <h3 className="text-3xl tracking-[-0.03em]">Creators <span className="font-serif italic">can&apos;t</span></h3>
            <ul className="mt-auto pt-10 space-y-4 text-lg">
              {["Take more, or take it early", "Change the price after you join", "Touch anything else in your wallet"].map((t) => (
                <li key={t} className="flex gap-3 items-start border-t border-pink/30 pt-4"><IconX className="w-5 h-5 mt-1 shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Developers() {
  const [copied, setCopied] = useState(false);
  const cmd = "npm install cadencepay @ckb-ccc/core";
  return (
    <section aria-labelledby="dev-h" className="px-4 sm:px-8 pb-24 sm:pb-36">
      <div className="max-w-[90rem] mx-auto grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-16 items-center">
        <div>
          <h2 id="dev-h" className="text-pink text-[clamp(2.2rem,4.6vw,4.4rem)] leading-[0.98] tracking-[-0.04em]">
            Build it into <span className="font-serif italic tracking-[-0.02em]">your own app.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-[44ch]">
            The same rules power this demo. The SDK builds every transaction, unsigned, for your users&apos; own wallets. No server keys, no database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/docs/quickstart" className="pill">Quickstart <IconArrowRight className="arrow w-4 h-4" /></Link>
            <Link href="/docs/sdk" className="pill pill-outline">SDK reference</Link>
          </div>
        </div>
        <div className="rounded-[1.6rem] bg-soft border border-line overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
            <code className="font-mono text-[13px] sm:text-sm text-ink truncate"><span className="text-pink">$</span> {cmd}</code>
            <button onClick={() => { void navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}
              className="pill pill-sm pill-white shrink-0 border-line!">{copied ? "Copied" : "Copy"}</button>
          </div>
          <pre className="px-5 py-5 font-mono text-[12.5px] sm:text-[13px] leading-[1.75] text-ink-2 overflow-x-auto"><code>{`import { buildSubscribeTx } from "cadencepay";

const tx = await buildSubscribeTx({
  subscriber: signer,          // the member's wallet
  recipientLock: creator.script,
  amount: 100n * 100_000_000n, // 100 CKB
  intervalBlocks: 40_320n,     // about a week
  prefundPeriods: 3n,
  tip,
});
await signer.sendTransaction(tx);`}</code></pre>
        </div>
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-blush-2" />
      <div className="relative max-w-[90rem] mx-auto px-4 sm:px-8 flex flex-wrap items-center gap-10 sm:gap-16">
        <Link href="/app" className="diamond group relative grid place-items-center w-44 h-44 sm:w-52 sm:h-52">
          <span aria-hidden className="absolute inset-[15%] bg-pink rotate-45 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:rotate-[135deg] group-hover:scale-110" />
          <span className="relative font-mono text-[13px] tracking-[0.18em] uppercase text-white">[ Launch demo ]</span>
        </Link>
        <div className="bg-white pr-4">
          <p className="text-pink text-2xl sm:text-3xl tracking-[-0.03em] max-w-[24ch]">
            Free test money, real network, <span className="font-serif italic">about a minute.</span>
          </p>
          <p className="mt-2 text-ink-2">Connect with JoyID, get test CKB from the faucet, and join a creator.</p>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-pink text-white px-4 sm:px-8 pt-10 overflow-hidden">
      <div className="max-w-[90rem] mx-auto grid sm:grid-cols-[1fr_auto_auto] gap-8 sm:gap-16 text-[15px]">
        <p className="font-serif italic text-xl">Support your favourite creators. Stay in control.</p>
        <ul className="space-y-1">
          <li><Link href="/app" className="hover:underline">Demo</Link></li>
          <li><Link href="/docs" className="hover:underline">Docs</Link></li>
          <li><Link href="/docs/quickstart" className="hover:underline">Quickstart</Link></li>
        </ul>
        <ul className="space-y-1">
          <li><a href={GITHUB} target="_blank" rel="noreferrer" className="hover:underline">GitHub</a></li>
          <li><a href="https://www.npmjs.com/package/cadencepay" target="_blank" rel="noreferrer" className="hover:underline">npm</a></li>
          <li><a href="https://faucet.nervos.org" target="_blank" rel="noreferrer" className="hover:underline">Free test CKB</a></li>
        </ul>
      </div>
      <p className="max-w-[90rem] mx-auto mt-8 font-mono text-[11px] tracking-[0.14em] uppercase text-white/75">CKB testnet · unaudited · MIT</p>
      <div aria-hidden className="text-[17.8vw] leading-[1.08] mt-2 pb-[2vw] text-center"><Wordmark /></div>
    </footer>
  );
}

export function Landing() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <StickyHeader show={past} />
      <main id="main" className="landing overflow-x-clip">
        <div className="px-4 sm:px-8 pt-4">
          <div ref={sentinel} className="max-w-[90rem] mx-auto">
            <Link href="/" aria-label="CadencePay home" className="block text-pink text-[18.5vw] 2xl:text-[16.6rem] leading-[0.84] -ml-[0.04em]">
              <Wordmark />
            </Link>
            <div className="mt-7 sm:mt-9"><TopBar /></div>
          </div>
        </div>
        <Hero />
        <Showcase />
        <Process />
        <Tickets />
        <Rules />
        <Developers />
        <Finale />
      </main>
      <SiteFooter />
    </>
  );
}
