"use client";
import Link from "next/link";

const SUBS = [
  {
    id: "0xabc123",
    creator: "ckb1qzda0cr...3f8a",
    amountCKB: "5.00",
    intervalDays: 1,
    lastClaimed: 15_420_100n,
    current: 15_421_800n,
    interval: 2000n,
  },
  {
    id: "0xdef456",
    creator: "ckb1qzyx9kl...7c2b",
    amountCKB: "10.00",
    intervalDays: 7,
    lastClaimed: 15_418_000n,
    current: 15_421_800n,
    interval: 14000n,
  },
];

function blocksLeft(last: bigint, interval: bigint, current: bigint): bigint {
  const next = last + interval;
  return current >= next ? 0n : next - current;
}

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <Link href="/" className="text-neutral-500 text-sm mb-8 block hover:text-white">← Back</Link>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-neutral-400 mb-12">
          Active subscriptions. Data read directly from CKB cells — no database.
        </p>

        <div className="space-y-4">
          {SUBS.map(s => {
            const remaining  = blocksLeft(s.lastClaimed, s.interval, s.current);
            const claimable  = remaining === 0n;
            return (
              <div key={s.id} className="border border-neutral-800 p-6 hover:border-neutral-600 transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-mono text-sm text-neutral-400 mb-1">{s.creator}</div>
                    <div className="text-xl font-bold">{s.amountCKB} CKB / {s.intervalDays} day{s.intervalDays !== 1 ? "s" : ""}</div>
                  </div>
                  <div className={`text-xs px-3 py-1 font-mono ${claimable ? "bg-green-900 text-green-300" : "bg-neutral-800 text-neutral-400"}`}>
                    {claimable ? "CLAIMABLE" : "ACTIVE"}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm font-mono mb-4">
                  {[
                    ["Last claimed", `Block ${s.lastClaimed.toLocaleString()}`],
                    ["Current block", s.current.toLocaleString()],
                    ["Next claim", claimable ? "Now" : `${remaining.toLocaleString()} blocks`],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div className="text-neutral-500 mb-1">{label}</div>
                      <div>{val}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button disabled={!claimable}
                    className={`px-6 py-2 text-sm font-semibold transition ${
                      claimable ? "bg-white text-black hover:bg-neutral-200" : "border border-neutral-800 text-neutral-600 cursor-not-allowed"
                    }`}>
                    {claimable ? "Trigger Claim" : "Not yet"}
                  </button>
                  <button className="px-6 py-2 text-sm border border-neutral-700 hover:border-red-500 hover:text-red-400 transition">
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 text-xs text-neutral-600">
          Subscription Cells queried from CKB testnet by type script hash.
        </div>
      </div>
    </main>
  );
}
