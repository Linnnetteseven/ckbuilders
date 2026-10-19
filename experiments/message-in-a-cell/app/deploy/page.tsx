"use client";
import { useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/core";
import { useWallet } from "@/lib/useWallet";
import { CAPSULE_LOCK } from "@/lib/capsule";
import { friendlyTxError } from "@/lib/txErrors";

/**
 * Local-only page: deploy capsule-lock to testnet, signed by your own wallet
 * (JoyID). Refuses unless the built binary hashes to the code hash the app
 * expects, so a stale build can't be deployed.
 */
export default function Deploy() {
  const { signer, address, connect } = useWallet();
  const [bin, setBin] = useState<{ hex: ccc.Hex; hash: ccc.Hex } | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    fetch("/api/dev/binary").then((r) => r.json()).then((d: { hex?: ccc.Hex }) => {
      if (d.hex) setBin({ hex: d.hex, hash: ccc.hashCkb(d.hex) });
      else setStatus("This page only works with npm run dev.");
    }, () => setStatus("Couldn't load the binary. Build it first (make build in time-lock-script)."));
  }, []);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    signer.getBalance().then((b) => { if (!cancelled) setBalance(b); }, () => {});
    return () => { cancelled = true; };
  }, [signer]);

  const size = bin ? ccc.bytesFrom(bin.hex).length : 0;
  const needed = BigInt(size + 61) * 100_000_000n;
  const hashOk = bin?.hash === CAPSULE_LOCK.codeHash;

  const deploy = async () => {
    if (!signer || !bin || !hashOk) return;
    setStatus("Building the transaction…");
    try {
      const { script } = await signer.getRecommendedAddressObj();
      const tx = ccc.Transaction.from({ outputs: [{ capacity: needed, lock: script }], outputsData: [bin.hex] });
      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000n);
      setStatus("Confirm in your wallet…");
      setTxHash(await signer.sendTransaction(tx));
      setStatus("Deployed. Copy the transaction hash below.");
    } catch (e) {
      setStatus(friendlyTxError(e));
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-5 py-16 space-y-6">
      <h1 className="text-4xl font-semibold">Deploy capsule-lock</h1>
      <dl className="space-y-2 font-mono text-sm break-all">
        <div><dt className="text-ink-2">Binary</dt><dd>{bin ? `${size.toLocaleString()} bytes` : "loading…"}</dd></div>
        <div><dt className="text-ink-2">Code hash</dt><dd>{bin?.hash ?? "…"} {bin && (hashOk ? "✓ matches" : "✗ does NOT match the app")}</dd></div>
        <div><dt className="text-ink-2">Needs</dt><dd>{ccc.fixedPointToString(needed)} CKB (stays in your wallet as the code cell) + a tiny fee</dd></div>
        {address && <div><dt className="text-ink-2">Your wallet</dt><dd>{address}<br />Balance: {balance === null ? "…" : `${ccc.fixedPointToString(balance)} CKB`}</dd></div>}
      </dl>
      {!signer ? (
        <button className="btn" onClick={() => void connect()}>Connect JoyID</button>
      ) : (
        <button className="btn" disabled={!hashOk || (balance !== null && balance < needed)} onClick={() => void deploy()}>Deploy to testnet</button>
      )}
      {balance !== null && balance < needed && <p>Not enough CKB yet. Top up from faucet.nervos.org (you can claim more than once), then refresh.</p>}
      {status && <p>{status}</p>}
      {txHash && <p className="font-mono text-sm break-all bg-paper-2 rounded-xl p-4 border border-line">{txHash}</p>}
    </main>
  );
}
