"use client";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";

const MOCK = [
  { id: "0xabc", creator: "ckb1qzda0cr…3f8a", amountCKB: "5.00",  intervalDays: 1, last: 15_420_100n, current: 15_421_800n, interval: 2000n  },
  { id: "0xdef", creator: "ckb1qzyx9kl…7c2b", amountCKB: "10.00", intervalDays: 7, last: 15_418_000n, current: 15_421_800n, interval: 14000n },
];

function blocksLeft(last: bigint, int: bigint, cur: bigint): bigint {
  const next = last + int;
  return cur >= next ? 0n : next - cur;
}

export default function Dashboard() {
  const { authenticated, connection, login } = useKeyWay();

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block">
            ← Back
          </Link>

          <div className="flex items-baseline justify-between mb-10">
            <h1 className="display text-4xl font-bold">Dashboard</h1>
            {connection && (
              <span className="text-xs font-mono text-[#7C7570]">
                {connection.wallet.ckbAddress.slice(0,10)}…{connection.wallet.ckbAddress.slice(-4)}
              </span>
            )}
          </div>

          {!authenticated ? (
            <div className="border border-[#DDD9D3] rounded p-12 text-center bg-white">
              <p className="text-[#7C7570] text-sm mb-6">Connect to view your Subscription Cells</p>
              <button onClick={login}
                className="bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-6 py-2.5 rounded text-sm font-medium">
                Connect with Email
              </button>
            </div>
          ) : !connection ? (
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="border border-[#DDD9D3] rounded p-6 bg-white animate-pulse">
                  <div className="h-4 bg-[#EFECE7] rounded w-1/3 mb-3" />
                  <div className="h-6 bg-[#EFECE7] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {MOCK.map(s => {
                const remaining = blocksLeft(s.last, s.interval, s.current);
                const claimable = remaining === 0n;
                const progress  = Math.min(100, Math.round(
                  Number(s.current - s.last) / Number(s.interval) * 100
                ));

                return (
                  <div key={s.id} className="border border-[#DDD9D3] rounded bg-white hover:border-[#C44F6B]/40 transition">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#EFECE7]">
                      <div>
                        <div className="text-xs font-mono text-[#7C7570] mb-1">{s.creator}</div>
                        <div className="font-semibold text-sm">
                          {s.amountCKB} CKB / {s.intervalDays} day{s.intervalDays !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        claimable
                          ? "bg-[#F9ECF0] text-[#C44F6B] border-[#C44F6B]/20"
                          : "bg-[#EFECE7] text-[#7C7570] border-[#DDD9D3]"
                      }`}>
                        {claimable ? "Claimable" : "Active"}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="px-5 py-4 border-b border-[#EFECE7]">
                      <div className="flex justify-between text-xs text-[#7C7570] mb-2">
                        <span>Progress to next claim</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[#EFECE7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#C44F6B] rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 divide-x divide-[#EFECE7] border-b border-[#EFECE7]">
                      {[
                        ["Last claim",  `Block ${s.last.toLocaleString()}`],
                        ["Current",     s.current.toLocaleString()],
                        ["Next claim",  claimable ? "Now" : `${remaining.toLocaleString()} blocks`],
                      ].map(([l, v]) => (
                        <div key={l as string} className="px-5 py-3">
                          <div className="text-xs text-[#7C7570] mb-1">{l}</div>
                          <div className="text-xs font-mono font-medium">{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 p-4">
                      <button
                        disabled={!claimable}
                        className={`flex-1 py-2 rounded text-xs font-semibold transition ${
                          claimable
                            ? "bg-[#1C1814] hover:bg-[#C44F6B] text-white"
                            : "bg-[#EFECE7] text-[#7C7570] cursor-not-allowed"
                        }`}>
                        {claimable ? "Trigger Claim" : `${remaining.toLocaleString()} blocks left`}
                      </button>
                      <button className="px-4 py-2 rounded text-xs border border-[#DDD9D3] hover:border-red-300 hover:text-red-500 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-[#7C7570] text-center pt-2">
                Live cell queries via getSubscriptions() in W9
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
