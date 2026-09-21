"use client";
import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";

const TIER = { amountCKB: "5", intervalDays: 1, intervalBlocks: 2000,
               creator: "ckb1qzda0cr08m85hc8jlnfp3sdrpk7z00fakefake" };

export default function SubscribePage() {
  const { authenticated, connection, login } = useKeyWay();
  const [done, setDone] = useState(false);

  if (done) return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 px-6 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#F9ECF0] border border-[#C44F6B]/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-[#C44F6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="display text-3xl font-bold mb-3">Subscribed</h2>
          <p className="text-[#7C7570] text-sm mb-8 leading-relaxed">
            Your Subscription Cell is live on CKB testnet.
            Claims trigger every {TIER.intervalDays} day automatically.
          </p>
          <Link href="/dashboard"
            className="inline-block bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-8 py-3 rounded text-sm font-medium">
            View Dashboard
          </Link>
        </div>
      </main>
    </>
  );

  const short = `${TIER.creator.slice(0,10)}…${TIER.creator.slice(-5)}`;

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-md mx-auto">
          <Link href="/" className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block">
            ← Back
          </Link>

          <div className="flex items-center gap-3 mb-8 pb-8 border-b border-[#DDD9D3]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C44F6B] to-[#8B3A53] flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <div>
              <div className="font-semibold text-sm">Creator</div>
              <div className="text-xs font-mono text-[#7C7570]">{short}</div>
            </div>
          </div>

          <h1 className="display text-4xl font-bold mb-2">Subscribe</h1>
          <p className="text-[#7C7570] text-sm mb-8">
            Your subscription is a CKB cell you own. Cancel any time with one transaction.
          </p>

          {/* Terms */}
          <div className="bg-white border border-[#DDD9D3] rounded divide-y divide-[#EFECE7] mb-7">
            {[
              ["Payment",    `${TIER.amountCKB} CKB every ${TIER.intervalDays} day`],
              ["Interval",   `${TIER.intervalBlocks.toLocaleString()} blocks`],
              ["Your funds", "Stay in your cells"],
              ["Cancel",     "Any time, no penalty"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between items-center px-4 py-3">
                <span className="text-xs text-[#7C7570]">{k}</span>
                <span className={`text-xs font-medium ${["Your funds","Cancel"].includes(k as string) ? "text-[#2B6C50]" : ""}`}>
                  {v}
                </span>
              </div>
            ))}
          </div>

          {!authenticated ? (
            <>
              <button onClick={login}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] transition text-white py-3.5 rounded font-semibold text-sm mb-3">
                Connect with Email to Subscribe
              </button>
              <p className="text-xs text-[#7C7570] text-center">Email login · No wallet app needed</p>
            </>
          ) : !connection ? (
            <div className="w-full border border-[#DDD9D3] py-3.5 rounded text-center text-sm text-[#7C7570] animate-pulse">
              Recovering wallet…
            </div>
          ) : (
            <>
              <div className="border border-[#DDD9D3] bg-white rounded px-4 py-2.5 flex items-center gap-3 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2B6C50] shrink-0" />
                <span className="text-xs font-mono text-[#7C7570] truncate">
                  {connection.wallet.ckbAddress.slice(0,14)}…{connection.wallet.ckbAddress.slice(-5)}
                </span>
              </div>
              <button onClick={() => setDone(true)}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] transition text-white py-3.5 rounded font-semibold text-sm mb-3">
                Subscribe — {TIER.amountCKB} CKB / day
              </button>
              <p className="text-xs text-[#7C7570] text-center">Creates a Subscription Cell on CKB testnet</p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
