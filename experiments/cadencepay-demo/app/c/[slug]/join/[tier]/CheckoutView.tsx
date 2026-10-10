"use client";
import { useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Receipt, btn } from "@/components/ui";
import { Avatar, Chip, Cover } from "@/components/Creator";
import { IconArrowLeft, IconCheck } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { getCreator, type Creator, type Tier } from "@/lib/creators";
import { buildSubscribeTx, subscriptionOccupiedCapacity } from "@/lib/cadencepay-sdk";
import { formatCkb } from "@/lib/cadencepay";
import { friendlyTxError } from "@/lib/txErrors";

type Step = "idle" | "building" | "signing" | "done" | "error";

export function CheckoutView({ slug, tierId }: { slug: string; tierId: string }) {
  const creator = getCreator(slug) as Creator;
  const tier = creator.tiers.find((t) => t.id === tierId) as Tier;
  const { signer, client, address, connect } = useWallet();
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const deposit = subscriptionOccupiedCapacity();
  const prepaid = tier.amount * tier.prefundPeriods;
  const total = tier.amount + prepaid + deposit;

  const join = async () => {
    if (!signer) return;
    setError("");
    try {
      setStep("building");
      const [tip, recipient] = await Promise.all([
        client.getTipHeader(),
        ccc.Address.fromString(creator.payoutAddress, client),
      ]);
      const tx = await buildSubscribeTx({
        subscriber: signer,
        recipientLock: recipient.script,
        amount: tier.amount,
        intervalBlocks: tier.intervalBlocks,
        prefundPeriods: tier.prefundPeriods,
        tip: { hash: tip.hash, number: tip.number },
      });
      setStep("signing");
      setTxHash(await signer.sendTransaction(tx));
      setStep("done");
    } catch (e) {
      setError(friendlyTxError(e));
      setStep("error");
    }
  };

  const busy = step === "building" || step === "signing";

  return (
    <>
      <Nav />
      <main id="main" className="pt-16 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Link href={`/c/${creator.slug}`} className="inline-flex items-center gap-1.5 mt-8 text-sm text-ink-2 hover:text-pink"><IconArrowLeft className="w-4 h-4" />{creator.name}</Link>

          {step === "done" ? (
            <div className="max-w-lg mx-auto text-center pt-12 rise">
              <div className="flex justify-center"><Avatar creator={creator} size="xl" ring /></div>
              <h1 className="mt-6 display-thin text-5xl sm:text-6xl">You&apos;re in.</h1>
              <p className="mt-4 text-ink-2 leading-relaxed">
                Welcome to {creator.name}&apos;s {tier.name} membership. Your first {formatCkb(tier.amount)} CKB went to them just now, and the next {tier.prefundPeriods.toString()} payments wait in your membership balance. It can take a few seconds to show up.
              </p>
              <div className="mt-6 text-left"><Receipt label="Membership started" txHash={txHash} /></div>
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                <Link href={`/c/${creator.slug}`} className={btn.primary}>See member posts</Link>
                <Link href="/dashboard" className={btn.secondary}>My memberships</Link>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 md:gap-12 items-start mt-6">
              {/* What you're joining */}
              <aside className="rounded-3xl border border-line overflow-hidden md:sticky md:top-24">
                <Cover creator={creator} className="h-28" />
                <div className="px-6 pb-6 -mt-9">
                  <Avatar creator={creator} size="lg" ring />
                  <p className="mt-3 text-sm text-ink-2">{creator.name}</p>
                  <h2 className="text-2xl font-semibold">{tier.name}</h2>
                  <p className="mt-2 tnum"><span className="text-3xl font-semibold tracking-tight">{formatCkb(tier.amount)}</span> <span className="text-ink-2">CKB {tier.intervalLabel}</span></p>
                  <ul className="mt-4 space-y-1.5 text-[15px]">
                    {tier.perks.map((perk) => <li key={perk} className="flex gap-2.5"><IconCheck className="w-4 h-4 mt-1 text-pink shrink-0" />{perk}</li>)}
                  </ul>
                </div>
              </aside>

              {/* Summary and action */}
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-semibold">Join {tier.name}</h1>
                <p className="mt-2 text-ink-2">Here&apos;s exactly what happens when you join.</p>

                <dl className="mt-6 rounded-3xl bg-soft px-5 sm:px-6 py-2 text-[15px] tnum">
                  {[
                    [`Paid to ${creator.name} today`, `${formatCkb(tier.amount)} CKB`],
                    [`Saved for the next ${tier.prefundPeriods} payments`, `${formatCkb(prepaid)} CKB`],
                    ["Refundable deposit", `${formatCkb(deposit)} CKB`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-3.5 border-b border-line">
                      <dt className="text-ink-2">{k}</dt>
                      <dd className="font-medium shrink-0">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 py-4 text-lg">
                    <dt className="font-semibold">Total from your wallet</dt>
                    <dd className="font-semibold shrink-0">{formatCkb(total)} CKB</dd>
                  </div>
                </dl>
                <p className="mt-2 px-1 text-xs text-ink-3">Plus a tiny network fee, well under 1 CKB. The saved payments and the deposit stay yours until used, and come back if you cancel.</p>

                <ul className="mt-6 space-y-2.5 text-[15px]">
                  {[
                    `${creator.name} can collect at most ${formatCkb(tier.amount)} CKB ${tier.intervalLabel}. Never more, never early.`,
                    "Everything not yet paid stays yours, not with the creator and not with us.",
                    "Cancel any time and the rest comes straight back to your wallet.",
                  ].map((line) => (
                    <li key={line} className="flex gap-3 items-start"><span className="mt-0.5 grid place-items-center w-5 h-5 rounded-full bg-blush text-pink shrink-0"><IconCheck className="w-3 h-3" /></span>{line}</li>
                  ))}
                </ul>

                {step === "error" && <div className="mt-6"><Alert>{error}</Alert></div>}

                <div className="mt-8">
                  {!signer ? (
                    <>
                      <button onClick={() => void connect()} className={`${btn.primaryLg} w-full`}>Connect a wallet to join</button>
                      <p className="text-sm text-ink-3 text-center mt-3">JoyID lets you sign in with your fingerprint or face. No seed phrase to write down.</p>
                    </>
                  ) : (
                    <>
                      <button onClick={() => void join()} disabled={busy} className={`${btn.primaryLg} w-full`}>
                        {step === "building" ? "Getting things ready…" : step === "signing" ? "Confirm in your wallet…" : `Join for ${formatCkb(tier.amount)} CKB`}
                      </button>
                      <p className="text-sm text-ink-3 text-center mt-3">
                        {address ? <>Paying from <span className="font-mono tnum">{address.slice(0, 8)}…{address.slice(-6)}</span>. </> : null}
                        Need test CKB? <a className="underline hover:text-pink" href="https://faucet.nervos.org" target="_blank" rel="noreferrer">Get it free</a>.
                      </p>
                    </>
                  )}
                </div>
                <div className="mt-6 flex justify-center"><Chip tone="gray">Test network · no real money</Chip></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
