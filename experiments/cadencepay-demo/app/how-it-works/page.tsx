import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/ui";
import { TESTNET } from "@/lib/cadencepay-sdk";
import { EXPLORER_TX, shortHash } from "@/lib/cadencepay";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "You subscribe",
    body: "Your wallet signs one transaction. It pays the first period to the creator and creates a Subscription Cell holding a few more periods. The cell records the creator, the amount, the period length and when the next payment is allowed.",
  },
  {
    title: "Payments are claimed, not pulled",
    body: "When a period is due, anyone can submit a claim. The CKB type script checks that the cell shrinks by exactly one payment, that the payment goes to the creator's address, and that the next due date moves forward by one period.",
  },
  {
    title: "You stay in control",
    body: "Top up when the balance runs low, or cancel: your wallet signs, and the full remaining balance comes back to you. If a cell runs out, anyone can close it and the leftover still goes to you.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <Nav />
      <main id="main" className="pt-14 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto pt-14">
          <Link href="/" className="text-xs text-muted hover:text-ink">← Explore</Link>
          <h1 className="display text-4xl sm:text-5xl font-bold mt-6 mb-10">How it works</h1>
          <ol className="space-y-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span className="display text-3xl text-rose leading-none tnum">{i + 1}</span>
                <div>
                  <h2 className="font-semibold mb-2">{s.title}</h2>
                  <p className="text-muted leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="font-semibold mt-16 mb-3">Known limits</h2>
          <ul className="text-sm text-muted space-y-2 list-disc pl-5">
            <li>Testnet only, and the script is unaudited.</li>
            <li>Subscriptions are public: anyone can see which address supports which creator, for how much.</li>
            <li>If you cancel right after a payment falls due but before it is claimed, the creator misses that one period. Paying the first period upfront limits this.</li>
          </ul>

          <h2 className="font-semibold mt-12 mb-3">On-chain references</h2>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted">Type script</dt>
            <dd className="font-mono tnum break-all">{shortHash(TESTNET.cadencepay.codeHash, 14, 8)}</dd>
            <dt className="text-muted">Deployed in</dt>
            <dd>
              <a className="font-mono tnum underline" href={EXPLORER_TX(String(TESTNET.cadencepay.cellDep.outPoint.txHash))} target="_blank" rel="noreferrer">
                {shortHash(String(TESTNET.cadencepay.cellDep.outPoint.txHash), 14, 8)}
              </a>
            </dd>
          </dl>
        </div>
      </main>
      <Footer />
    </>
  );
}
