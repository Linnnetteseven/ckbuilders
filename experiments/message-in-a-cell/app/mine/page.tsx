"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { useWallet } from "@/lib/useWallet";
import { Countdown } from "@/components/Countdown";
import { CapsuleArt } from "@/components/CapsuleArt";
import { AppFooter, AppNav, PageTitle } from "@/components/Shell";
import { friendlyTxError } from "@/lib/txErrors";
import { buildCheckInTx, buildSpendTx, capsuleId, chainMedianSecs, findMyCapsules, readPublicData, RECLAIM_GRACE_SECS } from "@/lib/capsule";

type Row = Awaited<ReturnType<typeof findMyCapsules>>[number];
const nowSecs = () => BigInt(Math.floor(Number(new Date()) / 1000));

export default function Mine() {
  const { signer, client, lock, connect } = useWallet();
  const [rows, setRows] = useState<{ owner: string; rows: Row[] } | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [chainNow, setChainNow] = useState<bigint | null>(null);
  useEffect(() => {
    let alive = true;
    chainMedianSecs(client).then((t) => { if (alive) setChainNow(t); }, () => {});
    return () => { alive = false; };
  }, [client, refresh]);

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
  // The chain's own clock decides when gifts are due; wall time until it answers
  const now = chainNow ?? nowSecs();
  const sent = list?.filter((r) => r.role === "sender") ?? [];
  const received = list?.filter((r) => r.role === "recipient") ?? [];

  const card = (row: Row) => {
    const d = readPublicData(row.cell.outputData);
    const k = capsuleId(row.cell.outPoint);
    const gift = row.terms.mode === "gift";
    const due = gift && now >= row.terms.t;
    const reclaimable = gift && now >= row.terms.t + RECLAIM_GRACE_SECS;
    return (
      <li key={k} className="card stamp relative p-4 sm:p-5 grid sm:grid-cols-[9rem_1fr] gap-4 items-start">
        <CapsuleArt variant={gift ? (due ? "ready" : "buried") : "sealed"} className="relative z-10 w-full rounded-lg" />
        <div className="relative z-10 space-y-2 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="slab text-xl">{d?.to ? `For ${d.to}` : "A capsule"}</p>
            <span className="badge text-sm tnum">{ccc.fixedPointToString(row.cell.cellOutput.capacity)} CKB</span>
          </div>
          {d?.occasion && <p className="hand text-xl text-tomato -rotate-1">{d.occasion}</p>}
          {gift ? (
            due ? <p className="text-sm"><strong>Ready to open.</strong> {row.role === "sender" ? "Waiting for them to open it." : "Open it from your link."}</p>
                : <Countdown to={Number(row.terms.t)} size="sm" label="Opens in" />
          ) : (
            <p className="text-sm text-ink-2">Opens for them after {Number(row.terms.t) >= 86400 ? `${Math.round(Number(row.terms.t) / 86400)} days` : `${Math.round(Number(row.terms.t) / 60)} minutes`} without a check-in.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {row.role === "recipient" && <Link className="btn btn-ghost !text-sm" href={`/c/${k}`}>View</Link>}
            {row.role === "sender" && !gift && <>
              <button className="btn !text-sm" disabled={!!busy} onClick={() => void act(row, "checkin")}>{busy === k ? "Confirm in your wallet…" : "I'm still here"}</button>
              <button className="btn btn-ghost !text-sm" disabled={!!busy} onClick={() => void act(row, "withdraw")}>Take it back</button>
            </>}
            {row.role === "sender" && gift && reclaimable && <button className="btn btn-ghost !text-sm" disabled={!!busy} onClick={() => void act(row, "reclaim")}>Take back (never opened)</button>}
          </div>
          {row.role === "sender" && !gift && <p className="text-xs text-ink-2">&ldquo;I&apos;m still here&rdquo; restarts the clock. &ldquo;Take it back&rdquo; returns everything to your wallet and ends the capsule.</p>}
          {row.role === "sender" && gift && !reclaimable && <p className="text-xs text-ink-2">If it&apos;s never opened, you can take it back from {new Date(Number(row.terms.t + RECLAIM_GRACE_SECS) * 1000).toLocaleDateString()}.</p>}
        </div>
      </li>
    );
  };

  return (
    <>
      <AppNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 space-y-10">
        <PageTitle kicker="everything you've sealed" title="My capsules">
          Capsules you sealed, and capsules sealed for this wallet. Opened ones leave this list; their links still show the message.
        </PageTitle>

        <ul className="grid sm:grid-cols-2 gap-3 text-sm">
          <li className="card relative p-4"><p className="slab text-lg">Gifts</p><p className="text-ink-2 mt-1">Open on their date. Nothing for you to do; after 90 days unopened, you can take one back.</p></li>
          <li className="card relative p-4"><p className="slab text-lg">If I&apos;m gone</p><p className="text-ink-2 mt-1">Tap &ldquo;I&apos;m still here&rdquo; now and then. If you stop, it opens for the person you chose.</p></li>
        </ul>

        {msg && <p role="status" className="card relative p-4">{msg}</p>}

        {!signer ? (
          <div className="card relative p-8 text-center space-y-4">
            <CapsuleArt variant="sealed" className="w-56 mx-auto rounded-xl" />
            <p className="slab text-2xl">Connect your wallet to see your capsules</p>
            <button className="btn" onClick={() => void connect()}>Connect a wallet</button>
          </div>
        ) : list === null ? (
          <p className="hand text-2xl text-tomato">looking on the network…</p>
        ) : list.length === 0 ? (
          <div className="card relative p-8 text-center space-y-4">
            <CapsuleArt variant="open" className="w-56 mx-auto rounded-xl" />
            <p className="slab text-2xl">Nothing sealed yet</p>
            <p className="text-ink-2">Capsules you seal, or that are sealed to this wallet, show up here.</p>
            <Link href="/seal" className="btn">Seal your first message</Link>
          </div>
        ) : (
          <>
            {sent.length > 0 && <section className="space-y-3"><h2 className="slab text-2xl">Sealed by you</h2><ul className="space-y-4">{sent.map(card)}</ul></section>}
            {received.length > 0 && <section className="space-y-3"><h2 className="slab text-2xl">Sealed for you</h2><ul className="space-y-4">{received.map(card)}</ul></section>}
          </>
        )}
        <p className="text-xs text-ink-2">Links include the message key, so they aren&apos;t stored here. Keep the links you shared.</p>
      </main>
      <AppFooter />
    </>
  );
}
