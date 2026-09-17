"use client";
import { useState } from "react";
import Link from "next/link";

export default function CreatorPage() {
  const [amount, setAmount]       = useState("5");
  const [interval, setInterval]   = useState("2000");
  const [copied, setCopied]       = useState(false);

  const intervalDays = Math.round(Number(interval) / 2000);
  const mockAddress  = "ckb1qzda0cr08m85hc8jlnfp3sdrpk7z00fakefake";
  const subscribeLink = typeof window !== "undefined"
    ? `${window.location.origin}/subscribe/${mockAddress}`
    : `https://cadencepay.vercel.app/subscribe/${mockAddress}`;

  const copy = () => {
    navigator.clipboard.writeText(subscribeLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-24">
        <Link href="/" className="text-neutral-500 text-sm mb-8 block hover:text-white">← Back</Link>
        <h1 className="text-3xl font-bold mb-2">Set up your subscription</h1>
        <p className="text-neutral-400 mb-10">Share your link. Subscribers pay you on-chain every interval.</p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Amount per interval (CKB)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white" />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-2">
              Interval (blocks) — ~{intervalDays} day{intervalDays !== 1 ? "s" : ""} on CKB
            </label>
            <input type="number" value={interval} onChange={e => setInterval(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 px-4 py-3 text-white focus:outline-none focus:border-white" />
            <div className="mt-2 flex gap-2">
              {[["Daily","2000"],["Weekly","14000"],["Monthly","60000"]].map(([l,v]) => (
                <button key={v} onClick={() => setInterval(v)}
                  className="text-xs border border-neutral-700 px-3 py-1 hover:border-white transition">{l}</button>
              ))}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-6">
            <div className="text-sm text-neutral-400 mb-4">Subscription terms</div>
            <div className="space-y-2 font-mono text-sm">
              {[
                ["Amount", `${amount} CKB / ${intervalDays} day${intervalDays !== 1 ? "s" : ""}`],
                ["Interval", `${Number(interval).toLocaleString()} blocks`],
                ["Enforcement", "On-chain type script"],
                ["Settlement", "Fiber Network"],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-neutral-500">{k}</span>
                  <span className={k === "Enforcement" ? "text-green-400" : ""}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-2">Your subscribe link</div>
            <div className="flex">
              <div className="flex-1 bg-neutral-900 border border-neutral-700 px-4 py-3 text-xs font-mono text-neutral-400 truncate">
                {subscribeLink}
              </div>
              <button onClick={copy}
                className="bg-white text-black px-5 font-semibold text-sm hover:bg-neutral-200 transition">
                {copied ? "✓" : "Copy"}
              </button>
            </div>
          </div>

          <button className="w-full bg-white text-black py-4 font-semibold hover:bg-neutral-200 transition">
            Connect Wallet to Deploy
          </button>
        </div>
      </div>
    </main>
  );
}
