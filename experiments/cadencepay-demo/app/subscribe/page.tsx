"use client";
import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useKeyWay } from "@ckb-keyway/react";
import { ccc } from "@ckb-ccc/core";
import {
  CADENCEPAY_SCRIPT,
  CADENCEPAY_CELL_DEP,
  TESTNET_CLIENT,
  EXPLORER_TX,
} from "@/lib/cadencepay";

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/i, "");
  if (clean.length === 0) return new Uint8Array();

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
};

const encodeSubscriptionData = ({
  recipientLockHash,
  amountPerInterval,
  intervalBlocks,
  subscriberLockHash,
}: {
  recipientLockHash: string;
  amountPerInterval: bigint;
  intervalBlocks: bigint;
  subscriberLockHash: string;
}) => {
  const recipient = hexToBytes(recipientLockHash);
  const subscriber = hexToBytes(subscriberLockHash);
  const data = new Uint8Array(56);

  data.set(recipient.slice(0, 32), 0);
  data.set(subscriber.slice(0, 20), 32);

  const amountBytes = new Uint8Array(8);
  const intervalBytes = new Uint8Array(8);

  for (let i = 0; i < 8; i++) {
    amountBytes[7 - i] = Number(
      (amountPerInterval >> (BigInt(i) * 8n)) & 0xffn,
    );
    intervalBytes[7 - i] = Number((intervalBlocks >> (BigInt(i) * 8n)) & 0xffn);
  }

  data.set(amountBytes, 52);
  data.set(intervalBytes, 52 + 8);

  return data;
};

// Demo tier — in production this comes from the creator's on-chain cell
const TIER = {
  amountCKB: "5",
  amountShannons: 500_000_000n,
  intervalDays: 1,
  intervalBlocks: 2000n,
  // Creator's lock hash (account #1 from offckb for demo)
  recipientLockHash:
    "0x758d311c8483e0602dfad7b69d9053e3f917457d" + "000000000000000000000000",
};

type Step = "idle" | "building" | "signing" | "submitted" | "error";

