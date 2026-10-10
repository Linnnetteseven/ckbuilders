"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Avatar, Footer, Skeleton, btn } from "@/components/ui";
import { useWallet } from "@/lib/useWallet";
import { getCreator, tierForSubscription, tierRank, type Creator } from "@/lib/creators";
import { findSubscriptions, viewSubscription, type SubscriptionView } from "@/lib/cadencepay-sdk";
import { challengeMessage } from "@/lib/challenge";
import { blocksToHuman, formatCkb, EXPLORER_ADDRESS } from "@/lib/cadencepay";
import { friendlyTxError } from "@/lib/txErrors";

type Membership = { tierId: string | null; sub?: SubscriptionView };

export function CreatorView({ slug }: { slug: string }) {
  const creator = getCreator(slug) as Creator;
  const { signer, client, lock, address, connect } = useWallet();
  const [membership, setMembership] = useState<{ owner: string; m: Membership } | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<{ tone: "error" | "warn"; text: string } | null>(null);

  // Public post bodies
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/${slug}`)
      .then((r) => r.json() as Promise<{ posts: { id: string; body: string }[] }>)
      .then((d) => {
        if (!cancelled) setBodies((b) => ({ ...b, ...Object.fromEntries(d.posts.map((p) => [p.id, p.body])) }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  // Membership of the connected wallet, read from chain
  useEffect(() => {
    if (!lock) return;
    const owner = lock.hash();
    let cancelled = false;
    (async () => {
      const recipient = await ccc.Address.fromString(creator.payoutAddress, client);
      const [tip, subs] = await Promise.all([
        client.getTipHeader(),
        findSubscriptions(client, { subscriberLockHash: owner, recipientLockHash: recipient.script.hash() }),
      ]);
      let best: Membership = { tierId: null };
      for (const s of subs) {
        const v = viewSubscription(s, tip.number);
        if (v.status === "closable") continue;
        const t = tierForSubscription(creator, s.terms.amount, s.terms.intervalBlocks);
        if (t && tierRank(creator, t.id) > tierRank(creator, best.tierId)) best = { tierId: t.id, sub: v };
      }
      return best;
    })()
      .then((m) => { if (!cancelled) setMembership({ owner, m }); })
      .catch(() => { if (!cancelled) setMembership({ owner, m: { tierId: null } }); });
    return () => { cancelled = true; };
  }, [lock, client, creator]);

  const current = membership && lock && membership.owner === lock.hash() ? membership.m : null;
  const currentTier = creator.tiers.find((t) => t.id === current?.tierId);

  const unlock = async () => {
    if (!signer || !address) return;
    setUnlocking(true);
    setUnlockMsg(null);
    try {
      const issuedAt = Date.now();
      const signature = await signer.signMessage(challengeMessage(slug, address, issuedAt));
      const res = await fetch(`/api/posts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, issuedAt, signature }),
      });
      const data = (await res.json()) as { tierId?: string | null; posts?: { id: string; body: string }[]; error?: string };
      if (!res.ok || !data.posts) throw new Error(data.error ?? "Could not check your membership");
      setBodies((b) => ({ ...b, ...Object.fromEntries(data.posts!.map((p) => [p.id, p.body])) }));
      if (!data.tierId) setUnlockMsg({ tone: "warn", text: "No active membership found for this wallet. Join a tier to read member posts." });
    } catch (e) {
      setUnlockMsg({ tone: "error", text: friendlyTxError(e) });
    } finally {
      setUnlocking(false);
    }
  };

  const hasLocked = creator.posts.some((p) => p.tierId && bodies[p.id] === undefined);

  return (
    <>
      <Nav />
      <main id="main" className="pt-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="inline-block mt-8 text-xs text-muted hover:text-ink">← All creators</Link>

          <header className="grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-7 items-start mt-6 mb-12">
            <Avatar initials={creator.initials} hue={creator.hue} size="lg" />
            <div className="min-w-0">
              <h1 className="display text-4xl sm:text-5xl font-bold leading-tight">{creator.name}</h1>
              <p className="text-muted mt-1">{creator.craft}</p>
              <p className="mt-4 max-w-[62ch] leading-relaxed">{creator.bio}</p>
              <p className="text-xs text-muted mt-3">
                Paid to{" "}
                <a href={EXPLORER_ADDRESS(creator.payoutAddress)} target="_blank" rel="noreferrer" className="font-mono tnum underline">
                  {creator.payoutAddress.slice(0, 10)}…{creator.payoutAddress.slice(-6)}
                </a>
              </p>
            </div>
          </header>

          {currentTier && current?.sub && (
            <div className="mb-10">
              <Alert tone="ok">
                You&apos;re a <strong>{currentTier.name}</strong> member · {current.sub.periodsRemaining.toString()} payments funded ·
                next {current.sub.blocksUntilNextClaim === 0n ? "due now" : `in ${blocksToHuman(current.sub.blocksUntilNextClaim)}`} ·{" "}
                <Link href="/dashboard" className="underline">manage</Link>
              </Alert>
            </div>
          )}

          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-16 items-start">
            <section aria-labelledby="posts">
              <div className="flex items-baseline justify-between border-b border-ink pb-3">
                <h2 id="posts" className="text-sm font-semibold">Posts</h2>
                {hasLocked && (
                  signer ? (
                    <button onClick={() => void unlock()} disabled={unlocking} className={btn.quiet}>
                      {unlocking ? "Confirm in your wallet…" : "Show member posts"}
                    </button>
                  ) : (
                    <button onClick={() => void connect()} className={btn.quiet}>Connect to read member posts</button>
                  )
                )}
              </div>
              {unlockMsg && <div className="mt-4"><Alert tone={unlockMsg.tone}>{unlockMsg.text}</Alert></div>}
              <ul className="divide-y divide-border">
                {[...creator.posts].reverse().map((p) => {
                  const tier = creator.tiers.find((t) => t.id === p.tierId);
                  const body = bodies[p.id];
                  return (
                    <li key={p.id} className="py-6">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5 text-xs text-muted tnum">
                        <time dateTime={p.date}>{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time>
                        <span>{tier ? `${tier.name} and up` : "Public"}</span>
                      </div>
                      <h3 className="display text-xl font-semibold mb-2">{p.title}</h3>
                      {body !== undefined ? (
                        <p className="leading-relaxed max-w-[65ch]">{body}</p>
                      ) : (
                        <div className="relative">
                          <p className="text-muted leading-relaxed">{p.teaser}</p>
                          <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium bg-surface rounded-md px-2.5 py-1.5">
                            <span aria-hidden>🔒</span> For {tier?.name ?? "member"} members
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside aria-labelledby="tiers" className="order-first lg:order-none lg:sticky lg:top-24">
              <h2 id="tiers" className="text-sm font-semibold border-b border-ink pb-3 mb-4">Membership</h2>
              <div className="space-y-3">
                {creator.tiers.map((t) => {
                  const isCurrent = t.id === current?.tierId;
                  return (
                    <div key={t.id} className={`rounded-lg border p-5 bg-white ${isCurrent ? "border-forest" : "border-border"}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold">{t.name}</h3>
                        <span className="text-sm tnum"><strong>{formatCkb(t.amount)} CKB</strong></span>
                      </div>
                      <p className="text-xs text-muted mb-3">{t.intervalLabel}</p>
                      <ul className="text-sm space-y-1 mb-5">
                        {t.perks.map((perk) => <li key={perk} className="flex gap-2"><span aria-hidden className="text-forest">✓</span>{perk}</li>)}
                      </ul>
                      {isCurrent ? (
                        <p className="text-sm text-forest font-medium">Your current tier</p>
                      ) : (
                        <Link href={`/c/${creator.slug}/join/${t.id}`} className={`${btn.primary} w-full`}>
                          Join {t.name}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-4 leading-relaxed">
                You fund your own Subscription Cell. {creator.name} can take one payment per period and nothing more. Cancel any time.
              </p>
              {signer && !membership && <Skeleton className="h-4 w-40 mt-4" />}
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
