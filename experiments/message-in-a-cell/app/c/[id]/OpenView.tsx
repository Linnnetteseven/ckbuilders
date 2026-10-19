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
import { CapsuleArt } from "@/components/CapsuleArt";
import { AppFooter, AppNav, RouteSteps } from "@/components/Shell";
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

  if (loaded === undefined) return (
    <>
      <AppNav />
      <main className="max-w-xl mx-auto px-5 py-16 text-center space-y-4">
        <CapsuleArt variant="buried" className="w-64 mx-auto rounded-2xl border-2 border-ink" />
        <p className="hand text-2xl text-tomato">digging it up…</p>
      </main>
    </>
  );
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

  const scene = revealed || view.state === "opened" ? "opened" : view.state === "sealed" ? (isGift ? "buried" : "sealed") : "ready";
  return (
    <>
      <AppNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 grid lg:grid-cols-[1fr_22rem] gap-10 items-start">
        <div className="space-y-8 min-w-0">
          <header className="space-y-2">
            <p className="hand text-2xl text-tomato -rotate-1">{d?.occasion || (isGift ? "a sealed message" : "a message for later")}</p>
            <h1 className="poster text-[clamp(2.8rem,9vw,5rem)]">{d?.to ? `For ${d.to}` : "For you"}</h1>
            {d?.from && <p className="slab text-2xl text-ink-2">from {d.from}</p>}
            <p className="tnum">
              {view.state === "opened" || revealed
                ? <>It held <span className="badge text-lg">{ckb} CKB</span>, released when it was opened.</>
                : <>With <span className="badge text-lg">{ckb} CKB</span> inside, yours when it opens.</>}
            </p>
          </header>
      {revealed ? (
            <section className="space-y-8" aria-label="The message">
              {openedTx && (
                <div className="card relative p-4 flex items-center gap-4">
                  <CapsuleArt variant="opened" className="w-28 shrink-0 rounded-lg" />
                  <p><strong>Opened.</strong> {ckb} CKB is on its way to your wallet. <a className="underline" href={`https://testnet.explorer.nervos.org/transaction/${openedTx}`} target="_blank" rel="noreferrer">Receipt</a></p>
                </div>
              )}
              {revealed.letter && (
                <article className="letter">
                  <p className="hand text-2xl text-tomato">{d?.to ? `Dear ${d.to},` : "Dear you,"}</p>
                  <p className="mt-3 text-[1.35rem] leading-[2.1rem] whitespace-pre-wrap">{revealed.letter}</p>
                  {d?.from && <p className="hand text-2xl text-right mt-4">{d.from}</p>}
                </article>
              )}
              {revealed.photoUrl && (
                <figure className="polaroid">
                  <img src={revealed.photoUrl} alt={`Photo from ${d?.from ?? "the sender"}`} className="w-full aspect-square object-cover" />
                  {d?.occasion && <figcaption className="hand text-xl text-center mt-2">{d.occasion}</figcaption>}
                </figure>
              )}
              {revealed.recordings.map((r, i) => r.kind === 2
                ? <div key={i} className="card relative p-4"><p className="label mb-2">A voice note from {d?.from ?? "them"}</p><audio src={r.url} controls className="w-full" /></div>
                : <div key={i} className="card relative p-3"><video src={r.url} controls playsInline className="w-full rounded-xl bg-black" /></div>)}
              <p className="text-sm text-ink-2">Keep this link: you can come back and read it any time. It stays on the network, and only your link opens it.</p>
            </section>
          ) : (
            <section className="space-y-5">
              {view.state === "opened" ? (
                <div className="space-y-3">
                  <p>This capsule has been opened.{secrets || needsWord ? "" : " Use the original link to read it again."}</p>
                  {wordPrompt}
                </div>
              ) : view.state === "sealed" ? (
                isGift ? (
                  <div className="space-y-6">
                    <Countdown to={opensAt} label="Opens in" />
                    <p className="text-ink-2">{new Date(opensAt * 1000).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                    <RouteSteps steps={[
                      { title: "Keep this link", body: "Bookmark it or keep the message it came in. It's the key." },
                      ...(needsWord ? [{ title: "Remember the secret word", body: `${d?.from ?? "The sender"} will tell you four words, separately from this link. You'll need them on the day.` }] : []),
                      { title: "Come back on the day", body: `This page shows an Open button. Opening reveals the message and sends the ${ckb} CKB to your wallet. No crypto needed beforehand.` },
                    ]} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-lg">This opens only if {d?.from ?? "its owner"} stops checking in for {Number(view.terms.t) >= 86400 ? `${Math.round(Number(view.terms.t) / 86400)} days` : `${Math.round(Number(view.terms.t) / 60)} minutes`}.</p>
                    <p className="text-ink-2">Keep this link somewhere safe, like with your important papers. Until then, there&apos;s nothing to do.</p>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <p className="slab text-3xl">It&apos;s time.</p>
                  <p className="text-ink-2">{needsWord && !secrets ? "Enter the secret word, then choose where the CKB goes. " : ""}Opening takes one tap and about ten seconds.</p>
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
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 order-first lg:order-none">
          <div className="card relative p-3"><CapsuleArt variant={scene} className="w-full rounded-xl" /></div>
          {thumbUrl && !revealed && (
            <figure className="card relative p-3">
              <img src={thumbUrl} alt="" className="w-full aspect-square object-cover rounded-lg blur-[3px]" />
              <figcaption className="hand text-lg text-center mt-1">a hint of what&apos;s inside</figcaption>
            </figure>
          )}
          <p className="text-xs text-ink-2">Capsule <a className="underline font-mono" href={`https://testnet.explorer.nervos.org/transaction/${view.outPoint.txHash}`} target="_blank" rel="noreferrer">{view.outPoint.txHash.slice(0, 14)}…</a> · CKB testnet</p>
        </aside>
      </main>
      <AppFooter />
    </>
  );
}
