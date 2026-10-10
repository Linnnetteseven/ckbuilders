import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { TESTNET } from "@/lib/cadencepay-sdk";
import { EXPLORER_TX, shortHash } from "@/lib/cadencepay";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "You join",
    body: "Your wallet signs once. Your first payment goes to the creator straight away, and the next few are set aside in a membership balance that belongs to you, not to the creator and not to us.",
  },
  {
    title: "One payment each period",
    body: "When a period ends, the next payment can be collected. Anyone can press collect, but the money can only go to the creator, only the agreed amount, and only once per period.",
  },
  {
    title: "You stay in charge",
    body: "Top up when you're running low, or cancel and get everything left back. If a membership runs out of payments it simply ends, and any leftover still comes back to you.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <Nav />
      <main id="main" className="pt-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto pt-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-pink"><IconArrowLeft className="w-4 h-4" />Explore</Link>
          <h1 className="display-thin text-6xl sm:text-7xl mt-6 mb-5">How it works</h1>
          <p className="text-lg text-ink-2 mb-12 max-w-[50ch]">
            Like a chama or a savings club: everyone can see the rules, payments arrive on schedule, and your money is never in someone else&apos;s hands until it&apos;s paid.
          </p>
          <ol className="space-y-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-line pt-6">
                <span className="display-thin text-5xl text-pink tnum">{i + 1}</span>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{s.title}</h2>
                  <p className="text-ink-2 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-16 rounded-3xl bg-blush px-6 py-7">
            <h2 className="text-xl font-semibold mb-3">Good to know</h2>
            <ul className="text-ink-2 space-y-2 list-disc pl-5 marker:text-pink">
              <li>This is a demo on a test network with free test CKB. It hasn&apos;t been audited, so never use real money with it.</li>
              <li>Payments here are about an hour apart so you can see them happen. A real creator would pick a week or a month.</li>
              <li>Memberships are public: anyone can see which wallet supports which creator, and for how much.</li>
              <li>If you cancel right after a payment falls due but before it&apos;s collected, the creator misses that one payment. That&apos;s why the first payment is made the moment you join.</li>
            </ul>
          </div>

          <details className="mt-8 rounded-3xl border border-line px-6 py-5 group">
            <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
              For the curious: what&apos;s underneath
              <span className="text-pink text-sm font-medium group-open:hidden">Show</span>
              <span className="text-pink text-sm font-medium hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-4 text-sm text-ink-2 space-y-3 leading-relaxed">
              <p>Each membership is a <em>cell</em> on the CKB blockchain. A small program called a <em>type script</em> checks every change to it: a collection must shrink the cell by exactly one payment, send that payment to the creator&apos;s address, and move the next due date forward by one period. Cancelling needs the member&apos;s own wallet signature, and the refund must go back to them.</p>
              <p>Because the script enforces the rules, the cell is locked with an <em>Input Type Proxy Lock</em>: nobody&apos;s private key is needed to collect, and a small helper service only pays the network fee.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pt-2">
                <dt className="text-ink-3">Script</dt>
                <dd className="font-mono tnum text-xs break-all">{shortHash(TESTNET.cadencepay.codeHash, 14, 8)}</dd>
                <dt className="text-ink-3">Deployed in</dt>
                <dd>
                  <a className="font-mono tnum text-xs underline" href={EXPLORER_TX(String(TESTNET.cadencepay.cellDep.outPoint.txHash))} target="_blank" rel="noreferrer">
                    {shortHash(String(TESTNET.cadencepay.cellDep.outPoint.txHash), 14, 8)}
                  </a>
                </dd>
              </dl>
            </div>
          </details>
        </div>
      </main>
      <Footer />
    </>
  );
}
