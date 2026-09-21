import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-40 pb-32 px-6 border-b border-[#DDD9D3]">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10">
              <span className="text-xs text-[#7C7570] border border-[#DDD9D3] bg-[#EFECE7] px-3 py-1 rounded-full">
                Live on CKB Testnet
              </span>
            </div>

            <h1 className="display text-[clamp(3rem,9vw,7rem)] font-black leading-[0.95] tracking-tight mb-8 max-w-3xl">
              Subscribe to creators.<br />
              <em className="not-italic text-[#C44F6B]">On your terms.</em>
            </h1>

            <p className="text-[#7C7570] text-lg max-w-lg mb-10 leading-relaxed">
              Every subscription is a CKB cell you own. No custodian,
              no vault — cancel with one transaction. Payments enforce
              themselves.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/subscribe"
                className="bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-7 py-3 rounded font-semibold text-sm">
                Subscribe to a Creator
              </Link>
              <Link href="/creator"
                className="border border-[#1C1814] hover:bg-[#1C1814] hover:text-white transition px-7 py-3 rounded font-semibold text-sm">
                Set up a tier
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 px-6 border-b border-[#DDD9D3]">
          <div className="max-w-5xl mx-auto">
            <h2 className="display text-4xl font-bold mb-16">How it works</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DDD9D3]">
              {[
                {
                  n: "1",
                  title: "Creator sets a tier",
                  body: "Amount, interval in blocks, shareable link. One transaction deploys the subscription terms on CKB.",
                },
                {
                  n: "2",
                  title: "Subscriber clicks and pays",
                  body: "Email login via CKB KeyWay. One transaction creates a Subscription Cell — owned entirely by the subscriber.",
                },
                {
                  n: "3",
                  title: "Claims run automatically",
                  body: "Anyone can trigger a claim when the interval elapses. The type script enforces the rules. Fiber settles instantly.",
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="py-8 sm:py-0 sm:px-10 first:pl-0 last:pr-0">
                  <div className="display text-[#C44F6B] text-5xl font-black mb-5 leading-none">{n}</div>
                  <div className="font-semibold mb-3">{title}</div>
                  <div className="text-sm text-[#7C7570] leading-relaxed">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Properties */}
        <section className="py-24 px-6 border-b border-[#DDD9D3]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-12 items-start">
            <div>
              <h2 className="display text-4xl font-bold mb-6">
                The subscription IS the cell.
              </h2>
              <p className="text-[#7C7570] leading-relaxed">
                Every other subscription protocol stores authorization
                off-chain or locks your funds in a vault. CadencePay
                puts the agreement on-chain as a first-class CKB asset —
                verifiable by anyone, cancelable by you.
              </p>
            </div>
            <div className="divide-y divide-[#DDD9D3]">
              {[
                { k: "On-chain state",    v: "Every subscription is a CKB cell. No database required." },
                { k: "Self-custody",      v: "Funds stay in your cells. Nothing locked in a vault." },
                { k: "Cancel any time",   v: "Owner mode in the type script. One transaction, no penalty." },
                { k: "Fiber settlement",  v: "Claims route via Fiber Network. Instant, sub-cent fees." },
              ].map(({ k, v }) => (
                <div key={k} className="py-5">
                  <div className="font-medium text-sm mb-1">{k}</div>
                  <div className="text-sm text-[#7C7570]">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-between items-center gap-4 text-xs text-[#7C7570]">
            <span>CadencePay · CKBuilders 2026</span>
            <div className="flex gap-6">
              <a href="https://github.com/Linnnetteseven/ckbuilders"
                target="_blank" rel="noreferrer" className="hover:text-[#1C1814] transition">
                GitHub
              </a>
              <a href="https://docs.nervos.org"
                target="_blank" rel="noreferrer" className="hover:text-[#1C1814] transition">
                CKB Docs
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
