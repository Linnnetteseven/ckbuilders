"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Avatar, Footer, Receipt, Skeleton, btn } from "@/components/ui";
import { useWallet } from "@/lib/useWallet";
import { CREATORS, tierForSubscription } from "@/lib/creators";
import { findSubscriptions, viewSubscription, type SubscriptionView } from "@/lib/cadencepay-sdk";
import { creatorPayouts, type PayoutEvent } from "@/lib/history";
import { EXPLORER_TX, blocksToHuman, formatCkb, shortHash } from "@/lib/cadencepay";

type Data = { slug: string; subs: SubscriptionView[]; payouts: PayoutEvent[] };
const keyOf = (s: SubscriptionView) => `${s.cell.outPoint.txHash}:${s.cell.outPoint.index}`;

/**
 * Creator dashboard. All of this is public chain data, so it works without a
 * login. Claims go through the keeper, which only pays the fee: the script
 * sends the payment to the creator's own address no matter who submits it.
 */
export default function CreatorDashboard() {
  const { client, lock } = useWallet();
  const [slug, setSlug] = useState(CREATORS[0].slug);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [receipts, setReceipts] = useState<{ label: string; txHash: string }[]>([]);
  const [refresh, setRefresh] = useState(0);
  // Cells already claimed in this session; the indexer can lag a block or two behind
  const [pending, setPending] = useState<Set<string>>(new Set());

  const creator = CREATORS.find((c) => c.slug === slug)!;

  // If the connected wallet IS one of the creators, open their dashboard
  useEffect(() => {
    if (!lock) return;
    let cancelled = false;
    Promise.all(CREATORS.map(async (c) => ({ c, s: (await ccc.Address.fromString(c.payoutAddress, client)).script })))
      .then((all) => {
        const mine = all.find(({ s }) => s.eq(lock));
        if (!cancelled && mine) setSlug(mine.c.slug);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lock, client]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recipient = (await ccc.Address.fromString(creator.payoutAddress, client)).script;
      const [tip, subs, payouts] = await Promise.all([
        client.getTipHeader(),
        findSubscriptions(client, { recipientLockHash: recipient.hash() }),
        creatorPayouts(client, recipient),
      ]);
      return { slug: creator.slug, subs: subs.map((s) => viewSubscription(s, tip.number)), payouts };
    })()
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [creator, client, refresh]);

  const current = data && data.slug === slug ? data : null;
  const due = current?.subs.filter((s) => s.status === "due" && !pending.has(keyOf(s))) ?? [];

  const claim = async (subs: SubscriptionView[]) => {
    setError("");
    for (const s of subs) {
      setBusy(keyOf(s));
      try {
        const res = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: s.cell.outPoint.txHash, index: Number(s.cell.outPoint.index), recipientAddress: creator.payoutAddress }),
        });
        const d = (await res.json()) as { success: boolean; txHash?: string; error?: string };
        if (!d.success || !d.txHash) throw new Error(d.error ?? "Claim failed");
        setReceipts((r) => [{ label: `Claimed ${formatCkb(s.terms.amount)} CKB`, txHash: d.txHash! }, ...r]);
        setPending((p) => new Set(p).add(keyOf(s)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Claim failed");
        break;
      }
    }
    setBusy("");
    for (const ms of [4000, 10000, 20000]) setTimeout(() => setRefresh((n) => n + 1), ms);
  };

  const revenue = current?.payouts.reduce((a, p) => a + p.amount, 0n) ?? 0n;

  return (
    <>
      <Nav />
      <main id="main" className="pt-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mt-10 mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted mb-1">Creator dashboard</p>
              <h1 className="display text-3xl sm:text-4xl font-bold">{creator.name}</h1>
            </div>
            <div role="tablist" aria-label="Creator" className="flex gap-1 bg-surface p-1 rounded-lg overflow-x-auto max-w-full">
              {CREATORS.map((c) => (
                <button key={c.slug} role="tab" aria-selected={c.slug === slug} onClick={() => setSlug(c.slug)}
                  className={`press whitespace-nowrap text-xs sm:text-sm px-3 py-1.5 rounded-md ${c.slug === slug ? "bg-white shadow-sm font-medium" : "text-muted hover:text-ink"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden mb-8">
            {[
              ["Members", current ? String(current.subs.filter((s) => s.status !== "closable").length) : null],
              ["Claimable now", current ? `${formatCkb(due.reduce((a, s) => a + s.terms.amount, 0n))} CKB` : null],
              ["Received (recent)", current ? `${formatCkb(revenue)} CKB` : null],
              ["Prepaid by members", current ? `${formatCkb(current.subs.reduce((a, s) => a + (s.balance > 0n ? s.balance : 0n), 0n))} CKB` : null],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-4">
                <dt className="text-xs text-muted mb-1">{k}</dt>
                <dd className="text-lg sm:text-xl font-semibold tnum">{v ?? <Skeleton className="h-6 w-20" />}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-3 mb-6">
            {error && <Alert>{error}</Alert>}
            {receipts.map((r) => <Receipt key={r.txHash} label={r.label} txHash={r.txHash} />)}
          </div>

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-start">
            <section aria-labelledby="members">
              <div className="flex items-center justify-between border-b border-ink pb-3">
                <h2 id="members" className="text-sm font-semibold">Members</h2>
                <button onClick={() => void claim(due)} disabled={!due.length || !!busy} className={`${btn.primary} py-2 px-3.5 text-xs`}>
                  {busy ? "Claiming…" : due.length ? `Claim all (${due.length})` : "Nothing due"}
                </button>
              </div>
              {!current ? (
                <div className="space-y-3 pt-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
              ) : current.subs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-muted text-sm mb-5">No members yet. Share your page to get your first one.</p>
                  <Link href={`/c/${creator.slug}`} className={btn.secondary}>Open {creator.name}&apos;s page</Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {current.subs.map((s) => {
                    const tier = tierForSubscription(creator, s.terms.amount, s.terms.intervalBlocks);
                    return (
                      <li key={keyOf(s)} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{tier?.name ?? "Custom"} · <span className="font-mono tnum text-xs text-muted">{shortHash(s.subscriberLockHash, 8, 4)}</span></div>
                          <div className="text-xs text-muted tnum">
                            {formatCkb(s.terms.amount)} CKB · {s.periodsRemaining.toString()} left ·{" "}
                            {s.status === "due" ? <span className="text-rose font-medium">due now</span>
                              : s.status === "closable" ? "out of funds"
                              : `next in ${blocksToHuman(s.blocksUntilNextClaim)}`}
                          </div>
                        </div>
                        {pending.has(keyOf(s)) ? (
                          <span className="text-xs text-forest shrink-0" aria-live="polite">Claimed · updating…</span>
                        ) : (
                          <button onClick={() => void claim([s])} disabled={s.status !== "due" || !!busy} className={`${btn.secondary} py-1.5 px-3 text-xs shrink-0`}>
                            {busy === keyOf(s) ? "Claiming…" : "Claim"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="history">
              <h2 id="history" className="text-sm font-semibold border-b border-ink pb-3">Payments received</h2>
              {!current ? (
                <div className="space-y-3 pt-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
              ) : current.payouts.length === 0 ? (
                <p className="text-sm text-muted py-6">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {current.payouts.map((p) => (
                    <li key={p.txHash} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="capitalize">{p.kind}</div>
                        <a href={EXPLORER_TX(p.txHash)} target="_blank" rel="noreferrer" className="text-xs font-mono tnum text-muted hover:text-rose">
                          block {p.blockNumber.toLocaleString("en-US")} · {shortHash(p.txHash, 8, 4)} ↗
                        </a>
                      </div>
                      <span className="font-semibold tnum shrink-0">+{formatCkb(p.amount)} CKB</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted mt-4 leading-relaxed">
                Claims are paid straight to the creator&apos;s own address. The keeper that submits them only pays the network fee.
              </p>
            </section>
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs text-muted">
            <Avatar initials={creator.initials} hue={creator.hue} size="sm" />
            <span>Public view. Anyone can see and trigger due claims; only {creator.name} receives the CKB.</span>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
