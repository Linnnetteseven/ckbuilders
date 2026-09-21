"use client";
import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";

const PRESETS = [
  { label: "Daily",   blocks: "2000",  days: 1  },
  { label: "Weekly",  blocks: "14000", days: 7  },
  { label: "Monthly", blocks: "60000", days: 30 },
];

export default function CreatorPage() {
  const { authenticated, connection, login } = useKeyWay();
  const [amount,   setAmount]   = useState("5");
  const [interval, setInterval] = useState("2000");
  const [copied,   setCopied]   = useState(false);

  const days    = Math.round(Number(interval) / 2000);
  const address = connection?.wallet.ckbAddress ?? "connect-wallet";
  const link    = typeof window !== "undefined"
    ? `${window.location.origin}/subscribe/${address}`
    : "https://cadencepay.vercel.app/subscribe/...";

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block">
            ← Back
          </Link>

          <h1 className="display text-4xl font-bold mb-2">Set up your tier</h1>
          <p className="text-[#7C7570] text-sm mb-10 max-w-md">
            Configure your subscription terms. Each subscriber creates a Subscription
            Cell on CKB — you collect on-chain, no platform take.
          </p>

          <div className="space-y-7">
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-[#7C7570] mb-2">
                Amount per interval (CKB)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-white border border-[#DDD9D3] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C44F6B] transition"
              />
            </div>

            {/* Interval */}
            <div>
              <label className="block text-xs font-medium text-[#7C7570] mb-2">
                Interval — {days} day{days !== 1 ? "s" : ""} on CKB
              </label>
              <input
                type="number"
                value={interval}
                onChange={e => setInterval(e.target.value)}
                className="w-full bg-white border border-[#DDD9D3] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#C44F6B] transition mb-3"
              />
              <div className="flex gap-2">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => setInterval(p.blocks)}
                    className={`text-xs px-3 py-1.5 rounded border transition ${
                      interval === p.blocks
                        ? "border-[#C44F6B] text-[#C44F6B] bg-[#F9ECF0]"
                        : "border-[#DDD9D3] text-[#7C7570] hover:border-[#1C1814]"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white border border-[#DDD9D3] rounded divide-y divide-[#EFECE7]">
              {[
                ["Amount",      `${amount} CKB every ${days} day${days !== 1 ? "s" : ""}`],
                ["Interval",    `${Number(interval).toLocaleString()} blocks`],
                ["Enforcement", "On-chain type script"],
                ["Settlement",  "Fiber Network"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between items-center px-4 py-3">
                  <span className="text-xs text-[#7C7570]">{k}</span>
                  <span className={`text-xs font-medium ${k === "Enforcement" ? "text-[#2B6C50]" : ""}`}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* Share link */}
            {authenticated && connection && (
              <div>
                <label className="block text-xs font-medium text-[#7C7570] mb-2">
                  Share this link
                </label>
                <div className="flex border border-[#DDD9D3] rounded overflow-hidden">
                  <div className="flex-1 bg-white px-4 py-3 text-xs font-mono text-[#7C7570] truncate">
                    {link}
                  </div>
                  <button onClick={copy}
                    className="bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-4 text-xs font-medium shrink-0">
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            {/* CTA */}
            {!authenticated ? (
              <button onClick={login}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] transition text-white py-3.5 rounded font-semibold text-sm">
                Connect with Email
              </button>
            ) : !connection ? (
              <div className="w-full border border-[#DDD9D3] py-3.5 rounded text-center text-sm text-[#7C7570] animate-pulse">
                Recovering wallet…
              </div>
            ) : (
              <button className="w-full bg-[#1C1814] hover:bg-[#C44F6B] transition text-white py-3.5 rounded font-semibold text-sm">
                Deploy Subscription Tier
              </button>
            )}
            <p className="text-xs text-[#7C7570] text-center">Testnet · type script deploy in W9</p>
          </div>
        </div>
      </main>
    </>
  );
}
