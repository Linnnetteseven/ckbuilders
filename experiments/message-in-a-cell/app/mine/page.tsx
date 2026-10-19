"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { useWallet } from "@/lib/useWallet";
import { Countdown } from "@/components/Countdown";
import { friendlyTxError } from "@/lib/txErrors";
import { buildCheckInTx, buildSpendTx, capsuleId, findMyCapsules, readPublicData, RECLAIM_GRACE_SECS, MEDIAN_TIME_LAG_SECS } from "@/lib/capsule";

type Row = Awaited<ReturnType<typeof findMyCapsules>>[number];
const nowSecs = () => BigInt(Math.floor(Number(new Date()) / 1000));

export default function Mine() {
  const { signer, client, lock, connect } = useWallet();
  const [rows, setRows] = useState<{ owner: string; rows: Row[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!lock) return;
    const owner = lock.hash();
    let cancelled = false;
    findMyCapsules(client, owner).then((r) => { if (!cancelled) setRows({ owner, rows: r }); }, () => { if (!cancelled) setRows({ owner, rows: [] }); });
    return () => { cancelled = true; };
  }, [client, lock, refresh]);

  const act = async (row: Row, kind: "checkin" | "withdraw" | "reclaim") => {
    if (!signer) return;
    const k = capsuleId(row.cell.outPoint);
    setBusy(k); setMsg("");
    try {
      const tx = kind === "checkin" ? await buildCheckInTx(row.cell, signer) : await buildSpendTx(row.cell, signer, "sender");
      const h = await signer.sendTransaction(tx);
      setMsg(kind === "checkin" ? `Checked in. The clock restarts from now. (${h.slice(0, 12)}…)` : `Done. The CKB is back in your wallet. (${h.slice(0, 12)}…)`);
      setTimeout(() => setRefresh((n) => n + 1), 8000);
    } catch (e) { setMsg(friendlyTxError(e)); } finally { setBusy(""); }
  };

  const list = rows && lock && rows.owner === lock.hash() ? rows.rows : null;
  const now = nowSecs() - MEDIAN_TIME_LAG_SECS;

  return (
    <main className="max-w-3xl mx-auto px-5 py-14 space-y-8">
      <Link href="/" className="slab text-lg">Message <span className="hand text-tomato text-2xl">in a</span> Cell</Link>
      <h1 className="slab text-5xl">My capsules</h1>
      {msg && <p role="status">{msg}</p>}
      {!signer ? (
        <button className="btn" onClick={() => void connect()}>Connect a wallet</button>
      ) : list === null ? (
        <p className="text-ink-2">Looking on the network…</p>
      ) : list.length === 0 ? (
        <p className="text-ink-2">No sealed capsules for this wallet yet. <Link className="underline" href="/seal">Seal one</Link>.</p>
      ) : (
        <ul className="space-y-4">
          {list.map((row) => {
            const d = readPublicData(row.cell.outputData);
            const k = capsuleId(row.cell.outPoint);
            const gift = row.terms.mode === "gift";
            const reclaimable = gift && now >= row.terms.t + RECLAIM_GRACE_SECS;
            return (
              <li key={k} className="card p-5 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-semibold">{d?.to ? `For ${d.to}` : "Capsule"}{d?.occasion ? ` · ${d.occasion}` : ""}</div>
                  <div className="text-sm tnum">{ccc.fixedPointToString(row.cell.cellOutput.capacity)} CKB</div>
                </div>
                <p className="text-sm text-ink-2">
                  {row.role === "sender" ? "You sealed this. " : "Sealed for you. "}
                  {gift ? `Opens ${new Date(Number(row.terms.t) * 1000).toLocaleString()}.` : `Opens for them after ${Math.round(Number(row.terms.t) / 86400) || 1} day(s) without a check-in.`}
                </p>
                {gift && <Countdown to={Number(row.terms.t)} size="sm" />}
                <div className="flex flex-wrap gap-2 pt-1">
                  {row.role === "recipient" && <Link className="btn btn-ghost" href={`/c/${k}`}>View</Link>}
                  {row.role === "sender" && !gift && <>
                    <button className="btn" disabled={!!busy} onClick={() => void act(row, "checkin")}>{busy === k ? "Confirm in your wallet…" : "I'm still here"}</button>
                    <button className="btn btn-ghost" disabled={!!busy} onClick={() => void act(row, "withdraw")}>Take it back</button>
                  </>}
                  {row.role === "sender" && gift && reclaimable && <button className="btn btn-ghost" disabled={!!busy} onClick={() => void act(row, "reclaim")}>Take back (unopened)</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-2">Sender links include the message key, so they aren&apos;t stored here. Keep the links you shared.</p>
    </main>
  );
}
