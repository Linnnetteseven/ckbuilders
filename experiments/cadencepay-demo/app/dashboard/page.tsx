"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";
import { EXPLORER_TX } from "@/lib/cadencepay";

interface Subscription {
  outPoint:          { txHash: string; index: string };
  cellDataHex:       string;
  recipientLockHash: string;
  amountPerInterval: string;
  intervalBlocks:    string;
  lastClaimedBlock:  string;
  currentBlock:      string;
  canClaimNow:       boolean;
  blocksRemaining:   string;
}

export default function Dashboard() {
  const { authenticated, connection, login } = useKeyWay();
  const [subs,     setSubs]     = useState<Subscription[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});
  const [claimTx,  setClaimTx]  = useState<Record<string, string>>({});
  const [error,    setError]    = useState("");

  const fetchSubs = useCallback(async () => {
    
    setLoading(true);
    try {
      const res  = await fetch('/api/subscriptions');
      const data = await res.json() as { subscriptions: Subscription[]; error?: string };
      if (data.error) throw new Error(data.error);
      setSubs(data.subscriptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubs();
  }, [fetchSubs]);

  const handleClaim = async (sub: Subscription) => {
    
    const key = sub.outPoint.txHash;
    setClaiming(c => ({ ...c, [key]: true }));

    try {
      const res  = await fetch("/api/claim", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outPoint:         sub.outPoint,
          cellDataHex:      sub.cellDataHex,
          subscriberAddress: connection?.wallet.ckbAddress ?? '',
        }),
      });
      const data = await res.json() as { success: boolean; txHash?: string; error?: string };
      if (!data.success) throw new Error(data.error);
      setClaimTx(t => ({ ...t, [key]: data.txHash ?? "" }));
      // Refresh after 3 seconds
      setTimeout(() => void fetchSubs(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(c => ({ ...c, [key]: false }));
    }
  };

  const amountCKB = (shannons: string) =>
    (Number(shannons) / 1e8).toFixed(2);

  const intervalDays = (blocks: string) =>
    Math.round(Number(blocks) / 2000);

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block">
            ← Back
          </Link>

          <div className="flex items-baseline justify-between mb-6">
            <h1 className="display text-4xl font-bold">Dashboard</h1>
            {connection && (
              <span className="text-xs font-mono text-[#7C7570]">
                {connection?.wallet.ckbAddress.slice(0,10)}…{connection?.wallet.ckbAddress.slice(-4)}
              </span>
            )}
          </div>

          {/* Live type script badge */}
          <div className="border border-[#DDD9D3] bg-[#EFECE7] rounded px-4 py-3 flex items-center gap-3 mb-8 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2B6C50] shrink-0" />
            <span className="text-[#7C7570]">
              cadencepay type script ·{" "}
              <a href={EXPLORER_TX(process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH ?? "")}
                target="_blank" rel="noreferrer"
                className="font-mono text-[#C44F6B] hover:underline">
                0x44aff6…0307
              </a>
            </span>
            <button onClick={() => void fetchSubs()}
              className="ml-auto text-[#7C7570] hover:text-[#1C1814] transition">
              ↻ Refresh
            </button>
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 rounded px-4 py-3 mb-6 text-xs text-red-600">
              {error}
            </div>
          )}

          {!authenticated ? (
            <div className="border border-[#DDD9D3] rounded p-12 text-center bg-white">
              <p className="text-[#7C7570] text-sm mb-6">Connect to view your Subscription Cells</p>
              <button onClick={login}
                className="bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-6 py-2.5 rounded text-sm font-medium">
                Connect with Email
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="border border-[#DDD9D3] rounded p-6 bg-white animate-pulse">
                  <div className="h-4 bg-[#EFECE7] rounded w-1/3 mb-3" />
                  <div className="h-6 bg-[#EFECE7] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : subs.length === 0 ? (
            <div className="border border-[#DDD9D3] rounded p-12 text-center bg-white">
              <p className="text-[#7C7570] text-sm mb-6">No Subscription Cells found for this address.</p>
              <Link href="/subscribe"
                className="inline-block bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-6 py-2.5 rounded text-sm font-medium">
                Create a Subscription
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {subs.map(s => {
                const key       = s.outPoint.txHash;
                const progress  = Math.min(100, Math.round(
                  (Number(s.currentBlock) - Number(s.lastClaimedBlock)) /
                  Number(s.intervalBlocks) * 100
                ));

                return (
                  <div key={key} className="border border-[#DDD9D3] rounded bg-white hover:border-[#C44F6B]/40 transition">
                    <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#EFECE7]">
                      <div>
                        <div className="text-xs font-mono text-[#7C7570] mb-1">
                          {s.outPoint.txHash.slice(0,14)}…{s.outPoint.txHash.slice(-6)}
                          <a href={EXPLORER_TX(s.outPoint.txHash)} target="_blank" rel="noreferrer"
                            className="ml-2 text-[#C44F6B] hover:underline">↗</a>
                        </div>
                        <div className="font-semibold text-sm">
                          {amountCKB(s.amountPerInterval)} CKB / {intervalDays(s.intervalBlocks)} day
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        s.canClaimNow
                          ? "bg-[#F9ECF0] text-[#C44F6B] border-[#C44F6B]/20"
                          : "bg-[#EFECE7] text-[#7C7570] border-[#DDD9D3]"
                      }`}>
                        {s.canClaimNow ? "Claimable" : "Active"}
                      </span>
                    </div>

                    <div className="px-5 py-4 border-b border-[#EFECE7]">
                      <div className="flex justify-between text-xs text-[#7C7570] mb-2">
                        <span>Progress to next claim</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[#EFECE7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#C44F6B] rounded-full transition-all"
                          style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-[#EFECE7] border-b border-[#EFECE7]">
                      {[
                        ["Last claim",  `Block ${Number(s.lastClaimedBlock).toLocaleString()}`],
                        ["Current",     Number(s.currentBlock).toLocaleString()],
                        ["Next claim",  s.canClaimNow ? "Now" : `${Number(s.blocksRemaining).toLocaleString()} blocks`],
                      ].map(([l, v]) => (
                        <div key={l as string} className="px-5 py-3">
                          <div className="text-xs text-[#7C7570] mb-1">{l}</div>
                          <div className="text-xs font-mono font-medium">{v}</div>
                        </div>
                      ))}
                    </div>

                    {claimTx[key] && (
                      <div className="px-5 py-2 bg-[#F9ECF0] border-b border-[#EFECE7] text-xs text-[#C44F6B]">
                        ✓ Claimed ·{" "}
                        <a href={EXPLORER_TX(claimTx[key])} target="_blank" rel="noreferrer"
                          className="font-mono hover:underline">
                          {claimTx[key].slice(0,16)}…
                        </a>
                      </div>
                    )}

                    <div className="flex gap-2 p-4">
                      <button onClick={() => void handleClaim(s)}
                        disabled={!s.canClaimNow || claiming[key]}
                        className={`flex-1 py-2 rounded text-xs font-semibold transition ${
                          s.canClaimNow && !claiming[key]
                            ? "bg-[#1C1814] hover:bg-[#C44F6B] text-white"
                            : "bg-[#EFECE7] text-[#7C7570] cursor-not-allowed"
                        }`}>
                        {claiming[key] ? "Submitting claim…" :
                         s.canClaimNow ? "Trigger Claim" :
                         `${Number(s.blocksRemaining).toLocaleString()} blocks left`}
                      </button>
                      <button className="px-4 py-2 rounded text-xs border border-[#DDD9D3] hover:border-red-300 hover:text-red-500 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
