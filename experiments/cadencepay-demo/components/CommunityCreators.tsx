"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/useWallet";
import { findProfiles, type Profile } from "@/lib/profiles";
import { Avatar, Chip, Cover } from "@/components/Creator";
import { btn } from "@/components/ui";
import { formatCkb } from "@/lib/cadencepay";

/** Creators who signed up on-chain, read straight from the network. */
export function CommunityCreators() {
  const { client } = useWallet();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    findProfiles(client).then((p) => { if (!cancelled) setProfiles(p); }, () => { if (!cancelled) setProfiles([]); });
    return () => { cancelled = true; };
  }, [client]);

  return (
    <section aria-labelledby="new-h" className="px-4 sm:px-6 mt-24 sm:mt-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="new-h" className="text-3xl sm:text-4xl font-semibold">New on CadencePay</h2>
          <Link href="/app/start" className={btn.primary}>Start your page</Link>
        </div>
        {profiles === null ? (
          <p className="mt-6 text-ink-3" aria-busy="true">Looking for new creators on the network…</p>
        ) : profiles.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-blush px-6 py-12 text-center">
            <p className="text-lg font-semibold">No one has signed up yet. Be the first.</p>
            <p className="text-ink-2 mt-1">It takes a couple of minutes and free test CKB.</p>
          </div>
        ) : (
          <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map(({ creator: c }) => {
              const from = c.tiers.reduce((m, t) => (t.amount < m ? t.amount : m), c.tiers[0].amount);
              return (
                <li key={c.slug} className="lift rounded-3xl border border-line bg-white overflow-hidden flex flex-col">
                  <Cover creator={c} className="h-28" />
                  <div className="px-5 pb-5 -mt-8 flex-1 flex flex-col">
                    <div className="flex items-end justify-between"><Avatar creator={c} size="lg" ring /><Chip tone="gray">New</Chip></div>
                    <h3 className="mt-3 text-xl font-semibold">{c.name}</h3>
                    <p className="text-sm text-ink-2">{c.craft}</p>
                    <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                      <span className="text-sm tnum"><strong className="font-semibold">{formatCkb(from)} CKB</strong> <span className="text-ink-3">/ period</span></span>
                      <Link href={`/app/c/${c.slug}`} className={btn.primarySm}>Become a member</Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
