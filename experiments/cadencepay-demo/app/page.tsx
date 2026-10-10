import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Avatar, Footer } from "@/components/ui";
import { CREATORS } from "@/lib/creators";
import { formatCkb } from "@/lib/cadencepay";

export default function Explore() {
  return (
    <>
      <Nav />
      <main id="main" className="pt-14">
        <section className="px-4 sm:px-6 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs text-muted mb-6 tnum">CKB testnet · demo creators · no real money</p>
            <h1 className="display text-[clamp(2.6rem,8vw,5.75rem)] font-bold leading-[0.98] max-w-3xl mb-7">
              Back the people who make things.<br />
              <span className="text-rose">Keep your money where you can see it.</span>
            </h1>
            <p className="text-muted text-base sm:text-lg max-w-xl leading-relaxed">
              Each membership is a small on-chain cell that you fund and control. The creator can take the agreed amount once per period, and nothing more. Leave whenever you like; the rest comes back to you.
            </p>
          </div>
        </section>

        <section aria-labelledby="creators" className="px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-2">
              <h2 id="creators" className="text-sm font-semibold">Creators</h2>
              <span className="text-xs text-muted tnum">{CREATORS.length} on testnet</span>
            </div>
            <ul className="divide-y divide-border">
              {CREATORS.map((c) => {
                const from = c.tiers.reduce((m, t) => (t.amount < m ? t.amount : m), c.tiers[0].amount);
                const locked = c.posts.filter((p) => p.tierId).length;
                return (
                  <li key={c.slug}>
                    <Link href={`/c/${c.slug}`} className="group grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-x-4 gap-y-2 items-center py-6">
                      <Avatar initials={c.initials} hue={c.hue} />
                      <div className="min-w-0">
                        <div className="display text-xl sm:text-2xl font-semibold group-hover:text-rose transition-colors">{c.name}</div>
                        <div className="text-sm text-muted">{c.craft}</div>
                      </div>
                      <div className="col-start-2 sm:col-start-3 text-sm sm:text-right tnum">
                        <span className="font-medium">from {formatCkb(from)} CKB</span>
                        <span className="text-muted"> · {locked} member post{locked === 1 ? "" : "s"}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="trust" className="px-4 sm:px-6 mt-20 sm:mt-28">
          <div className="max-w-5xl mx-auto grid sm:grid-cols-[1fr_1.3fr] gap-10 sm:gap-16">
            <div>
              <h2 id="trust" className="display text-3xl sm:text-4xl font-bold mb-4">What a creator can and can&apos;t do</h2>
              <p className="text-muted leading-relaxed">
                Card subscriptions and token allowances let a merchant pull from your whole balance. Here, the rules live in a CKB type script that checks every payment.
              </p>
              <Link href="/how-it-works" className="inline-block mt-5 text-sm underline underline-offset-4 hover:text-rose">How it works →</Link>
            </div>
            <dl className="grid gap-px bg-border border border-border rounded-lg overflow-hidden">
              {[
                ["Can", "Take exactly the agreed amount, once per period, paid to their own address."],
                ["Can't", "Take more, take it early, change the price, or touch any other coins in your wallet."],
                ["You can", "Top up, cancel at any time and get the remaining balance back, or let it run out."],
                ["Anyone can", "Trigger a payment that's due, so creators don't need a server holding their keys."],
              ].map(([k, v]) => (
                <div key={k} className="bg-white grid grid-cols-[5.5rem_1fr] gap-4 px-5 py-4">
                  <dt className={`text-sm font-semibold ${k === "Can't" ? "text-rose" : ""}`}>{k}</dt>
                  <dd className="text-sm text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
