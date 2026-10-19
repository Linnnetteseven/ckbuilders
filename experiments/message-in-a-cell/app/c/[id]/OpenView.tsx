"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ccc } from "@ckb-ccc/core";
import { useWallet } from "@/lib/useWallet";
import { friendlyTxError } from "@/lib/txErrors";
import {
  buildOpenWithGiftKeyTx, buildSpendTx, giftLockHash, loadCapsule, openCapsuleData, secretsFromFragment,
  RECLAIM_GRACE_SECS, type CapsuleView, type LinkSecrets, type SeedOnly,
} from "@/lib/capsule";
import { deriveFromPhrase } from "@/lib/secretWord";
import { Countdown } from "@/components/Countdown";
import { playableRecording } from "@/lib/media";

type Loaded = { view: CapsuleView; cell: ccc.Cell; rawData: ccc.Hex };
type Revealed = { letter: string; photoUrl?: string; recordings: { kind: number; url: string }[] };


export function OpenView({ id }: { id: string }) {
  const { signer, client, lock, address, connect } = useWallet();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [link, setLink] = useState<LinkSecrets | SeedOnly | undefined>();
  const [fromWord, setFromWord] = useState<LinkSecrets | undefined>();
  const [word, setWord] = useState("");
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [openedTx, setOpenedTx] = useState("");
  const [payTo, setPayTo] = useState("");
  const [refresh, setRefresh] = useState(0);

  // The keys live only in the #fragment, which browsers never send to a server
  useEffect(() => {
    const read = () => setLink(secretsFromFragment(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const needsWord = !!link && "needsWord" in link;
  const secrets: LinkSecrets | undefined = link && !("needsWord" in link) ? link : fromWord;

  useEffect(() => {
    let cancelled = false;
    loadCapsule(client, id).then((l) => { if (!cancelled) setLoaded(l ?? null); }, () => { if (!cancelled) setLoaded(null); });
    return () => { cancelled = true; };
  }, [client, id, refresh]);

  const reveal = async (l: Loaded) => {
    if (!secrets) return;
    try {
      const opened = await openCapsuleData(secrets.key, l.rawData);
      const photoUrl = opened.photo.length ? URL.createObjectURL(new Blob([opened.photo as BlobPart], { type: "image/webp" })) : undefined;
      const recordings = await Promise.all(opened.media.map(async (m) => ({ kind: Number(m.kind), url: await playableRecording({ kind: Number(m.kind), sha256: ccc.hexFrom(m.sha256), url: m.url, bytes: Number(m.bytes) }, secrets.key) })));
      setRevealed({ letter: opened.letter, photoUrl, recordings });
    } catch (e) {
      setError(e instanceof Error && /changed after sealing/.test(e.message) ? e.message : "This link's key doesn't open this message.");
    }
  };

  // Already opened earlier: show the keepsake straight away
  useEffect(() => {
    if (loaded && loaded.view.state === "opened" && secrets && !revealed) {
      const t = setTimeout(() => void reveal(loaded), 0);
      return () => clearTimeout(t);
    }
  });

  if (loaded === undefined) return <main className="max-w-xl mx-auto px-5 py-24 text-center text-ink-2">Finding your capsule…</main>;
  if (loaded === null) {
    return (
      <main className="max-w-xl mx-auto px-5 py-24 text-center space-y-4">
        <h1 className="slab text-4xl">We couldn&apos;t find this capsule</h1>
        <p className="text-ink-2">If it was sealed a moment ago, give the network a minute and refresh.</p>
        <Link href="/" className="btn">Message in a Cell</Link>
      </main>
    );
  }

  const { view } = loaded;
  const d = view.data;
  const isGift = view.terms.mode === "gift";
  const opensAt = isGift ? Number(view.terms.t) : 0;
  const myHash = lock?.hash();
  const iAmRecipient = myHash === view.terms.recipientLockHash;
  const iAmSender = myHash === view.terms.senderLockHash;
  const thumbUrl = d && d.thumb.length > 2 ? `data:image/webp;base64,${btoa(String.fromCharCode(...ccc.bytesFrom(d.thumb)))}` : undefined;

  // The secret word is checked against the capsule's lock before anything is sent
  const checkWord = async () => {
    if (!link || !("needsWord" in link)) return;
    setChecking(true); setError("");
    try {
      const derived = await deriveFromPhrase(link.seed, word);
      if ((await giftLockHash(client, derived.giftKey)) !== view.terms.recipientLockHash) throw new Error("wrong");
      setFromWord(derived);
    } catch {
      setError("Those words don't match this capsule. Check the spelling with whoever sent it.");
    } finally { setChecking(false); }
  };

  const wordPrompt = needsWord && !fromWord && (
    <form className="card relative p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void checkWord(); }}>
      <p className="slab text-xl">What&apos;s the secret word?</p>
      <p className="text-sm text-ink-2">{d?.from ? `${d.from} should have told you` : "The sender should have told you"} four words, separately from the link.</p>
      <input className="w-full rounded-2xl border border-line bg-paper px-4 py-3 font-mono" value={word} onChange={(e) => setWord(e.target.value)}
        autoCapitalize="none" autoComplete="off" spellCheck={false} aria-label="Secret word" placeholder="four words" />
      <button className="btn" disabled={checking || word.trim().split(/\s+/).length < 2}>{checking ? "Checking…" : "Unlock"}</button>
    </form>
  );

  const open = async () => {
    setError(""); setBusy("Opening…");
    try {
      let txHash: string;
      if (secrets?.giftKey) {
        // Link capsule: the gift key opens it; the CKB goes to the address they choose
        let toLock = lock;
        if (payTo.trim()) toLock = (await ccc.Address.fromString(payTo.trim(), client)).script;
        if (!toLock) throw new Error("Connect a wallet (or paste a CKB address) to receive the CKB");
        const { tx, giftSigner } = await buildOpenWithGiftKeyTx(client, loaded.cell, secrets.giftKey, toLock);
        txHash = await giftSigner.sendTransaction(tx);
      } else {
        if (!signer) throw new Error("Connect the wallet this was sent to");
        setBusy("Confirm in your wallet…");
        txHash = await signer.sendTransaction(await buildSpendTx(loaded.cell, signer, "recipient"));
      }
      setOpenedTx(txHash);
      setBusy("");
      await reveal(loaded);
      setTimeout(() => setRefresh((n) => n + 1), 8000);
    } catch (e) {
      setBusy("");
      setError(friendlyTxError(e));
    }
  };

  const reclaim = async () => {
    if (!signer) return;
    setError(""); setBusy("Confirm in your wallet…");
    try {
      setOpenedTx(await signer.sendTransaction(await buildSpendTx(loaded.cell, signer, "sender")));
      setBusy("");
      setTimeout(() => setRefresh((n) => n + 1), 8000);
    } catch (e) { setBusy(""); setError(friendlyTxError(e)); }
  };

  const ckb = ccc.fixedPointToString(view.capacity);

  return (
    <main className="max-w-2xl mx-auto px-5 py-14 space-y-8">
      <Link href="/" className="slab text-lg">Message <span className="hand text-tomato text-2xl">in a</span> Cell</Link>
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-[0.16em] uppercase text-ink-2">{d?.occasion || (isGift ? "A sealed message" : "A message for later")}</p>
        <h1 className="slab text-5xl leading-tight">{d?.to ? `For ${d.to}` : "A message for you"}{d?.from ? <span className="block text-3xl text-ink-2">from {d.from}</span> : null}</h1>
        <p className="tnum">With <strong>{ckb} CKB</strong> inside.</p>
      </header>

      {revealed ? (
        <section className="space-y-5 card p-6">
          {revealed.photoUrl && <img src={revealed.photoUrl} alt={`Photo from ${d?.from ?? "the sender"}`} className="w-full rounded-2xl" />}
          {revealed.recordings.map((r, i) => r.kind === 2
            ? <audio key={i} src={r.url} controls className="w-full" />
            : <video key={i} src={r.url} controls playsInline className="w-full rounded-2xl bg-black" />)}
          {revealed.letter && <p className="font-serif text-2xl leading-relaxed whitespace-pre-wrap">{revealed.letter}</p>}
          {openedTx && <p className="text-sm text-ink-2">The {ckb} CKB is on its way to your wallet. <a className="underline" href={`https://testnet.explorer.nervos.org/transaction/${openedTx}`} target="_blank" rel="noreferrer">Receipt</a></p>}
        </section>
      ) : (
        <section className="space-y-5">
          {thumbUrl && <img src={thumbUrl} alt="" className="w-48 h-48 rounded-3xl object-cover blur-[2px]" />}
          {view.state === "opened" ? (
            <div className="space-y-3">
              <p>This capsule has been opened.{secrets || needsWord ? "" : " Use the original link to read it again."}</p>
              {wordPrompt}
            </div>
          ) : view.state === "sealed" ? (
            isGift
              ? <div className="space-y-2"><Countdown to={opensAt} label="Opens in" /><p className="text-ink-2">{new Date(opensAt * 1000).toLocaleString()}</p></div>
              : <p className="text-lg">This opens only if its owner stops checking in for {Math.round(Number(view.terms.t) / 86400) || `${Number(view.terms.t) / 60} minutes`}{Number(view.terms.t) >= 86400 ? " days" : ""}. Keep this link safe.</p>
          ) : (
            <div className="space-y-3">
              <p className="slab text-3xl">It&apos;s time.</p>
              {wordPrompt ? wordPrompt : secrets?.giftKey ? (
                <>
                  <p className="text-ink-2">Where should the {ckb} CKB go? Connect a wallet (JoyID takes a minute and needs no app), or paste a CKB address.</p>
                  {!signer && <button className="btn btn-ghost" onClick={() => void connect()}>Connect a wallet</button>}
                  {address && !payTo && <p className="text-sm font-mono break-all">To {address}</p>}
                  <input className="w-full rounded-2xl border border-line bg-paper-2 px-4 py-3" placeholder="…or paste a CKB address (ckt1…)" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
                  <button className="btn" disabled={!!busy || (!lock && !payTo.trim())} onClick={() => void open()}>{busy || "Open it"}</button>
                </>
              ) : !secrets ? (
                <p className="text-ink-2">Use the full link you were sent. The part after # is part of the key.</p>
              ) : !signer ? (
                <button className="btn" onClick={() => void connect()}>Connect the wallet this was sent to</button>
              ) : iAmRecipient ? (
                <button className="btn" disabled={!!busy} onClick={() => void open()}>{busy || "Open it"}</button>
              ) : (
                <p className="text-ink-2">This wallet isn&apos;t the one it was sent to. Switch wallets in the connect menu.</p>
              )}
            </div>
          )}
          {iAmSender && isGift && view.state !== "opened" && (
            <div className="rounded-2xl border border-line p-4 text-sm space-y-2">
              <p>You sealed this. If it&apos;s still unopened 90 days after it opens ({new Date((opensAt + Number(RECLAIM_GRACE_SECS)) * 1000).toLocaleDateString()}), you can take it back.</p>
              {view.state === "reclaimable" && <button className="btn btn-ghost" disabled={!!busy} onClick={() => void reclaim()}>Take it back</button>}
            </div>
          )}
        </section>
      )}

      {error && <p role="alert" className="text-tomato">{error}</p>}
      <p className="text-xs text-ink-2">Capsule <a className="underline font-mono" href={`https://testnet.explorer.nervos.org/transaction/${view.outPoint.txHash}`} target="_blank" rel="noreferrer">{view.outPoint.txHash.slice(0, 14)}…</a> · CKB testnet</p>
    </main>
  );
}
