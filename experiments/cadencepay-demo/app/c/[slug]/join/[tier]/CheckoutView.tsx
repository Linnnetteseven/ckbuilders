"use client";
import { useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Avatar, Receipt, btn } from "@/components/ui";
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

  const kept = subscriptionOccupiedCapacity() + tier.amount * tier.prefundPeriods;
  const total = tier.amount + kept;
  const period = tier.intervalLabel.replace(" (demo)", "");

  const subscribe = async () => {
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
      <main id="main" className="pt-14 px-4 sm:px-6 pb-20">
        <div className="max-w-md mx-auto">
          <Link href={`/c/${creator.slug}`} className="inline-block mt-8 text-xs text-muted hover:text-ink">← {creator.name}</Link>

          {step === "done" ? (
            <div className="mt-12">
              <h1 className="display text-4xl font-bold mb-3">You&apos;re a {tier.name} member</h1>
              <p className="text-muted leading-relaxed mb-6">
                {formatCkb(tier.amount)} CKB went to {creator.name} just now. Your Subscription Cell holds {formatCkb(kept)} CKB in your control. It can take a few seconds to appear.
              </p>
              <Receipt label="Subscribed" txHash={txHash} />
              <div className="flex flex-wrap gap-3 mt-8">
                <Link href={`/c/${creator.slug}`} className={btn.primary}>Read member posts</Link>
                <Link href="/dashboard" className={btn.secondary}>My memberships</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mt-8 mb-8">
                <Avatar initials={creator.initials} hue={creator.hue} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{creator.name}</div>
                  <div className="text-xs text-muted truncate">{creator.craft}</div>
                </div>
              </div>

              <h1 className="display text-4xl font-bold mb-1">Join {tier.name}</h1>
              <p className="text-muted mb-7 tnum">{formatCkb(tier.amount)} CKB {tier.intervalLabel}</p>

              <dl className="bg-white border border-border rounded-lg divide-y divide-border mb-5 text-sm tnum">
                {[
                  ["Paid to the creator now", `${formatCkb(tier.amount)} CKB`],
                  [`Kept in your cell (${tier.prefundPeriods} more payments + storage)`, `${formatCkb(kept)} CKB`],
                  ["Total from your wallet", `${formatCkb(total)} CKB + fee`],
                ].map(([k, v], i) => (
                  <div key={k} className={`flex justify-between gap-4 px-4 py-3 ${i === 2 ? "font-semibold" : ""}`}>
                    <dt className={i === 2 ? "" : "text-muted"}>{k}</dt>
                    <dd className="text-right shrink-0">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mb-7">
                <Alert tone="ok">
                  You keep your funds. {creator.name} can take at most {formatCkb(tier.amount)} CKB {period}, enforced on-chain. Cancel any time and the rest comes back to you.
                </Alert>
              </div>

              {step === "error" && <div className="mb-4"><Alert>{error}</Alert></div>}

              {!signer ? (
                <>
                  <button onClick={() => void connect()} className={`${btn.primary} w-full py-3.5`}>Connect wallet to join</button>
                  <p className="text-xs text-muted text-center mt-3">JoyID uses a passkey on your device, so there&apos;s no seed phrase.</p>
                </>
              ) : (
                <>
                  {address && <p className="text-xs font-mono tnum text-muted truncate mb-3">Paying from {address.slice(0, 14)}…{address.slice(-6)}</p>}
                  <button onClick={() => void subscribe()} disabled={busy} className={`${btn.primary} w-full py-3.5`}>
                    {step === "building" ? "Preparing transaction…" : step === "signing" ? "Confirm in your wallet…" : `Join · ${formatCkb(tier.amount)} CKB now`}
                  </button>
                  <p className="text-xs text-muted text-center mt-3">
                    Testnet CKB is free at <a className="underline" href="https://faucet.nervos.org" target="_blank" rel="noreferrer">faucet.nervos.org</a>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
