"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { Nav } from "@/components/Nav";
import { Alert, Footer, Skeleton, btn } from "@/components/ui";
import { Avatar, Chip, Cover } from "@/components/Creator";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLock } from "@/components/icons";
import { useWallet } from "@/lib/useWallet";
import { getCreator, tierForSubscription, tierRank, type Creator } from "@/lib/creators";
import { findSubscriptions, viewSubscription, type SubscriptionView } from "@/lib/cadencepay-sdk";
import { challengeMessage } from "@/lib/challenge";
import { blocksToHuman, formatCkb, EXPLORER_ADDRESS } from "@/lib/cadencepay";
import { friendlyTxError } from "@/lib/txErrors";

type Membership = { tierId: string | null; sub?: SubscriptionView };

const postDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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

  // The connected wallet's membership, read from the network
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
      if (!res.ok || !data.posts) throw new Error(data.error ?? "We couldn't check your membership. Please try again.");
      setBodies((b) => ({ ...b, ...Object.fromEntries(data.posts!.map((p) => [p.id, p.body])) }));
      if (!data.tierId) setUnlockMsg({ tone: "warn", text: `This wallet isn't a ${creator.name} member yet. Pick a tier below to unlock these posts.` });
    } catch (e) {
      setUnlockMsg({ tone: "error", text: friendlyTxError(e) });
    } finally {
      setUnlocking(false);
    }
  };

  const posts = [...creator.posts].reverse();
  const [latest, ...recent] = posts;
  const hasLocked = creator.posts.some((p) => p.tierId && bodies[p.id] === undefined);

  const postBody = (id: string, tierId: string | null, teaser: string, big = false) => {
    const tier = creator.tiers.find((t) => t.id === tierId);
    const body = bodies[id];
    if (body !== undefined) return <p className={`${big ? "text-[17px]" : "text-[15px]"} leading-relaxed text-ink rise`}>{body}</p>;
    return (
      <>
        <p className="text-ink-2 leading-relaxed">{teaser}</p>
        {tier ? <div className="mt-3"><Chip><IconLock className="w-3.5 h-3.5" />{tier.name} members</Chip></div> : null}
      </>
    );
  };

  const postTile = (tierId: string | null, className: string) => {
    const locked = tierId !== null && !creator.posts.some((p) => p.tierId === tierId && bodies[p.id] !== undefined);
    return (
      <div className={`relative rounded-2xl overflow-hidden ${className}`}>
        <Cover creator={creator} className="absolute inset-0" />
        {locked ? (
          <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black/45 backdrop-blur px-2.5 py-1 rounded-full">
            <IconLock className="w-3.5 h-3.5" />Locked
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <Nav />
      <main id="main" className="pt-16 overflow-x-clip">
        <Cover creator={creator} className="h-44 sm:h-64" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <header className="-mt-14 sm:-mt-16">
            <Avatar creator={creator} size="xl" ring />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-3xl sm:text-5xl font-semibold">{creator.name}</h1>
                <p className="mt-1 text-ink-2">{creator.craft}</p>
                <p className="mt-4 text-[16.5px] leading-relaxed">{creator.bio}</p>
                <p className="mt-3 text-xs text-ink-3">
                  Payments go to{" "}
                  <a href={EXPLORER_ADDRESS(creator.payoutAddress)} target="_blank" rel="noreferrer" className="font-mono tnum underline hover:text-pink">
                    {creator.payoutAddress.slice(0, 10)}…{creator.payoutAddress.slice(-6)}
                  </a>
                </p>
              </div>
              {currentTier ? null : (
                <a href="#membership" className={btn.primaryLg}>Become a member <IconArrowRight className="arrow w-4 h-4" /></a>
              )}
            </div>

            {currentTier && current?.sub ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-mint px-5 py-4">
                <Chip tone="green"><IconCheck className="w-3.5 h-3.5" />{currentTier.name} member</Chip>
                <p className="text-sm text-forest flex-1 min-w-[12rem]">
                  {current.sub.periodsRemaining.toString()} payments left · next {current.sub.blocksUntilNextClaim === 0n ? "due now" : `in ${blocksToHuman(current.sub.blocksUntilNextClaim)}`}
                </p>
                <Link href="/dashboard" className={btn.secondarySm}>Manage</Link>
              </div>
            ) : signer && !membership ? (
              <Skeleton className="mt-6 h-14" />
            ) : null}
          </header>

          {/* Posts */}
          <section aria-labelledby="posts" className="mt-14">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="posts" className="text-2xl font-semibold">Latest post</h2>
              {hasLocked && (
                signer ? (
                  <button onClick={() => void unlock()} disabled={unlocking} className={btn.secondarySm}>
                    <IconLock className="w-3.5 h-3.5" />{unlocking ? "Check your wallet…" : "Show my member posts"}
                  </button>
                ) : (
                  <button onClick={() => void connect()} className={btn.secondarySm}>Connect to see member posts</button>
                )
              )}
            </div>
            {unlockMsg && <div className="mt-4"><Alert tone={unlockMsg.tone}>{unlockMsg.text}</Alert></div>}

            {latest && (
              <article className="mt-5 grid md:grid-cols-[1.1fr_1fr] gap-6 items-center">
                {postTile(latest.tierId, "aspect-[16/10]")}
                <div>
                  <h3 className="text-2xl font-semibold leading-tight">{latest.title}</h3>
                  <div className="mt-3">{postBody(latest.id, latest.tierId, latest.teaser, true)}</div>
                  <p className="mt-3 text-sm text-ink-3 tnum">{postDate(latest.date)}</p>
                </div>
              </article>
            )}

            {recent.length > 0 && (
              <>
                <h2 className="mt-14 text-2xl font-semibold">Recent posts</h2>
                <ul className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recent.map((p) => (
                    <li key={p.id}>
                      {postTile(p.tierId, "aspect-[16/10]")}
                      <h3 className="mt-3 text-lg font-semibold leading-snug">{p.title}</h3>
                      <div className="mt-1.5">{postBody(p.id, p.tierId, p.teaser)}</div>
                      <p className="mt-2 text-sm text-ink-3 tnum">{postDate(p.date)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Membership tiers */}
          <section id="membership" aria-labelledby="membership-h" className="mt-20 scroll-mt-24">
            <h2 id="membership-h" className="text-2xl font-semibold">Choose your membership</h2>
            <p className="mt-1 text-ink-2">Your money stays yours. {creator.name} collects one payment per period, and you can cancel any time.</p>
            <ul className={`mt-6 grid gap-5 ${creator.tiers.length > 1 ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
              {creator.tiers.map((t) => {
                const isCurrent = t.id === current?.tierId;
                return (
                  <li key={t.id} className={`lift rounded-3xl border bg-white p-6 flex flex-col ${isCurrent ? "border-forest ring-2 ring-forest/20" : "border-line"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold">{t.name}</h3>
                      {isCurrent ? <Chip tone="green">Your tier</Chip> : null}
                    </div>
                    <p className="mt-3 tnum"><span className="text-4xl font-semibold tracking-tight">{formatCkb(t.amount)}</span> <span className="text-ink-2">CKB {t.intervalLabel}</span></p>
                    <ul className="mt-5 mb-7 space-y-2 text-[15px]">
                      {t.perks.map((perk) => (
                        <li key={perk} className="flex gap-2.5 items-start"><IconCheck className="w-4 h-4 mt-1 text-pink shrink-0" />{perk}</li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      {isCurrent ? (
                        <Link href="/dashboard" className={`${btn.secondary} w-full`}>Manage membership</Link>
                      ) : (
                        <Link href={`/c/${creator.slug}/join/${t.id}`} className={`${btn.primary} w-full`}>Join {t.name}</Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <Link href="/" className="inline-flex items-center gap-1.5 mt-14 text-sm text-ink-2 hover:text-pink"><IconArrowLeft className="w-4 h-4" />All creators</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
