"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Footer, Receipt, Skeleton, btn } from "@/components/ui";
import { Avatar, Chip, Cover } from "@/components/Creator";
import { IconExternal } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { CREATORS, tierForSubscription } from "@/lib/creators";
import { findSubscriptions, viewSubscription, type SubscriptionView } from "@/lib/cadencepay-sdk";
import { creatorPayouts, type PayoutEvent } from "@/lib/history";
import { EXPLORER_TX, blocksToHuman, formatCkb, shortHash } from "@/lib/cadencepay";

type Data = { slug: string; subs: SubscriptionView[]; payouts: PayoutEvent[] };
const keyOf = (s: SubscriptionView) => `${s.cell.outPoint.txHash}:${s.cell.outPoint.index}`;

function friendlyCollectError(msg: string): string {
  if (/not due/i.test(msg)) return "That payment isn't ready to collect yet.";
  if (/not configured/i.test(msg)) return "Collecting is switched off right now. Please try again later.";
  if (/too many/i.test(msg)) return "Slow down a little and try again in a minute.";
  if (/not found|already spent/i.test(msg)) return "That payment was already collected. Refreshing…";
  return "We couldn't collect that payment. Please try again.";
}

/**
 * For creators. Everything here is public on the network, so no login is
 * needed. Collecting sends the payment to the creator's own address; the
 * helper that submits it only pays the network fee.
 */
