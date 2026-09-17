"use client";
import { useState } from "react";
import Link from "next/link";

const TIER = { amountCKB: "5.00", intervalDays: 1, intervalBlocks: 2000 };

export default function SubscribePage() {
  const [done, setDone] = useState(false);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-24">
        <Link href="/" className="text-neutral-500 text-sm mb-8 block hover:text-white">← Back</Link>
        {!done ? (
          <>
            <h1 className="text-3xl font-bold mb-2">Subscribe</h1>
            <p className="text-neutral-400 mb-8">
              Your subscription is a CKB cell you own. Cancel at any time.
            </p>
            <div className="bg-neutral-900 border border-neutral-800 p-6 mb-8">
              <div className="text-sm text-neutral-400 mb-4">Subscription terms</div>
              <div className="space-y-3 font-mono text-sm">
                {[
                  ["Payment", `${TIER.amountCKB} CKB every ${TIER.intervalDays} day`],
                  ["Interval", `${TIER.intervalBlocks.toLocaleString()} blocks`],
                  ["Custody", "You keep your funds"],
                  ["Cancel", "Any time, no fee"],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-neutral-500">{k}</span>
                    <span className={["Custody","Cancel"].includes(k as string) ? "text-green-400" : ""}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setDone(true)}
              className="w-full bg-white text-black py-4 font-semibold hover:bg-neutral-200 transition mb-3">
              Connect Wallet & Subscribe
            </button>
            <p className="text-xs text-neutral-600 text-center">
              One transaction. Creates a Subscription Cell on CKB testnet.
            </p>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-6">✓</div>
            <h2 className="text-2xl font-bold mb-4">Subscribed</h2>
            <p className="text-neutral-400 mb-8">
              Your Subscription Cell is live. Claims trigger every {TIER.intervalDays} day automatically.
            </p>
            <Link href="/dashboard"
              className="border border-white px-8 py-3 font-semibold hover:bg-white hover:text-black transition">
              View Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
