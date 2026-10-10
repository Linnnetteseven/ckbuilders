"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Avatar, Footer, Receipt, Skeleton, btn } from "@/components/ui";
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

const STATUS: Record<SubscriptionView["status"], { label: string; cls: string }> = {
  active:      { label: "Active",       cls: "bg-mint text-forest" },
  due:         { label: "Payment due",  cls: "bg-surface text-ink" },
  low_balance: { label: "Low balance",  cls: "bg-amber-50 text-amber-900" },
  closable:    { label: "Out of funds", cls: "bg-red-50 text-red-800" },
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
          ? `Cancelled, ${formatCkb(s.cell.cellOutput.capacity)} CKB returned`
          : `Topped up ${formatCkb(s.terms.amount * 2n)} CKB`,
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
      <main id="main" className="pt-14 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end justify-between gap-4 mt-10 mb-6">
            <h1 className="display text-3xl sm:text-4xl font-bold">My memberships</h1>
            {lock && (
              <button onClick={() => { setLoaded(null); setRefresh((n) => n + 1); }} className={btn.quiet}>↻ Refresh</button>
            )}
          </div>

          <div className="space-y-3 mb-6">
            {error && <Alert>{error}</Alert>}
            {receipts.map((r) => <Receipt key={r.txHash} label={r.label} txHash={r.txHash} />)}
          </div>

          {!signer ? (
            <div className="border border-border rounded-lg p-10 text-center bg-white">
              <p className="text-muted text-sm mb-6">Connect your wallet to see the memberships you fund.</p>
              <button onClick={() => void connect()} className={btn.primary}>Connect wallet</button>
            </div>
          ) : rows === null ? (
            <div className="space-y-4" aria-busy="true"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
          ) : rows.length === 0 ? (
            <div className="border border-border rounded-lg p-10 text-center bg-white">
              <p className="text-muted text-sm mb-6">No memberships yet. A new one can take a few seconds to show up.</p>
              <Link href="/" className={btn.primary}>Find a creator</Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {rows.map((s) => {
                const st = STATUS[s.status];
                const k = keyOf(s);
                const tier = s.creator && tierForSubscription(s.creator, s.terms.amount, s.terms.intervalBlocks);
                return (
                  <li key={k} className="border border-border rounded-lg bg-white overflow-hidden">
                    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.creator ? <Avatar initials={s.creator.initials} hue={s.creator.hue} size="sm" /> : null}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {s.creator ? <Link href={`/c/${s.creator.slug}`} className="hover:text-rose">{s.creator.name}</Link> : "Unknown creator"}
                            {tier ? <span className="text-muted font-normal"> · {tier.name}</span> : null}
                          </div>
                          <div className="text-xs text-muted tnum">{formatCkb(s.terms.amount)} CKB every {blocksToHuman(s.terms.intervalBlocks)}</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-md font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>

                    <dl className="grid grid-cols-3 border-y border-border tnum">
                      {[
                        ["Balance", `${formatCkb(s.balance > 0n ? s.balance : 0n)} CKB`],
                        ["Payments left", s.periodsRemaining.toString()],
                        ["Next payment", s.blocksUntilNextClaim === 0n ? "Due now" : blocksToHuman(s.blocksUntilNextClaim)],
                      ].map(([l, v], i) => (
                        <div key={l} className={`px-3 sm:px-5 py-3 ${i > 0 ? "border-l border-border" : ""}`}>
                          <dt className="text-xs text-muted mb-0.5">{l}</dt>
                          <dd className="text-sm font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>

                    {(s.status === "low_balance" || s.status === "closable") && (
                      <p className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-900">
                        {s.status === "closable"
                          ? "There isn't enough left for another payment. Top up to continue, or cancel to get the rest back."
                          : "Your balance covers fewer than 2 more payments. Top up to keep your membership."}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 p-4">
                      <button onClick={() => void act(s, "topup")} disabled={!!busy} className={`${btn.primary} py-2 text-xs flex-1 min-w-[9rem]`}>
                        {busy === k ? "Confirm in your wallet…" : `Top up ${formatCkb(s.terms.amount * 2n)} CKB`}
                      </button>
                      {confirming === k ? (
                        <>
                          <button onClick={() => void act(s, "cancel")} disabled={!!busy}
                            className="press text-xs font-semibold px-3 py-2 rounded-md bg-red-700 hover:bg-red-800 text-white">
                            Yes, cancel and refund {formatCkb(s.cell.cellOutput.capacity)} CKB
                          </button>
                          <button onClick={() => setConfirming("")} className={btn.quiet}>Keep it</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirming(k)} disabled={!!busy} className={`${btn.secondary} py-2 text-xs`}>Cancel</button>
                      )}
                    </div>
                    <a href={EXPLORER_TX(s.cell.outPoint.txHash)} target="_blank" rel="noreferrer"
                      className="block px-5 pb-4 -mt-1 text-xs font-mono tnum text-muted hover:text-rose">
                      cell {shortHash(s.cell.outPoint.txHash)} ↗
                    </a>
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