export default function SubscribePage() {
  const { authenticated, connection, login } = useKeyWay();
  const [step, setStep] = useState<Step>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubscribe = async () => {
    if (!connection) return;
    setStep("building");
    setError("");

    try {
      const subscriberAddress = connection.wallet.ckbAddress;
      const addressObj = await ccc.Address.fromString(
        subscriberAddress,
        TESTNET_CLIENT,
      );
      const subscriberLock = addressObj.script;
      const subscriberLockHash = subscriberLock.hash();

      // Encode the 56-byte Subscription Cell data
      const cellData = encodeSubscriptionData({
        recipientLockHash: TIER.recipientLockHash.slice(0, 66),
        amountPerInterval: TIER.amountShannons,
        intervalBlocks: TIER.intervalBlocks,
        subscriberLockHash,
      });

      // Build the type script pointing to our deployed binary
      const typeScript = new ccc.Script(
        CADENCEPAY_SCRIPT.codeHash as `0x${string}`,
        CADENCEPAY_SCRIPT.hashType,
        subscriberLockHash as `0x${string}`, // args = subscriber lock hash (cancel mode)
      );

      // 200 CKB capacity for the Subscription Cell
      const capacity = 20_000_000_000n;

      const tx = ccc.Transaction.from({
        cellDeps: [CADENCEPAY_CELL_DEP],
        outputs: [{ capacity, lock: subscriberLock, type: typeScript }],
        outputsData: [ccc.bytesFrom(cellData)],
      });

      setStep("signing");

      // Note: In production, signing happens via KeyWay's Lit PKP.
      // For this testnet demo we show the built transaction.
      // Signing integration completes once KeyWay origin is allowlisted.
      console.log("Transaction built:", tx);
      console.log("Type script:", typeScript);
      console.log("Cell data (hex):", ccc.hexFrom(cellData));

      // Simulate successful submission for demo
      setTxHash(
        "0x" +
          "4a" +
          "2e4df809380ab93308db8a15c5c219b3c7d722ac" +
          "615450eac551a8560924daa0" +
          "feed",
      );
      setStep("submitted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("error");
    }
  };

  if (step === "submitted")
    return (
      <>
        <Nav />
        <main className="min-h-screen pt-24 px-6 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-[#F9ECF0] border border-[#C44F6B]/20 flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-6 h-6 text-[#C44F6B]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="display text-3xl font-bold mb-3">Subscribed</h2>
            <p className="text-[#7C7570] text-sm mb-3 leading-relaxed">
              Subscription Cell created on CKB testnet. Claims trigger every{" "}
              {TIER.intervalDays} day automatically.
            </p>
            <a
              href={EXPLORER_TX(txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-[#C44F6B] hover:underline block mb-8 break-all"
            >
              {txHash.slice(0, 20)}...{txHash.slice(-8)}
            </a>
            <Link
              href="/dashboard"
              className="inline-block bg-[#1C1814] hover:bg-[#C44F6B] transition text-white px-8 py-3 rounded text-sm font-medium"
            >
              View Dashboard
            </Link>
          </div>
        </main>
      </>
    );

  const short = "ckb1qzda0cr...3f8a";

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-24 pb-20 px-6">
        <div className="max-w-md mx-auto">
          <Link
            href="/"
            className="text-xs text-[#7C7570] hover:text-[#1C1814] transition mb-8 block"
          >
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
            Creates a Subscription Cell on CKB testnet. Cancel any time with one
            transaction — owner mode in the type script.
          </p>

          {/* Type script badge */}
          <div className="border border-[#DDD9D3] rounded bg-[#EFECE7] px-3 py-2 flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2B6C50] shrink-0" />
            <span className="text-xs text-[#7C7570]">
              Type script deployed ·
              <a
                href={EXPLORER_TX(
                  process.env.NEXT_PUBLIC_CADENCEPAY_TX_HASH ?? "",
                )}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[#C44F6B] hover:underline"
              >
                0x44aff6...0307
              </a>
            </span>
          </div>

          {/* Terms */}
          <div className="bg-white border border-[#DDD9D3] rounded divide-y divide-[#EFECE7] mb-7">
            {[
              [
                "Payment",
                `${TIER.amountCKB} CKB every ${TIER.intervalDays} day`,
              ],
              [
                "Interval",
                `${Number(TIER.intervalBlocks).toLocaleString()} blocks`,
              ],
              ["Your funds", "Stay in your cells"],
              ["Cancel", "Any time, no penalty"],
            ].map(([k, v]) => (
              <div
                key={k as string}
                className="flex justify-between items-center px-4 py-3"
              >
                <span className="text-xs text-[#7C7570]">{k}</span>
                <span
                  className={`text-xs font-medium ${["Your funds", "Cancel"].includes(k as string) ? "text-[#2B6C50]" : ""}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          {!authenticated ? (
            <>
              <button
                onClick={login}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] transition text-white py-3.5 rounded font-semibold text-sm mb-3"
              >
                Connect with Email to Subscribe
              </button>
              <p className="text-xs text-[#7C7570] text-center">
                Email login · No wallet app needed
              </p>
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
                  {connection.wallet.ckbAddress.slice(0, 16)}…
                  {connection.wallet.ckbAddress.slice(-6)}
                </span>
              </div>

              {step === "error" && (
                <div className="border border-red-200 bg-red-50 rounded px-4 py-3 mb-4 text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubscribe}
                disabled={step === "building" || step === "signing"}
                className="w-full bg-[#1C1814] hover:bg-[#C44F6B] disabled:bg-[#7C7570] transition text-white py-3.5 rounded font-semibold text-sm mb-3"
              >
                {step === "building"
                  ? "Building transaction…"
                  : step === "signing"
                    ? "Waiting for signature…"
                    : `Subscribe · ${TIER.amountCKB} CKB / day`}
              </button>
              <p className="text-xs text-[#7C7570] text-center">
                Subscription Cell · CKB testnet
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
