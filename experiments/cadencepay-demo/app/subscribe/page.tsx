"use client";
import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";
import { EXPLORER_TX } from "@/lib/cadencepay";

const CREATOR_ADDRESS =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew";

const TIER = {
  amountCKB:      "5",
  amountShannons: "500000000",
  intervalDays:   1,
  intervalBlocks: "2000",
};

type Step = "idle" | "building" | "submitted" | "error";

export default function SubscribePage() {
  const { authenticated, connection, login } = useKeyWay();
  const [step,   setStep]   = useState<Step>("idle");
  const [txHash, setTxHash] = useState("");
  const [error,  setError]  = useState("");

  const handleSubscribe = async () => {
    if (!connection) return;
    setStep("building");
    setError("");

    try {
      const res = await fetch("/api/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriberAddress: connection.wallet.ckbAddress,
          creatorAddress:    CREATOR_ADDRESS,
          amountShannons:    TIER.amountShannons,
          intervalBlocks:    TIER.intervalBlocks,
        }),
      });

      const data = await res.json() as { success: boolean; txHash?: string; error?: string };

      if (!data.success) throw new Error(data.error ?? "Unknown error");

      setTxHash(data.txHash ?? "");
      setStep("submitted");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("error");
    }
  };

  if (step === "submitted") return (
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
          <p className="text-[#7C7570] text-sm mb-3 leading-relaxed">
            Subscription Cell is live on CKB testnet.
            Claims trigger every {TIER.intervalDays} day automatically.
          </p>
          <a href={EXPLORER_TX(txHash)} target="_blank" rel="noreferrer"
            className="text-xs font-mono text-[#C44F6B] hover:underline block mb-8 break-all">
            {txHash.slice(0, 24)}…{txHash.slice(-8)} →
          </a>
          <Link href="/dashboard"
            className="inline-block bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-8 py-3 rounded text-sm font-medium">
            View Dashboard
          </Link>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-md mx-auto">
          <Link href="/" className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block">
            ← Back
          </Link>

          <div className="flex items-center gap-3 mb-8 pb-8 border-b border-[#DDD9D3]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C44F6B] to-[#8B3A53] flex items-center justify-center text-white text-sm font-bold">C</div>
            <div>
              <div className="font-semibold text-sm">Demo Creator</div>
              <div className="text-xs font-mono text-[#7C7570]">{CREATOR_ADDRESS.slice(0,14)}…{CREATOR_ADDRESS.slice(-6)}</div>
            </div>
          </div>

          <h1 className="display text-4xl font-bold mb-2">Subscribe</h1>
          <p className="text-[#7C7570] text-sm mb-8">
            Creates a real Subscription Cell on CKB testnet. Cancel any time with one transaction.
          </p>

          <div className="border border-[#DDD9D3] rounded bg-[#EFECE7] px-3 py-2 flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2B6C50] shrink-0" />
            <span className="text-xs text-[#7C7570]">
              Type script live ·{" "}
              <a href={EXPLORER_TX(process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH ?? "")}
                target="_blank" rel="noreferrer"
                className="font-mono text-[#C44F6B] hover:underline">
                0x44aff6…0307
              </a>
            </span>
          </div>

          <div className="bg-white border border-[#DDD9D3] rounded divide-y divide-[#EFECE7] mb-7">
            {[
              ["Payment",    `${TIER.amountCKB} CKB every ${TIER.intervalDays} day`],
              ["Interval",   "2,000 blocks"],
              ["Your funds", "Stay in your cells"],
              ["Cancel",     "Any time, no penalty"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between items-center px-4 py-3">
                <span className="text-xs text-[#7C7570]">{k}</span>
                <span className={`text-xs font-medium ${["Your funds","Cancel"].includes(k as string) ? "text-[#2B6C50]" : ""}`}>{v}</span>
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
            <div className="w-full border border-[#DDD9D3] py-3.5 rounded text-center text-sm text-[#7C7570] animate-pulse">Recovering wallet…</div>
          ) : (
            <>
              <div className="border border-[#DDD9D3] bg-white rounded px-4 py-2.5 flex items-center gap-3 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2B6C50] shrink-0" />
                <span className="text-xs font-mono text-[#7C7570] truncate">
                  {connection.wallet.ckbAddress.slice(0,16)}…{connection.wallet.ckbAddress.slice(-6)}
                </span>
              </div>

              {step === "error" && (
                <div className="border border-red-200 bg-red-50 rounded px-4 py-3 mb-4 text-xs text-red-600">{error}</div>
              )}

              <button onClick={handleSubscribe} disabled={step === "building"}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] disabled:bg-[#7C7570] transition text-white py-3.5 rounded font-semibold text-sm mb-3">
                {step === "building" ? "Creating Subscription Cell…" : `Subscribe · ${TIER.amountCKB} CKB / day`}
              </button>
              <p className="text-xs text-[#7C7570] text-center">Real transaction · CKB testnet</p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
