import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer, btn } from "@/components/ui";
import { Avatar, Cover } from "@/components/Creator";
import { IconArrowRight, IconCheck, IconLock, IconX } from "@/components/icons";
import { CREATORS } from "@/lib/creators";
import { formatCkb } from "@/lib/cadencepay";

const fromPrice = (c: (typeof CREATORS)[number]) => c.tiers.reduce((m, t) => (t.amount < m ? t.amount : m), c.tiers[0].amount);

export default function Explore() {
  return (
    <>
      <Nav />
      <main id="main" className="pt-16 overflow-x-clip">
        {/* Hero: giant thin headline over a collage of creator covers */}
        <section className="relative bg-blush">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24">
            <h1 className="display-thin text-[clamp(3rem,9vw,7.5rem)] max-w-[14ch] relative z-10 rise">
              Support your favourite creators.{" "}
              <span className="block text-pink">Stay in control.</span>
            </h1>
            <div className="mt-8 grid lg:grid-cols-[minmax(0,26rem)_1fr] gap-10 lg:gap-14 items-end">
              <div className="relative z-10 rise min-w-0" style={{ animationDelay: "80ms" }}>
                <p className="text-lg sm:text-xl text-ink-2 leading-relaxed">
                  Become a member of creators you love. They collect the agreed amount once each period, and the rest of your money stays yours until they do. Cancel any time.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <a href="#creators" className={btn.primaryLg}>Find a creator <IconArrowRight className="arrow w-4 h-4" /></a>
                  <Link href="/how-it-works" className={btn.quiet}>How it works</Link>
                </div>
                <p className="mt-5 text-xs text-ink-3">A test-network demo with free test CKB. No real money.</p>
              </div>

              <ul aria-label="Featured creators" className="min-w-0 flex gap-4 sm:gap-5 lg:-mt-40 overflow-x-auto lg:overflow-visible snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-4 pt-2">
                {CREATORS.map((c, i) => (
                  <li key={c.slug} className="snap-center shrink-0">
                    <Link href={`/c/${c.slug}`}
                      className="cover-card block w-[230px] sm:w-[250px] rounded-3xl bg-white shadow-[0_18px_40px_-22px_rgba(24,21,18,.45)] overflow-hidden"
                      style={{ "--r": `${[-4, 2.5, -1.5][i]}deg`, "--y": `${[0, 28, 8][i]}px` } as React.CSSProperties}>
                      <Cover creator={c} className="h-32" />
                      <div className="px-4 pb-4 -mt-7">
                        <Avatar creator={c} size="md" ring />
                        <div className="mt-2 font-semibold leading-tight">{c.name}</div>
                        <div className="text-xs text-ink-3">{c.craft}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Creator grid */}
        <section id="creators" aria-labelledby="creators-h" className="scroll-mt-20 px-4 sm:px-6 mt-16 sm:mt-24">
          <div className="max-w-6xl mx-auto">
            <h2 id="creators-h" className="text-3xl sm:text-4xl font-semibold">Creators on CadencePay</h2>
            <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CREATORS.map((c) => {
                const members = c.posts.filter((p) => p.tierId).length;
                return (
                  <li key={c.slug} className="lift rounded-3xl border border-line bg-white overflow-hidden flex flex-col">
                    <Cover creator={c} className="h-36" />
                    <div className="px-5 pb-5 -mt-8 flex-1 flex flex-col">
                      <Avatar creator={c} size="lg" ring />
                      <h3 className="mt-3 text-xl font-semibold">{c.name}</h3>
                      <p className="text-sm text-ink-2">{c.craft}</p>
                      <p className="mt-3 text-sm text-ink-3 flex items-center gap-1.5"><IconLock className="w-3.5 h-3.5" />{members} member-only post{members === 1 ? "" : "s"}</p>
                      <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                        <span className="text-sm tnum"><strong className="font-semibold">{formatCkb(fromPrice(c))} CKB</strong> <span className="text-ink-3">/ period</span></span>
                        <Link href={`/c/${c.slug}`} className={btn.primarySm}>Become a member</Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* How it works, as a sequence */}
        <section aria-labelledby="how" className="px-4 sm:px-6 mt-24 sm:mt-32">
          <div className="max-w-6xl mx-auto">
            <h2 id="how" className="display-thin text-[clamp(2.4rem,6vw,4.5rem)] max-w-[16ch]">Join in a minute. Leave whenever you like.</h2>
            <ol className="mt-12 grid md:grid-cols-3 gap-10 md:gap-8">
              {[
                ["Pick a tier", "Choose a creator and a tier. You see exactly what you'll pay and how often before you sign anything."],
                ["Pay as you go", "The first payment goes to them straight away. Each period after that, one payment is collected. Never more, never early."],
                ["Cancel any time", "Changed your mind? Cancel and everything you haven't paid yet comes straight back to your wallet."],
              ].map(([title, body], i) => (
                <li key={title} className="border-t border-ink pt-5">
                  <span className="display-thin text-6xl text-pink tnum">{i + 1}</span>
                  <h3 className="mt-3 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-ink-2 leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section aria-labelledby="trust" className="px-4 sm:px-6 mt-24 sm:mt-32">
          <div className="max-w-6xl mx-auto rounded-[2rem] bg-ink text-white px-6 sm:px-12 py-12 sm:py-16 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16">
            <div>
              <h2 id="trust" className="display-thin text-[clamp(2.4rem,5.5vw,4rem)]">Your money stays yours.</h2>
              <p className="mt-5 text-white/75 leading-relaxed max-w-[44ch]">
                Card subscriptions can keep charging, and wallet approvals can reach your whole balance. Here the limits are checked by the network on every single payment, so nobody has to take anyone&apos;s word for it.
              </p>
            </div>
            <ul className="grid gap-3 self-center">
              {[
                [true, "Creators collect the agreed amount, once per period, paid straight to them."],
                [false, "They can't take more, take it early, change the price, or touch anything else in your wallet."],
                [true, "You can top up, or cancel and get the rest back, whenever you like."],
              ].map(([ok, text], i) => (
                <li key={i} className="flex gap-4 items-start rounded-2xl bg-white/[0.06] px-5 py-4">
                  <span className={`mt-0.5 grid place-items-center w-7 h-7 shrink-0 rounded-full ${ok ? "bg-pink" : "bg-white/15"}`}>
                    {ok ? <IconCheck className="w-4 h-4" /> : <IconX className="w-4 h-4" />}
                  </span>
                  <p className="text-[15px] text-white/90">{text as string}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
