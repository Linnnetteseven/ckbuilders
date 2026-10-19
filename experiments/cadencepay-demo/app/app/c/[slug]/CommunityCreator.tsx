"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/useWallet";
import { findProfileBySlug, type Profile } from "@/lib/profiles";
import { Nav } from "@/components/Nav";
import { Footer, Skeleton, btn } from "@/components/ui";
import { CreatorView } from "./CreatorView";
import { CheckoutView } from "./join/[tier]/CheckoutView";

/** A creator who signed up on-chain: load their profile cell, then show the usual page or checkout. */
export function CommunityCreator({ slug, tierId }: { slug: string; tierId?: string }) {
  const { client } = useWallet();
  const [state, setState] = useState<{ slug: string; profile: Profile | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    findProfileBySlug(client, slug)
      .then((p) => { if (!cancelled) setState({ slug, profile: p ?? null }); })
      .catch(() => { if (!cancelled) setState({ slug, profile: null }); });
    return () => { cancelled = true; };
  }, [client, slug]);

  const profile = state?.slug === slug ? state.profile : undefined;
  if (profile === undefined) {
    return (
      <>
        <Nav />
        <main id="main" className="pt-16" aria-busy="true">
          <Skeleton className="h-36 sm:h-44 rounded-none" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 space-y-4"><Skeleton className="h-10 max-w-sm" /><Skeleton className="h-24" /></div>
        </main>
      </>
    );
  }
  if (profile === null || (tierId && !profile.creator.tiers.some((t) => t.id === tierId))) {
    return (
      <>
        <Nav />
        <main id="main" className="pt-16 px-4 sm:px-6">
          <div className="max-w-xl mx-auto mt-20 text-center">
            <h1 className="display-thin text-5xl">Creator not found</h1>
            <p className="mt-4 text-ink-2">This page may have been removed, or it&apos;s still being confirmed on the network. Try again in a minute.</p>
            <Link href="/app" className={`${btn.primaryLg} mt-8`}>Explore creators</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }
  return tierId
    ? <CheckoutView slug={slug} tierId={tierId} creator={profile.creator} />
    : <CreatorView slug={slug} creator={profile.creator} />;
}
