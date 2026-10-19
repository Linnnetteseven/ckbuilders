"use client";
import { useState } from "react";
import type { ccc } from "@ckb-ccc/core";
import { membershipHistory, type MembershipEvent } from "@/lib/history";
import type { SubscriptionView } from "@/lib/cadencepay-sdk";
import { formatCkb, shortHash, EXPLORER_TX } from "@/lib/cadencepay";
import { Skeleton } from "@/components/ui";
import { IconChevronDown } from "@/components/icons";

const LABEL: Record<MembershipEvent["kind"], string> = {
  joined: "Joined · first payment",
  payment: "Payment collected",
  "top-up": "You topped up",
  ended: "Ended · refunded to you",
};

/** Every payment of one membership, read from the chain when opened. */
export function MembershipHistory({ sub, client }: { sub: SubscriptionView; client: ccc.Client }) {
  const [events, setEvents] = useState<MembershipEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (events || failed) return;
    membershipHistory(client, sub).then(setEvents, () => setFailed(true));
  };

  return (
    <details className="mt-5 group rounded-2xl border border-line" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) load(); }}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between">
        Payment history
        <IconChevronDown className="w-4 h-4 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-3">
        {failed ? (
          <p className="text-sm text-ink-2 py-2">We couldn&apos;t load the history. Try again later.</p>
        ) : !events ? (
          <div className="space-y-2 py-1"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => (
              <li key={e.txHash} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{LABEL[e.kind]}</div>
                  <a href={EXPLORER_TX(e.txHash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-ink-3 hover:text-pink">
                    Receipt {shortHash(e.txHash)}
                  </a>
                </div>
                <span className={`tnum font-semibold shrink-0 ${e.kind === "payment" || e.kind === "joined" ? "" : "text-forest"}`}>
                  {e.kind === "payment" || e.kind === "joined" ? "−" : "+"}{formatCkb(e.amount)} CKB
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
