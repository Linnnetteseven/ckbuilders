"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Footer, Receipt, Skeleton, btn } from "@/components/ui";
import { Avatar, Chip, Cover } from "@/components/Creator";
import { IconRefresh } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { CREATORS, tierForSubscription, type Creator } from "@/lib/creators";
import {
  findSubscriptions,
  viewSubscription,
  buildCancelTx,
  buildTopUpTx,
  type SubscriptionView,
} from "@/lib/cadencepay-sdk";
import { formatCkb, blocksToHuman, shortHash, EXPLORER_TX } from "@/lib/cadencepay";
import { friendlyTxError } from "@/lib/txErrors";

const STATUS: Record<SubscriptionView["status"], { label: string; tone: "green" | "pink" | "amber" }> = {
  active:      { label: "Active",          tone: "green" },
  due:         { label: "Payment due",     tone: "pink" },
  low_balance: { label: "Running low",     tone: "amber" },
  closable:    { label: "Out of payments", tone: "amber" },
};

type Row = SubscriptionView & { creator?: Creator };
const keyOf = (s: SubscriptionView) => `${s.cell.outPoint.txHash}:${s.cell.outPoint.index}`;

export default function Memberships() {
  const { signer, client, lock, connect } = useWallet();
  const [loaded, setLoaded] = useState<{ owner: string; rows: Row[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState("");
  const [receipts, setReceipts] = useState<{ label: string; txHash: string }[]>([]);
  const [refresh, setRefresh] = useState(0);

  const owner = lock?.hash();
  const rows = loaded && loaded.owner === owner ? loaded.rows : null;

  useEffect(() => {
    if (!lock) return;
    const ownerHash = lock.hash();
    let cancelled = false;
    (async () => {
      const [tip, subs, creatorLocks] = await Promise.all([
        client.getTipHeader(),
        findSubscriptions(client, { subscriberLockHash: ownerHash }),
        Promise.all(CREATORS.map(async (c) => ({ c, h: (await ccc.Address.fromString(c.payoutAddress, client)).script.hash() }))),
      ]);
      return subs.map((s): Row => ({
        ...viewSubscription(s, tip.number),
        creator: creatorLocks.find((x) => x.h === s.terms.recipientLockHash)?.c,
      }));
    })()
      .then((r) => { if (!cancelled) { setLoaded({ owner: ownerHash, rows: r }); setError(""); } })
      .catch((e) => { if (!cancelled) { setError(friendlyTxError(e)); setLoaded({ owner: ownerHash, rows: [] }); } });
    return () => { cancelled = true; };
  }, [client, lock, refresh]);

  const act = async (s: Row, kind: "cancel" | "topup") => {
    if (!signer) return;
    setBusy(keyOf(s));
    setConfirming("");
    setError("");
    try {
      const tx = kind === "cancel"
        ? await buildCancelTx({ subscription: s, subscriber: signer })
        : await buildTopUpTx({ subscription: s, subscriber: signer, addCapacity: s.terms.amount * 2n });
      const txHash = await signer.sendTransaction(tx);
      setReceipts((r) => [{
        label: kind === "cancel"
          ? `Membership cancelled. ${formatCkb(s.cell.cellOutput.capacity)} CKB is back in your wallet`
          : `Added ${formatCkb(s.terms.amount * 2n)} CKB to your ${s.creator?.name ?? ""} membership`,
        txHash,
      }, ...r]);
      for (const ms of [4000, 10000, 20000]) setTimeout(() => setRefresh((n) => n + 1), ms);
    } catch (e) {
      setError(friendlyTxError(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <Nav />
      <main id="main" className="pt-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end justify-between gap-4 mt-12 mb-8">
            <h1 className="display-thin text-5xl sm:text-6xl">Memberships</h1>
            {lock && (
              <button onClick={() => { setLoaded(null); setRefresh((n) => n + 1); }} className={btn.quiet}><IconRefresh className="w-4 h-4" />Refresh</button>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {error && <Alert>{error}</Alert>}
            {receipts.map((r) => <Receipt key={r.txHash} label={r.label} txHash={r.txHash} />)}
          </div>

          {!signer ? (
            <div className="rounded-3xl bg-blush px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold">See the creators you support</h2>
              <p className="text-ink-2 mt-2 mb-7 max-w-md mx-auto">Connect your wallet to see your memberships, what&apos;s left in each, and when the next payment is.</p>
              <button onClick={() => void connect()} className={btn.primaryLg}>Connect wallet</button>
            </div>
          ) : rows === null ? (
            <div className="space-y-5" aria-busy="true"><Skeleton className="h-60" /><Skeleton className="h-60" /></div>
          ) : rows.length === 0 ? (
            <div className="rounded-3xl bg-blush px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold">No memberships yet</h2>
              <p className="text-ink-2 mt-2 mb-7">Find a creator you love and join a tier. New memberships can take a few seconds to appear.</p>
              <Link href="/" className={btn.primaryLg}>Explore creators</Link>
            </div>
          ) : (
            <ul className="space-y-6">
              {rows.map((s) => {
                const st = STATUS[s.status];
                const k = keyOf(s);
                const tier = s.creator && tierForSubscription(s.creator, s.terms.amount, s.terms.intervalBlocks);
                return (
                  <li key={k} className="rounded-3xl border border-line overflow-hidden rise">
                    {s.creator ? <Cover creator={s.creator} className="h-20" /> : <div className="h-20 bg-soft" />}
                    <div className="px-5 sm:px-6 pb-6 -mt-8">
                      <div className="flex items-end justify-between gap-3">
                        {s.creator ? <Avatar creator={s.creator} size="lg" ring /> : <span />}
                        <Chip tone={st.tone}>{st.label}</Chip>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold">
                        {s.creator ? <Link href={`/c/${s.creator.slug}`} className="hover:text-pink">{s.creator.name}</Link> : "Unknown creator"}
                      </h2>
                      <p className="text-ink-2 tnum">{tier ? `${tier.name} · ` : ""}{formatCkb(s.terms.amount)} CKB every {blocksToHuman(s.terms.intervalBlocks).replace("~", "")}</p>

                      <dl className="mt-5 grid grid-cols-3 gap-2.5 tnum">
                        {[
                          ["Balance", `${formatCkb(s.balance > 0n ? s.balance : 0n)} CKB`],
                          ["Payments left", s.periodsRemaining.toString()],
                          ["Next payment", s.blocksUntilNextClaim === 0n ? "Due now" : `in ${blocksToHuman(s.blocksUntilNextClaim)}`],
                        ].map(([l, v]) => (
                          <div key={l} className="rounded-2xl bg-soft px-3 py-3">
                            <dt className="text-xs text-ink-3">{l}</dt>
                            <dd className="text-lg sm:text-xl font-semibold mt-0.5">{v}</dd>
                          </div>
                        ))}
                      </dl>

                      {(s.status === "low_balance" || s.status === "closable") && (
                        <div className="mt-4">
                          <Alert tone="warn">
                            {s.status === "closable"
                              ? "There isn't enough left for another payment. Top up to keep your membership, or cancel to get the rest back."
                              : "Fewer than 2 payments left. Top up to keep your membership going."}
                          </Alert>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-2.5">
                        <button onClick={() => void act(s, "topup")} disabled={!!busy} className={btn.primary}>
                          {busy === k ? "Confirm in your wallet…" : `Top up ${formatCkb(s.terms.amount * 2n)} CKB`}
                        </button>
                        {confirming === k ? (
                          <>
                            <button onClick={() => void act(s, "cancel")} disabled={!!busy} className={btn.danger}>
                              Yes, cancel and refund {formatCkb(s.cell.cellOutput.capacity)} CKB
                            </button>
                            <button onClick={() => setConfirming("")} className={btn.quiet}>Keep membership</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirming(k)} disabled={!!busy} className={btn.secondary}>Cancel membership</button>
                        )}
                      </div>
                      <a href={EXPLORER_TX(s.cell.outPoint.txHash)} target="_blank" rel="noreferrer"
                        className="inline-block mt-4 text-xs font-mono tnum text-ink-3 hover:text-pink">
                        Latest receipt {shortHash(s.cell.outPoint.txHash)}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