export default function ForCreators() {
  const { client, lock } = useWallet();
  const [slug, setSlug] = useState(CREATORS[0].slug);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [receipts, setReceipts] = useState<{ label: string; txHash: string }[]>([]);
  const [refresh, setRefresh] = useState(0);
  // Payments already collected this session; the network index can lag a block or two
  const [pending, setPending] = useState<Set<string>>(new Set());

  const creator = CREATORS.find((c) => c.slug === slug)!;

  // If the connected wallet IS one of the creators, open their page
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
      .catch(() => { if (!cancelled) setError("We couldn't load this creator's members. Check your connection and refresh."); });
    return () => { cancelled = true; };
  }, [creator, client, refresh]);

  const current = data && data.slug === slug ? data : null;
  const active = current?.subs.filter((s) => s.status !== "closable") ?? [];
  const due = current?.subs.filter((s) => s.status === "due" && !pending.has(keyOf(s))) ?? [];
  const ready = due.reduce((a, s) => a + s.terms.amount, 0n);
  const received = current?.payouts.reduce((a, p) => a + p.amount, 0n) ?? 0n;
  const upcoming = current?.subs.reduce((a, s) => a + (s.balance > 0n ? s.balance : 0n), 0n) ?? 0n;

  const collect = async (subs: SubscriptionView[]) => {
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
        if (!d.success || !d.txHash) throw new Error(d.error ?? "");
        setReceipts((r) => [{ label: `Collected ${formatCkb(s.terms.amount)} CKB for ${creator.name}`, txHash: d.txHash! }, ...r]);
        setPending((p) => new Set(p).add(keyOf(s)));
      } catch (e) {
        setError(friendlyCollectError(e instanceof Error ? e.message : ""));
        break;
      }
    }
    setBusy("");
    for (const ms of [4000, 10000, 20000]) setTimeout(() => setRefresh((n) => n + 1), ms);
  };

  return (
    <>
      <Nav />
      <main id="main" className="pt-16 overflow-x-clip">
        <Cover creator={creator} className="h-36 sm:h-44" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <Avatar creator={creator} size="xl" ring />
            <div role="tablist" aria-label="Creator" className="flex gap-1 bg-soft p-1 rounded-full overflow-x-auto max-w-full">
              {CREATORS.map((c) => (
                <button key={c.slug} role="tab" aria-selected={c.slug === slug} onClick={() => setSlug(c.slug)}
                  className={`whitespace-nowrap text-sm px-3.5 py-1.5 rounded-full transition-colors ${c.slug === slug ? "bg-white shadow-[0_1px_3px_rgba(24,21,18,.12)] font-semibold" : "text-ink-2 hover:text-ink"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl sm:text-5xl font-semibold">{creator.name}</h1>
            <Link href={`/c/${creator.slug}`} className={btn.quiet}>View public page <IconExternal className="w-3.5 h-3.5" /></Link>
          </div>

          {current ? (
            <p className="mt-3 text-lg text-ink-2 tnum leading-relaxed">
              <strong className="text-ink font-semibold">{active.length} active {active.length === 1 ? "member" : "members"}</strong>
              <span className="mx-2 text-line">/</span><strong className="text-pink font-semibold">{formatCkb(ready)} CKB</strong> ready to collect
              <span className="mx-2 text-line">/</span><strong className="text-ink font-semibold">{formatCkb(received)} CKB</strong> earned
              <span className="mx-2 text-line">/</span><strong className="text-ink font-semibold">{formatCkb(upcoming)} CKB</strong> coming as members stay
            </p>
          ) : (
            <Skeleton className="mt-3 h-7 max-w-xl" />
          )}

          <div className="space-y-3 mt-6">
            {error && <Alert>{error}</Alert>}
            {receipts.map((r) => <Receipt key={r.txHash} label={r.label} txHash={r.txHash} />)}
          </div>

          <div className="mt-8 grid lg:grid-cols-[1.25fr_1fr] gap-8 items-start">
            <section aria-labelledby="members" className="rounded-3xl border border-line px-5 sm:px-6 pt-5 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
                <h2 id="members" className="text-xl font-semibold">Members</h2>
                <button onClick={() => void collect(due)} disabled={!due.length || !!busy} className={btn.primary}>
                  {busy ? "Collecting…" : due.length ? `Collect ${formatCkb(ready)} CKB` : "Nothing to collect yet"}
                </button>
              </div>
              {!current ? (
                <div className="space-y-3 py-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
              ) : current.subs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-ink-2 mb-6">No members yet. Share your page to welcome your first one.</p>
                  <Link href={`/c/${creator.slug}`} className={btn.secondary}>Open {creator.name}&apos;s page</Link>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {current.subs.map((s) => {
                    const tier = tierForSubscription(creator, s.terms.amount, s.terms.intervalBlocks);
                    const k = keyOf(s);
                    return (
                      <li key={k} className="flex items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2">{tier?.name ?? "Member"} <span className="font-mono tnum text-xs text-ink-3 font-normal">{shortHash(s.subscriberLockHash, 6, 4)}</span></div>
                          <div className="text-sm text-ink-2 tnum">
                            {formatCkb(s.terms.amount)} CKB · {s.periodsRemaining.toString()} left ·{" "}
                            {s.status === "due" ? <strong className="text-pink font-semibold">ready now</strong>
                              : s.status === "closable" ? "out of payments"
                              : `next in ${blocksToHuman(s.blocksUntilNextClaim)}`}
                          </div>
                        </div>
                        {pending.has(k) ? (
                          <span className="shrink-0" aria-live="polite"><Chip tone="green">Collected · updating</Chip></span>
                        ) : (
                          <button onClick={() => void collect([s])} disabled={s.status !== "due" || !!busy} className={`${btn.secondarySm} shrink-0`}>
                            {busy === k ? "Collecting…" : "Collect"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="earnings" className="rounded-3xl bg-soft px-5 sm:px-6 pt-5 pb-3">
              <h2 id="earnings" className="text-xl font-semibold pb-4 border-b border-line">Earnings</h2>
              {!current ? (
                <div className="space-y-3 py-4"><Skeleton className="h-12 bg-white" /><Skeleton className="h-12 bg-white" /></div>
              ) : current.payouts.length === 0 ? (
                <p className="text-ink-2 py-8">No payments yet. They&apos;ll show up here as they arrive.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {current.payouts.map((p) => (
                    <li key={p.txHash} className="flex items-center justify-between gap-3 py-3.5">
                      <div className="min-w-0">
                        <div className="font-medium">{p.kind === "claim" ? "Payment collected" : "New member, first payment"}</div>
                        <a href={EXPLORER_TX(p.txHash)} target="_blank" rel="noreferrer" className="text-xs font-mono tnum text-ink-3 hover:text-pink">
                          Receipt {shortHash(p.txHash, 6, 4)}
                        </a>
                      </div>
                      <span className="text-lg font-semibold tnum text-forest shrink-0">+{formatCkb(p.amount)} CKB</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-3 py-4 leading-relaxed">
                Payments always go straight to {creator.name}. Collecting is free for you: a small helper pays the network fee.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
